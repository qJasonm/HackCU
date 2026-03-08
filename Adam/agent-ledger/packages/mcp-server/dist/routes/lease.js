// ============================================================
// Lease Routes — Acquire, Release, Escalate, Heartbeat
// ============================================================
import { Router } from 'express';
import { acquireLease, releaseLease, escalateLease, processHeartbeat, grantNextInQueue, } from '@agent-ledger/core';
export function leaseRoutes(db, config, activeTail) {
    const router = Router();
    // POST /lease/acquire — Request a lease
    router.post('/acquire', (req, res) => {
        try {
            const agent = req.agent;
            const request = req.body;
            if (!request.resource || !request.scope) {
                res.status(400).json({ error: 'MISSING_FIELDS', message: 'resource and scope required' });
                return;
            }
            const result = acquireLease(agent.agent_id, agent.tier, request, db);
            if (result.granted) {
                console.log(`[LEASE] Granted ${result.lease.scope} lease on ${request.resource} to ${agent.agent_id}`);
            }
            else if (result.queue_position) {
                console.log(`[QUEUE] Agent ${agent.agent_id} queued at position ${result.queue_position} for ${request.resource}`);
            }
            res.json({
                granted: result.granted,
                lease: result.lease || undefined,
                queue_position: result.queue_position,
                request_id: result.request_id,
                warning: result.granted ? undefined : `Lease request queued — ${result.conflicts?.length || 0} conflicts`,
            });
        }
        catch (err) {
            res.status(500).json({ error: 'LEASE_ACQUIRE_FAILED', message: err.message });
        }
    });
    // POST /lease/release — Release a held lease
    router.post('/release', (req, res) => {
        try {
            const { lease_id } = req.body;
            if (!lease_id) {
                res.status(400).json({ error: 'MISSING_FIELDS', message: 'lease_id required' });
                return;
            }
            const result = releaseLease(lease_id, db);
            if (!result.released) {
                res.status(404).json({ error: 'LEASE_NOT_FOUND', message: 'Lease not found or already released' });
                return;
            }
            // Try to grant next in queue
            const agent = req.agent;
            if (result.next_in_queue) {
                const granted = grantNextInQueue(result.next_in_queue.resource, db);
                if (granted) {
                    console.log(`[GRANT] Queued lease ${granted.lease_id} granted to ${granted.agent_id}`);
                }
            }
            console.log(`[RELEASE] Lease ${lease_id} released by ${agent.agent_id}`);
            res.json({ released: true });
        }
        catch (err) {
            res.status(500).json({ error: 'LEASE_RELEASE_FAILED', message: err.message });
        }
    });
    // POST /lease/escalate — Expand lease scope
    router.post('/escalate', (req, res) => {
        try {
            const { lease_id, new_scope, line_start, line_end } = req.body;
            if (!lease_id || !new_scope) {
                res.status(400).json({ error: 'MISSING_FIELDS', message: 'lease_id and new_scope required' });
                return;
            }
            const result = escalateLease(lease_id, new_scope, line_start ?? null, line_end ?? null, db);
            if (result.escalated) {
                console.log(`[ESCALATE] Lease ${lease_id} escalated to ${new_scope}`);
            }
            else if (result.queued) {
                console.log(`[ESCALATE-QUEUE] Lease ${lease_id} escalation queued at P1`);
            }
            res.json(result);
        }
        catch (err) {
            res.status(500).json({ error: 'LEASE_ESCALATE_FAILED', message: err.message });
        }
    });
    // POST /lease/heartbeat — Keep a lease alive
    router.post('/heartbeat', (req, res) => {
        try {
            const { lease_id } = req.body;
            if (!lease_id) {
                res.status(400).json({ error: 'MISSING_FIELDS', message: 'lease_id required' });
                return;
            }
            const success = processHeartbeat(lease_id, db);
            if (!success) {
                res.status(404).json({ error: 'LEASE_NOT_FOUND', message: 'No active lease with that ID' });
                return;
            }
            res.json({ success: true });
        }
        catch (err) {
            res.status(500).json({ error: 'HEARTBEAT_FAILED', message: err.message });
        }
    });
    return router;
}
//# sourceMappingURL=lease.js.map