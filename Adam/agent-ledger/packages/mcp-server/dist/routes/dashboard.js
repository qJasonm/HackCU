// ============================================================
// Dashboard Routes — API + HTML for the real-time dashboard
// ============================================================
import { Router } from 'express';
import { getDashboardHtml } from './dashboard-html.js';
export function dashboardRoutes(db, startTime) {
    const router = Router();
    // Serve the dashboard HTML
    router.get('/', (_req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.send(getDashboardHtml());
    });
    // Dashboard data API — returns everything in one call
    router.get('/data', (_req, res) => {
        try {
            const agents = db.prepare('SELECT * FROM agents ORDER BY registered_at DESC').all();
            const activeLeases = db.prepare("SELECT * FROM leases WHERE status = 'active' ORDER BY granted_at DESC").all();
            const suspendedLeases = db.prepare("SELECT * FROM leases WHERE status = 'suspended'").all();
            const queuedRequests = db.prepare('SELECT * FROM lease_queue ORDER BY priority ASC, queued_at ASC').all();
            const recentEvents = db.prepare('SELECT * FROM events ORDER BY created_at DESC LIMIT 50').all();
            const milestones = db.prepare('SELECT * FROM milestones ORDER BY created_at DESC').all();
            const totalEvents = db.prepare('SELECT COUNT(*) as c FROM events').get().c;
            const pendingEvents = db.prepare("SELECT COUNT(*) as c FROM events WHERE status = 'pending'").get().c;
            const revokedSessions = db.prepare('SELECT COUNT(*) as c FROM revoked_sessions').get().c;
            const unresolvedEdits = db.prepare('SELECT COUNT(*) as c FROM external_edits WHERE resolved = 0').get().c;
            res.json({
                timestamp: Date.now(),
                uptime: Math.floor((Date.now() - startTime) / 1000),
                agents: agents.map((a) => ({
                    agent_id: a.agent_id,
                    tier: a.tier,
                    session_id: a.session_id,
                    registered_at: a.registered_at,
                    last_heartbeat: a.last_heartbeat,
                })),
                leases: {
                    active: activeLeases.map((l) => ({
                        lease_id: l.lease_id,
                        agent_id: l.agent_id,
                        resource: l.resource,
                        scope: l.scope,
                        line_start: l.line_start,
                        line_end: l.line_end,
                        granted_at: l.granted_at,
                        expires_at: l.expires_at,
                    })),
                    suspended: suspendedLeases.length,
                    queued: queuedRequests.map((q) => ({
                        request_id: q.request_id,
                        agent_id: q.agent_id,
                        resource: q.resource,
                        priority: q.priority,
                        queued_at: q.queued_at,
                    })),
                },
                events: recentEvents.map((e) => ({
                    event_id: e.event_id,
                    agent_id: e.agent_id,
                    type: e.type,
                    resource: e.resource,
                    intent: e.intent,
                    status: e.status,
                    created_at: e.created_at,
                    correlation_id: e.correlation_id,
                    tree_depth: e.tree_depth,
                })),
                milestones: milestones.map((m) => ({
                    milestone_id: m.milestone_id,
                    description: m.description,
                    created_at: m.created_at,
                })),
                stats: {
                    total_agents: agents.length,
                    active_leases: activeLeases.length,
                    queued_requests: queuedRequests.length,
                    total_events: totalEvents,
                    pending_events: pendingEvents,
                    revoked_sessions: revokedSessions,
                    milestones: milestones.length,
                    unresolved_edits: unresolvedEdits,
                },
            });
        }
        catch (err) {
            res.status(500).json({ error: 'DASHBOARD_ERROR', message: err.message });
        }
    });
    return router;
}
//# sourceMappingURL=dashboard.js.map