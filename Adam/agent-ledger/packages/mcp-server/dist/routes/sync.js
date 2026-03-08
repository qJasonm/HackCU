// ============================================================
// Sync Routes — Unauthorized Edit Detection & Acknowledgement
// ============================================================
import { Router } from 'express';
import { nanoid } from 'nanoid';
import { insertExternalEdit, getUnresolvedExternalEdits, insertSyncAck, getSyncAcks, getActiveLeasesByResource, LeaseStatus, } from '@agent-ledger/core';
export function syncRoutes(db) {
    const router = Router();
    // POST /sync/notify-external-edit — VS Code extension reports unauthorized edit
    router.post('/notify-external-edit', (req, res) => {
        try {
            const { resource, changed_lines } = req.body;
            if (!resource || !changed_lines) {
                res.status(400).json({ error: 'MISSING_FIELDS', message: 'resource and changed_lines required' });
                return;
            }
            const eventId = `ext-${nanoid(8)}`;
            const now = Math.floor(Date.now() / 1000);
            insertExternalEdit(db).run({
                event_id: eventId,
                resource,
                change_start: changed_lines.start,
                change_end: changed_lines.end,
                detected_at: now,
                detected_by: req.agent?.agent_id || 'vscode-extension',
            });
            // Check active leases on this resource
            const activeLeases = getActiveLeasesByResource(db).all(resource);
            const affectedAgents = [];
            for (const lease of activeLeases) {
                // Check overlap
                const overlaps = (lease.line_start === null || lease.line_end === null ||
                    (changed_lines.start <= lease.line_end && changed_lines.end >= lease.line_start));
                if (overlaps) {
                    // Suspend overlapping leases
                    db.prepare('UPDATE leases SET status = ? WHERE lease_id = ?').run(LeaseStatus.Suspended, lease.lease_id);
                    console.log(`[SUSPEND] Lease ${lease.lease_id} suspended due to overlapping external edit`);
                }
                affectedAgents.push(lease.agent_id);
            }
            console.log(`[EXTERNAL-EDIT] ${resource} lines ${changed_lines.start}-${changed_lines.end}, ${affectedAgents.length} agents affected`);
            res.json({
                event_id: eventId,
                affected_agents: [...new Set(affectedAgents)],
                status: 'SYNC_REQUIRED',
            });
        }
        catch (err) {
            res.status(500).json({ error: 'SYNC_NOTIFY_FAILED', message: err.message });
        }
    });
    // POST /sync/acknowledge — Agent acknowledges external edit
    router.post('/acknowledge', (req, res) => {
        try {
            const agent = req.agent;
            const { event_id } = req.body;
            if (!event_id) {
                res.status(400).json({ error: 'MISSING_FIELDS', message: 'event_id required' });
                return;
            }
            const now = Math.floor(Date.now() / 1000);
            insertSyncAck(db).run({
                event_id,
                agent_id: agent.agent_id,
                acknowledged_at: now,
            });
            // Check if all affected agents have acknowledged
            const acks = getSyncAcks(db).all(event_id);
            const edit = db.prepare('SELECT * FROM external_edits WHERE event_id = ?').get(event_id);
            if (edit) {
                const activeLeases = getActiveLeasesByResource(db).all(edit.resource);
                const affectedAgentIds = [...new Set(activeLeases.map(l => l.agent_id))];
                const ackedAgentIds = new Set(acks.map((a) => a.agent_id));
                const allAcked = affectedAgentIds.every(id => ackedAgentIds.has(id));
                if (allAcked) {
                    // Resolve the external edit — lift freeze
                    db.prepare('UPDATE external_edits SET resolved = 1 WHERE event_id = ?').run(event_id);
                    // Re-activate suspended leases (but not released ones)
                    for (const lease of activeLeases) {
                        if (lease.status === LeaseStatus.Suspended) {
                            db.prepare('UPDATE leases SET status = ? WHERE lease_id = ?').run(LeaseStatus.Active, lease.lease_id);
                        }
                    }
                    console.log(`[SYNC-RESOLVED] External edit ${event_id} fully acknowledged, freeze lifted`);
                    res.json({ acknowledged: true, freeze_lifted: true });
                    return;
                }
            }
            console.log(`[SYNC-ACK] Agent ${agent.agent_id} acknowledged edit ${event_id}`);
            res.json({ acknowledged: true, freeze_lifted: false });
        }
        catch (err) {
            res.status(500).json({ error: 'SYNC_ACK_FAILED', message: err.message });
        }
    });
    // GET /sync/pending — Check if agent has pending sync requirements
    router.get('/pending', (req, res) => {
        try {
            const agent = req.agent;
            // Find unresolved external edits on resources this agent has leases on
            const leases = db.prepare("SELECT DISTINCT resource FROM leases WHERE agent_id = ? AND status IN ('active', 'suspended')").all(agent.agent_id);
            const pendingEdits = [];
            for (const { resource } of leases) {
                const edits = getUnresolvedExternalEdits(db).all(resource);
                for (const edit of edits) {
                    // Check if this agent already acknowledged
                    const ack = db.prepare('SELECT 1 FROM sync_acks WHERE event_id = ? AND agent_id = ?').get(edit.event_id, agent.agent_id);
                    if (!ack) {
                        pendingEdits.push(edit);
                    }
                }
            }
            res.json({ pending: pendingEdits, count: pendingEdits.length });
        }
        catch (err) {
            res.status(500).json({ error: 'SYNC_PENDING_FAILED', message: err.message });
        }
    });
    return router;
}
//# sourceMappingURL=sync.js.map