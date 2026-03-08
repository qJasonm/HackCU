// ============================================================
// Auth Routes — Registration & Public Key
// ============================================================

import { Router, type Request, type Response } from 'express';
import type Database from 'better-sqlite3';
import {
  generateToken,
  hashToken,
  getPublicKey,
  insertAgent,
  getAgentById,
  type LedgerConfig,
  type TrustTier,
  type RegisterRequest,
  TIER_SCOPES,
} from '@agent-ledger/core';

export function authRoutes(db: Database.Database, config: LedgerConfig): Router {
  const router = Router();

  // POST /auth/register — Register an agent and receive JWT
  router.post('/register', async (req: Request, res: Response) => {
    try {
      const { agent_id, tier } = req.body as RegisterRequest;

      if (!agent_id || !tier) {
        res.status(400).json({ error: 'MISSING_FIELDS', message: 'agent_id and tier required' });
        return;
      }

      // Check valid tier
      if (!TIER_SCOPES[tier]) {
        res.status(400).json({ error: 'INVALID_TIER', message: 'Invalid trust tier' });
        return;
      }

      // Check if agent already registered
      const existing = getAgentById(db).get(agent_id) as any;
      if (existing) {
        // Re-register: issue new token
        const { token, payload } = await generateToken(agent_id, tier, config.jwt.expiry_hours);
        const tokenHash = hashToken(token);

        db.prepare('UPDATE agents SET session_id = ?, token_hash = ?, tier = ?, registered_at = ? WHERE agent_id = ?')
          .run(payload.session_id, tokenHash, tier, payload.issued_at, agent_id);

        res.json({
          token,
          session_id: payload.session_id,
          agent_id,
          tier,
          expires_at: payload.expires_at,
        });
        return;
      }

      // New registration
      const { token, payload } = await generateToken(agent_id, tier, config.jwt.expiry_hours);
      const tokenHash = hashToken(token);

      insertAgent(db).run({
        agent_id,
        tier,
        session_id: payload.session_id,
        token_hash: tokenHash,
        registered_at: payload.issued_at,
        last_heartbeat: null,
      });

      console.log(`[REGISTER] Agent ${agent_id} registered as ${tier}, session ${payload.session_id}`);

      res.json({
        token,
        session_id: payload.session_id,
        agent_id,
        tier,
        expires_at: payload.expires_at,
      });
    } catch (err: any) {
      console.error('[REGISTER ERROR]', err);
      res.status(500).json({ error: 'REGISTRATION_FAILED', message: err.message });
    }
  });

  // GET /auth/public-key — Return RS256 public key (unauthenticated)
  router.get('/public-key', (_req: Request, res: Response) => {
    const publicKey = getPublicKey(config.jwt);
    if (!publicKey) {
      res.status(404).json({ error: 'NOT_AVAILABLE', message: 'Public key not available (using HS256 mode)' });
      return;
    }
    res.type('text/plain').send(publicKey);
  });

  return router;
}
