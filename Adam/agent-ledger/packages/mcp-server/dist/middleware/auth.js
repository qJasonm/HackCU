// ============================================================
// Auth Middleware — JWT Verification + Session Blacklist
// ============================================================
import { verifyToken, checkSessionRevoked } from '@agent-ledger/core';
export function authMiddleware(db) {
    return async (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'MISSING_TOKEN', message: 'Authorization header required' });
            return;
        }
        const token = authHeader.slice(7);
        try {
            const payload = await verifyToken(token);
            // Check if session is revoked
            if (checkSessionRevoked(payload.session_id, db)) {
                res.status(401).json({ error: 'SESSION_REVOKED', message: 'This session has been revoked' });
                return;
            }
            // Check expiry
            const now = Math.floor(Date.now() / 1000);
            if (payload.expires_at < now) {
                res.status(401).json({ error: 'TOKEN_EXPIRED', message: 'Token has expired' });
                return;
            }
            req.agent = payload;
            next();
        }
        catch (err) {
            res.status(401).json({ error: 'INVALID_TOKEN', message: 'Token verification failed' });
        }
    };
}
//# sourceMappingURL=auth.js.map