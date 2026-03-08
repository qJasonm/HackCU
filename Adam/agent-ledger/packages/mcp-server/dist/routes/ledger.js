// ============================================================
// Ledger Routes — Report Intent/Action, Query, Milestones
// ============================================================
import { Router } from 'express';
import { createEvent, completeEvent, getLatestEventsForAgent, } from '@agent-ledger/core';
import { nanoid } from 'nanoid';
export function ledgerRoutes(db, config, activeTail, auditLog) {
    const router = Router();
    // POST /ledger/report-intent — Log intent before action
    router.post('/report-intent', (req, res) => {
        try {
            const agent = req.agent;
            const request = req.body;
            if (!request.resource || !request.intent) {
                res.status(400).json({ error: 'MISSING_FIELDS', message: 'resource and intent required' });
                return;
            }
            const result = createEvent(agent.agent_id, agent.tier, request, config.event_tree.max_tree_depth, db);
            if (!result.success) {
                if (result.error === 'CYCLE_DETECTED') {
                    res.status(409).json({
                        error: 'CYCLE_DETECTED',
                        message: 'Circular event dependency detected',
                        ancestor_chain: result.ancestor_chain,
                    });
                    return;
                }
                res.status(500).json({ error: 'EVENT_CREATION_FAILED', message: result.error });
                return;
            }
            // Add to active tail
            activeTail.push(agent.agent_id, result.event);
            // Append to audit log
            auditLog.appendEntry(result.event);
            console.log(`[INTENT] ${agent.agent_id}: "${request.intent}" on ${request.resource}`);
            res.json({
                event_id: result.event.event_id,
                correlation_id: result.event.correlation_id,
                status: result.event.status,
            });
        }
        catch (err) {
            res.status(500).json({ error: 'REPORT_INTENT_FAILED', message: err.message });
        }
    });
    // POST /ledger/report-action — Log ground truth after action
    router.post('/report-action', (req, res) => {
        try {
            const agent = req.agent;
            const request = req.body;
            if (!request.event_id || !request.ground_truth) {
                res.status(400).json({ error: 'MISSING_FIELDS', message: 'event_id and ground_truth required' });
                return;
            }
            const result = completeEvent(request.event_id, request.ground_truth, db);
            if (!result.success) {
                res.status(result.error === 'EVENT_NOT_FOUND' ? 404 : 409).json({
                    error: result.error,
                    message: result.error === 'EVENT_NOT_FOUND' ? 'Event not found' : 'Event already completed',
                });
                return;
            }
            // Update in active tail
            activeTail.push(agent.agent_id, result.event);
            // Append to audit log
            auditLog.appendEntry(result.event);
            console.log(`[ACTION] ${agent.agent_id}: completed event ${request.event_id}`);
            res.json({
                event_id: result.event.event_id,
                status: result.event.status,
            });
        }
        catch (err) {
            res.status(500).json({ error: 'REPORT_ACTION_FAILED', message: err.message });
        }
    });
    // GET /ledger/latest — Get latest N entries for an agent
    router.get('/latest', (req, res) => {
        try {
            const agent = req.agent;
            const count = parseInt(req.query.count) || config.storage.active_tail_size;
            const agentId = req.query.agent_id || agent.agent_id;
            // Try active tail first
            let entries = activeTail.get(agentId);
            // If not enough in tail, query DB
            if (entries.length < count) {
                entries = getLatestEventsForAgent(agentId, count, db);
            }
            res.json({ entries: entries.slice(0, count), agent_id: agentId });
        }
        catch (err) {
            res.status(500).json({ error: 'QUERY_FAILED', message: err.message });
        }
    });
    // GET /ledger/query — Search events (basic text search for now)
    router.get('/query', (req, res) => {
        try {
            const query = req.query.q;
            const limit = parseInt(req.query.limit) || 20;
            if (!query) {
                res.status(400).json({ error: 'MISSING_QUERY', message: 'Query parameter q required' });
                return;
            }
            // Basic text search on intent field
            const events = db.prepare("SELECT * FROM events WHERE intent LIKE ? ORDER BY created_at DESC LIMIT ?").all(`%${query}%`, limit);
            res.json({ results: events, count: events.length });
        }
        catch (err) {
            res.status(500).json({ error: 'QUERY_FAILED', message: err.message });
        }
    });
    // POST /ledger/milestone — Declare a milestone
    router.post('/milestone', (req, res) => {
        try {
            const agent = req.agent;
            const { description } = req.body;
            if (!description) {
                res.status(400).json({ error: 'MISSING_FIELDS', message: 'description required' });
                return;
            }
            const milestoneId = `ms-${nanoid(8)}`;
            const now = Math.floor(Date.now() / 1000);
            db.prepare(`
        INSERT INTO milestones (milestone_id, description, trigger, summary, created_at, embedding)
        VALUES (?, ?, ?, NULL, ?, NULL)
      `).run(milestoneId, description, `manual:${agent.agent_id}`, now);
            console.log(`[MILESTONE] ${agent.agent_id}: "${description}"`);
            res.json({ milestone_id: milestoneId, description, created_at: now });
        }
        catch (err) {
            res.status(500).json({ error: 'MILESTONE_FAILED', message: err.message });
        }
    });
    return router;
}
//# sourceMappingURL=ledger.js.map