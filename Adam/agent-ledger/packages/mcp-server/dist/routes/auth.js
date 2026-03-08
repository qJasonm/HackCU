// ============================================================
// Auth Routes — Registration & Public Key
// ============================================================
import { Router } from 'express';
import { generateToken, hashToken, getPublicKey, insertAgent, getAgentById, TIER_SCOPES, } from '@agent-ledger/core';
export function authRoutes(db, config) {
    const router = Router();
    // POST /auth/register — Register an agent and receive JWT
    router.post('/register', async (req, res) => {
        try {
            const { agent_id, tier } = req.body;
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
            const existing = getAgentById(db).get(agent_id);
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
        }
        catch (err) {
            console.error('[REGISTER ERROR]', err);
            res.status(500).json({ error: 'REGISTRATION_FAILED', message: err.message });
        }
    });
    // GET /auth/public-key — Return RS256 public key (unauthenticated)
    router.get('/public-key', (_req, res) => {
        const publicKey = getPublicKey(config.jwt);
        if (!publicKey) {
            res.status(404).json({ error: 'NOT_AVAILABLE', message: 'Public key not available (using HS256 mode)' });
            return;
        }
        res.type('text/plain').send(publicKey);
    });
    return router;
}
//# sourceMappingURL=auth.js.map