// ============================================================
// Admin Routes — Revoke Sessions, Rotate Keys, Upgrade Auth
// ============================================================
import { Router } from 'express';
import { revokeSession, revokeAgent, rotateKey, upgradeAuth, TrustTier, } from '@agent-ledger/core';
export function adminRoutes(db, config) {
    const router = Router();
    // Middleware: admin-only (orchestrator tier)
    const requireOrchestrator = (req, res, next) => {
        if (req.agent?.tier !== TrustTier.Orchestrator) {
            res.status(403).json({ error: 'FORBIDDEN', message: 'Orchestrator tier required' });
            return;
        }
        next();
    };
    // POST /admin/revoke-session — Revoke a specific session
    router.post('/revoke-session', requireOrchestrator, (req, res) => {
        try {
            const { session_id, reason } = req.body;
            if (!session_id) {
                res.status(400).json({ error: 'MISSING_FIELDS', message: 'session_id required' });
                return;
            }
            // Find the agent for this session
            const agent = db.prepare('SELECT * FROM agents WHERE session_id = ?').get(session_id);
            if (!agent) {
                res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'No agent found with that session' });
                return;
            }
            revokeSession(session_id, agent.agent_id, reason || 'No reason provided', db);
            console.log(`[REVOKE] Session ${session_id} for agent ${agent.agent_id}: ${reason}`);
            res.json({ revoked: true, session_id, agent_id: agent.agent_id });
        }
        catch (err) {
            res.status(500).json({ error: 'REVOKE_FAILED', message: err.message });
        }
    });
    // POST /admin/revoke-agent — Revoke all sessions for an agent
    router.post('/revoke-agent', requireOrchestrator, (req, res) => {
        try {
            const { agent_id, reason } = req.body;
            if (!agent_id) {
                res.status(400).json({ error: 'MISSING_FIELDS', message: 'agent_id required' });
                return;
            }
            revokeAgent(agent_id, reason || 'No reason provided', db);
            console.log(`[REVOKE-AGENT] All sessions for ${agent_id}: ${reason}`);
            res.json({ revoked: true, agent_id });
        }
        catch (err) {
            res.status(500).json({ error: 'REVOKE_FAILED', message: err.message });
        }
    });
    // POST /admin/rotate-key — Nuclear key rotation
    router.post('/rotate-key', requireOrchestrator, async (req, res) => {
        try {
            await rotateKey(config.jwt, db);
            console.log('[ROTATE-KEY] All tokens invalidated');
            res.json({ rotated: true, message: 'All existing tokens are now invalid' });
        }
        catch (err) {
            res.status(500).json({ error: 'ROTATE_FAILED', message: err.message });
        }
    });
    // POST /admin/upgrade-auth — Migrate HS256 → RS256
    router.post('/upgrade-auth', requireOrchestrator, async (req, res) => {
        try {
            const newConfig = await upgradeAuth(config.jwt, db);
            console.log('[UPGRADE-AUTH] Migrated to RS256');
            res.json({ upgraded: true, new_mode: newConfig.mode });
        }
        catch (err) {
            res.status(500).json({ error: 'UPGRADE_FAILED', message: err.message });
        }
    });
    // GET /admin/status — System status overview
    router.get('/status', (req, res) => {
        try {
            const agents = db.prepare('SELECT COUNT(*) as count FROM agents').get();
            const activeLeases = db.prepare("SELECT COUNT(*) as count FROM leases WHERE status = 'active'").get();
            const queuedRequests = db.prepare('SELECT COUNT(*) as count FROM lease_queue').get();
            const totalEvents = db.prepare('SELECT COUNT(*) as count FROM events').get();
            const pendingEvents = db.prepare("SELECT COUNT(*) as count FROM events WHERE status = 'pending'").get();
            const revokedSessions = db.prepare('SELECT COUNT(*) as count FROM revoked_sessions').get();
            const milestones = db.prepare('SELECT COUNT(*) as count FROM milestones').get();
            res.json({
                agents: agents.count,
                active_leases: activeLeases.count,
                queued_requests: queuedRequests.count,
                total_events: totalEvents.count,
                pending_events: pendingEvents.count,
                revoked_sessions: revokedSessions.count,
                milestones: milestones.count,
                jwt_mode: config.jwt.mode,
                server_uptime: process.uptime(),
            });
        }
        catch (err) {
            res.status(500).json({ error: 'STATUS_FAILED', message: err.message });
        }
    });
    return router;
}
//# sourceMappingURL=admin.js.map