import type Database from 'better-sqlite3';
import type { JWTPayload, TrustTier, LedgerConfig } from './types.js';
export declare function initAuth(config: LedgerConfig['jwt']): Promise<void>;
export declare function getPublicKey(config: LedgerConfig['jwt']): string | null;
export declare function generateToken(agentId: string, tier: TrustTier, expiryHours: number): Promise<{
    token: string;
    payload: JWTPayload;
}>;
export declare function verifyToken(token: string): Promise<JWTPayload>;
export declare function checkSessionRevoked(sessionId: string, database: Database.Database): boolean;
export declare function revokeSession(sessionId: string, agentId: string, reason: string, database: Database.Database): void;
export declare function revokeAgent(agentId: string, reason: string, database: Database.Database): void;
export declare function rotateKey(config: LedgerConfig['jwt'], database: Database.Database): Promise<void>;
export declare function upgradeAuth(config: LedgerConfig['jwt'], database: Database.Database): Promise<LedgerConfig['jwt']>;
export declare function hashToken(token: string): string;
