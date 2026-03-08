// ============================================================
// Admin Routes — Revoke Sessions, Rotate Keys, Upgrade Auth
// ============================================================

import { Router, type Request, type Response } from 'express';
import type Database from 'better-sqlite3';
import {
  revokeSession,
  revokeAgent,
  rotateKey,
  upgradeAuth,
  type LedgerConfig,
  TrustTier,
} from '@agent-ledger/core';

export function adminRoutes(db: Database.Database, config: LedgerConfig): Router {
  const router = Router();

  // Middleware: admin-only (orchestrator tier)
  const requireOrchestrator = (req: Request, res: Response, next: Function) => {
    if (req.agent?.tier !== TrustTier.Orchestrator) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Orchestrator tier required' });
      return;
    }
    next();
  };

  // POST /admin/revoke-session — Revoke a specific session
  router.post('/revoke-session', requireOrchestrator, (req: Request, res: Response) => {
    try {
      const { session_id, reason } = req.body;
      if (!session_id) {
        res.status(400).json({ error: 'MISSING_FIELDS', message: 'session_id required' });
        return;
      }

      // Find the agent for this session
      const agent = db.prepare('SELECT * FROM agents WHERE session_id = ?').get(session_id) as any;
      if (!agent) {
        res.status(404).json({ error: 'SESSION_NOT_FOUND', message: 'No agent found with that session' });
        return;
      }

      revokeSession(session_id, agent.agent_id, reason || 'No reason provided', db);
      console.log(`[REVOKE] Session ${session_id} for agent ${agent.agent_id}: ${reason}`);

      res.json({ revoked: true, session_id, agent_id: agent.agent_id });
    } catch (err: any) {
      res.status(500).json({ error: 'REVOKE_FAILED', message: err.message });
    }
  });

  // POST /admin/revoke-agent — Revoke all sessions for an agent
  router.post('/revoke-agent', requireOrchestrator, (req: Request, res: Response) => {
    try {
      const { agent_id, reason } = req.body;
      if (!agent_id) {
        res.status(400).json({ error: 'MISSING_FIELDS', message: 'agent_id required' });
        return;
      }

      revokeAgent(agent_id, reason || 'No reason provided', db);
      console.log(`[REVOKE-AGENT] All sessions for ${agent_id}: ${reason}`);

      res.json({ revoked: true, agent_id });
    } catch (err: any) {
      res.status(500).json({ error: 'REVOKE_FAILED', message: err.message });
    }
  });

  // POST /admin/rotate-key — Nuclear key rotation
  router.post('/rotate-key', requireOrchestrator, async (req: Request, res: Response) => {
    try {
      await rotateKey(config.jwt, db);
      console.log('[ROTATE-KEY] All tokens invalidated');
      res.json({ rotated: true, message: 'All existing tokens are now invalid' });
    } catch (err: any) {
      res.status(500).json({ error: 'ROTATE_FAILED', message: err.message });
    }
  });

  // POST /admin/upgrade-auth — Migrate HS256 → RS256
  router.post('/upgrade-auth', requireOrchestrator, async (req: Request, res: Response) => {
    try {
      const newConfig = await upgradeAuth(config.jwt, db);
      console.log('[UPGRADE-AUTH] Migrated to RS256');
      res.json({ upgraded: true, new_mode: newConfig.mode });
    } catch (err: any) {
      res.status(500).json({ error: 'UPGRADE_FAILED', message: err.message });
    }
  });

  // GET /admin/status — System status overview
  router.get('/status', (req: Request, res: Response) => {
    try {
      const agents = db.prepare('SELECT COUNT(*) as count FROM agents').get() as any;
      const activeLeases = db.prepare("SELECT COUNT(*) as count FROM leases WHERE status = 'active'").get() as any;
      const queuedRequests = db.prepare('SELECT COUNT(*) as count FROM lease_queue').get() as any;
      const totalEvents = db.prepare('SELECT COUNT(*) as count FROM events').get() as any;
      const pendingEvents = db.prepare("SELECT COUNT(*) as count FROM events WHERE status = 'pending'").get() as any;
      const revokedSessions = db.prepare('SELECT COUNT(*) as count FROM revoked_sessions').get() as any;
      const milestones = db.prepare('SELECT COUNT(*) as count FROM milestones').get() as any;

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
    } catch (err: any) {
      res.status(500).json({ error: 'STATUS_FAILED', message: err.message });
    }
  });

  return router;
}
