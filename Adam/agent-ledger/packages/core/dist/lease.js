// ============================================================
// @agent-ledger/core — Lease Management Logic
// ============================================================
import { nanoid } from 'nanoid';
import { LeaseScope, LeaseStatus, Priority, TrustTier, MAX_CONCURRENT_LEASES } from './types.js';
import * as dbHelpers from './db.js';
// ---- Interval Overlap Detection ----
export function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
    // File-scope leases always overlap with anything on the same resource
    if (aStart === null || aEnd === null || bStart === null || bEnd === null) {
        return true;
    }
    return aStart <= bEnd && bStart <= aEnd;
}
export function checkOverlap(existingLeases, newRequest, agentId) {
    return existingLeases.filter(lease => {
        if (lease.agent_id === agentId)
            return false; // Same agent doesn't conflict with itself
        if (lease.status !== LeaseStatus.Active)
            return false;
        return intervalsOverlap(lease.line_start, lease.line_end, newRequest.line_start, newRequest.line_end);
    });
}
export function acquireLease(agentId, tier, request, database) {
    const now = Math.floor(Date.now() / 1000);
    // Check max concurrent leases for this agent
    const maxLeases = MAX_CONCURRENT_LEASES[tier];
    if (maxLeases === 0) {
        return { granted: false, conflicts: [] };
    }
    const activeLeases = dbHelpers.getActiveLeasesByAgent(database).all(agentId);
    if (maxLeases !== Infinity && activeLeases.length >= maxLeases) {
        return { granted: false, conflicts: [] };
    }
    // Determine line range
    let lineStart = request.line_start ?? null;
    let lineEnd = request.line_end ?? null;
    if (request.scope === LeaseScope.File) {
        lineStart = null;
        lineEnd = null;
    }
    // Check for conflicts
    const existingLeases = dbHelpers.getActiveLeasesByResource(database).all(request.resource);
    const conflicts = checkOverlap(existingLeases, { line_start: lineStart, line_end: lineEnd, scope: request.scope }, agentId);
    if (conflicts.length > 0) {
        // Queue the request
        const priority = tier === TrustTier.Orchestrator ? Priority.P0 : Priority.P2;
        const requestId = `req-${nanoid(8)}`;
        dbHelpers.insertLeaseQueueEntry(database).run({
            request_id: requestId,
            agent_id: agentId,
            resource: request.resource,
            scope: request.scope,
            line_start: lineStart,
            line_end: lineEnd,
            priority,
            queued_at: now,
            promoted_at: null,
        });
        // Count queue position
        const queueEntries = dbHelpers.getQueuedRequestsByResource(database).all(request.resource);
        const position = queueEntries.findIndex(e => e.request_id === requestId) + 1;
        return { granted: false, queue_position: position, request_id: requestId, conflicts };
    }
    // Grant the lease
    const leaseId = `lease-${nanoid(8)}`;
    const lease = {
        lease_id: leaseId,
        agent_id: agentId,
        resource: request.resource,
        scope: request.scope,
        line_start: lineStart,
        line_end: lineEnd,
        status: LeaseStatus.Active,
        priority: tier === TrustTier.Orchestrator ? Priority.P0 : Priority.P2,
        granted_at: now,
        expires_at: now + 300, // 5 minute max unless heartbeat extends
        correlation_id: null,
    };
    dbHelpers.insertLease(database).run(lease);
    return { granted: true, lease };
}
export function releaseLease(leaseId, database) {
    const lease = database.prepare('SELECT * FROM leases WHERE lease_id = ?').get(leaseId);
    if (!lease || lease.status === LeaseStatus.Released) {
        return { released: false };
    }
    database.prepare('UPDATE leases SET status = ? WHERE lease_id = ?').run(LeaseStatus.Released, leaseId);
    // Check if anyone is waiting in the queue for this resource
    const queue = dbHelpers.getQueuedRequestsByResource(database).all(lease.resource);
    let nextInQueue;
    if (queue.length > 0) {
        nextInQueue = queue[0];
    }
    return { released: true, next_in_queue: nextInQueue };
}
export function escalateLease(leaseId, newScope, newLineStart, newLineEnd, database) {
    const lease = database.prepare('SELECT * FROM leases WHERE lease_id = ?').get(leaseId);
    if (!lease || lease.status !== LeaseStatus.Active) {
        return { escalated: false };
    }
    const lineStart = newScope === LeaseScope.File ? null : newLineStart;
    const lineEnd = newScope === LeaseScope.File ? null : newLineEnd;
    // Check conflicts on the broader scope
    const existingLeases = dbHelpers.getActiveLeasesByResource(database).all(lease.resource);
    const conflicts = checkOverlap(existingLeases, { line_start: lineStart, line_end: lineEnd, scope: newScope }, lease.agent_id);
    if (conflicts.length > 0) {
        // Queue at P1 priority (escalation), keep original lease
        const now = Math.floor(Date.now() / 1000);
        const requestId = `req-${nanoid(8)}`;
        dbHelpers.insertLeaseQueueEntry(database).run({
            request_id: requestId,
            agent_id: lease.agent_id,
            resource: lease.resource,
            scope: newScope,
            line_start: lineStart,
            line_end: lineEnd,
            priority: Priority.P1,
            queued_at: now,
            promoted_at: null,
        });
        const queueEntries = dbHelpers.getQueuedRequestsByResource(database).all(lease.resource);
        const position = queueEntries.findIndex(e => e.request_id === requestId) + 1;
        return { escalated: false, queued: true, request_id: requestId, queue_position: position };
    }
    // In-place expansion
    database.prepare('UPDATE leases SET scope = ?, line_start = ?, line_end = ? WHERE lease_id = ?')
        .run(newScope, lineStart, lineEnd, leaseId);
    const updatedLease = database.prepare('SELECT * FROM leases WHERE lease_id = ?').get(leaseId);
    return { escalated: true, lease: updatedLease };
}
// ---- Heartbeat ----
export function processHeartbeat(leaseId, database) {
    const lease = database.prepare('SELECT * FROM leases WHERE lease_id = ?').get(leaseId);
    if (!lease || lease.status !== LeaseStatus.Active) {
        return false;
    }
    const now = Math.floor(Date.now() / 1000);
    database.prepare('UPDATE leases SET expires_at = ? WHERE lease_id = ?').run(now + 300, leaseId);
    database.prepare('UPDATE agents SET last_heartbeat = ? WHERE agent_id = ?').run(now, lease.agent_id);
    return true;
}
export function expireStaleLeases(database) {
    const now = Math.floor(Date.now() / 1000);
    const staleLeases = database.prepare("SELECT * FROM leases WHERE status = 'active' AND expires_at < ?").all(now);
    const expired = [];
    for (const lease of staleLeases) {
        database.prepare('UPDATE leases SET status = ? WHERE lease_id = ?').run(LeaseStatus.Released, lease.lease_id);
        // Mark any pending events for this agent as orphaned
        database.prepare("UPDATE events SET status = 'orphaned' WHERE agent_id = ? AND status = 'pending'").run(lease.agent_id);
        // Check queue
        const queue = dbHelpers.getQueuedRequestsByResource(database).all(lease.resource);
        expired.push({
            lease,
            next_in_queue: queue.length > 0 ? queue[0] : undefined,
        });
    }
    return expired;
}
// ---- Starvation Prevention ----
export function promoteStarvedRequests(timeoutMs, database) {
    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - Math.floor(timeoutMs / 1000);
    const stale = dbHelpers.getStaleQueueEntries(database).all(cutoff);
    const promoted = [];
    for (const entry of stale) {
        database.prepare('UPDATE lease_queue SET priority = 0, promoted_at = ? WHERE request_id = ?').run(now, entry.request_id);
        promoted.push({ ...entry, priority: Priority.P0, promoted_at: now });
    }
    return promoted;
}
// ---- Grant next in queue ----
export function grantNextInQueue(resource, database) {
    const queue = dbHelpers.getQueuedRequestsByResource(database).all(resource);
    if (queue.length === 0)
        return null;
    const next = queue[0];
    const now = Math.floor(Date.now() / 1000);
    // Check if still conflicting
    const existingLeases = dbHelpers.getActiveLeasesByResource(database).all(resource);
    const conflicts = checkOverlap(existingLeases, { line_start: next.line_start, line_end: next.line_end, scope: next.scope }, next.agent_id);
    if (conflicts.length > 0)
        return null;
    // Grant
    const leaseId = `lease-${nanoid(8)}`;
    const lease = {
        lease_id: leaseId,
        agent_id: next.agent_id,
        resource: next.resource,
        scope: next.scope,
        line_start: next.line_start,
        line_end: next.line_end,
        status: LeaseStatus.Active,
        priority: next.priority,
        granted_at: now,
        expires_at: now + 300,
        correlation_id: null,
    };
    dbHelpers.insertLease(database).run(lease);
    dbHelpers.removeQueueEntry(database).run(next.request_id);
    return lease;
}
//# sourceMappingURL=lease.js.map