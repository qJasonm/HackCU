// ============================================================
// @agent-ledger/core — JWT Authentication & Session Management
// ============================================================

import { SignJWT, jwtVerify, importPKCS8, importSPKI, type KeyLike } from 'jose';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { generateKeyPairSync } from 'node:crypto';
import { nanoid } from 'nanoid';
import type Database from 'better-sqlite3';
import type { JWTPayload, TrustTier, JWTMode, LedgerConfig } from './types.js';
import { MAX_CONCURRENT_LEASES, TIER_SCOPES } from './types.js';
import * as db from './db.js';

// ---- Key Management ----

let signingKey: KeyLike | Uint8Array | null = null;
let verifyKey: KeyLike | Uint8Array | null = null;
let currentMode: JWTMode | null = null;

function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

export async function initAuth(config: LedgerConfig['jwt']): Promise<void> {
  currentMode = config.mode;
  const basePath = process.cwd();

  if (config.mode === 'hs256') {
    const secretPath = join(basePath, config.secret_path || '.ledger/secret.key');
    ensureDir(dirname(secretPath));

    if (!existsSync(secretPath)) {
      // Generate a random 256-bit secret
      const secret = randomBytes(32).toString('hex');
      writeFileSync(secretPath, secret, 'utf-8');
    }

    const secret = readFileSync(secretPath, 'utf-8').trim();
    const key = new TextEncoder().encode(secret);
    signingKey = key;
    verifyKey = key;
  } else {
    // RS256
    const privatePath = join(basePath, config.private_key_path || '.ledger/private.pem');
    const publicPath = join(basePath, config.public_key_path || '.ledger/public.pem');
    ensureDir(dirname(privatePath));

    if (!existsSync(privatePath) || !existsSync(publicPath)) {
      // Generate RSA keypair
      const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      writeFileSync(privatePath, privateKey as string);
      writeFileSync(publicPath, publicKey as string);
    }

    const privatePem = readFileSync(privatePath, 'utf-8');
    const publicPem = readFileSync(publicPath, 'utf-8');
    signingKey = await importPKCS8(privatePem, 'RS256');
    verifyKey = await importSPKI(publicPem, 'RS256');
  }
}

export function getPublicKey(config: LedgerConfig['jwt']): string | null {
  if (config.mode !== 'rs256') return null;
  const publicPath = join(process.cwd(), config.public_key_path || '.ledger/public.pem');
  if (!existsSync(publicPath)) return null;
  return readFileSync(publicPath, 'utf-8');
}

// ---- Token Generation ----

export async function generateToken(
  agentId: string,
  tier: TrustTier,
  expiryHours: number
): Promise<{ token: string; payload: JWTPayload }> {
  if (!signingKey || !currentMode) {
    throw new Error('Auth not initialized. Call initAuth() first.');
  }

  const now = Math.floor(Date.now() / 1000);
  const sessionId = `sess-${nanoid(8)}`;

  const payload: JWTPayload = {
    agent_id: agentId,
    tier,
    session_id: sessionId,
    issued_at: now,
    expires_at: now + expiryHours * 3600,
    max_concurrent_leases: MAX_CONCURRENT_LEASES[tier] === Infinity ? -1 : MAX_CONCURRENT_LEASES[tier],
    scope: TIER_SCOPES[tier],
    signing_mode: currentMode,
  };

  const alg = currentMode === 'hs256' ? 'HS256' : 'RS256';
  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg })
    .setIssuedAt(now)
    .setExpirationTime(payload.expires_at)
    .sign(signingKey);

  return { token, payload };
}

// ---- Token Verification ----

export async function verifyToken(token: string): Promise<JWTPayload> {
  if (!verifyKey || !currentMode) {
    throw new Error('Auth not initialized. Call initAuth() first.');
  }

  const alg = currentMode === 'hs256' ? 'HS256' : 'RS256';
  const { payload } = await jwtVerify(token, verifyKey, { algorithms: [alg] });
  return payload as unknown as JWTPayload;
}

// ---- Session Blacklist ----

export function checkSessionRevoked(sessionId: string, database: Database.Database): boolean {
  const result = db.isSessionRevoked(database).get(sessionId);
  return result !== undefined;
}

export function revokeSession(
  sessionId: string,
  agentId: string,
  reason: string,
  database: Database.Database
): void {
  db.insertRevokedSession(database).run({
    session_id: sessionId,
    agent_id: agentId,
    revoked_at: Math.floor(Date.now() / 1000),
    reason,
  });
}

export function revokeAgent(agentId: string, reason: string, database: Database.Database): void {
  // Find all active sessions for this agent, revoke them all
  const agent = db.getAgentById(database).get(agentId) as { session_id: string } | undefined;
  if (agent) {
    revokeSession(agent.session_id, agentId, reason, database);
  }
}

// ---- Key Rotation ----

export async function rotateKey(config: LedgerConfig['jwt'], database: Database.Database): Promise<void> {
  const basePath = process.cwd();

  if (config.mode === 'hs256') {
    const secretPath = join(basePath, config.secret_path || '.ledger/secret.key');
    const newSecret = randomBytes(32).toString('hex');
    writeFileSync(secretPath, newSecret, 'utf-8');
  } else {
    const privatePath = join(basePath, config.private_key_path || '.ledger/private.pem');
    const publicPath = join(basePath, config.public_key_path || '.ledger/public.pem');
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    writeFileSync(privatePath, privateKey as string);
    writeFileSync(publicPath, publicKey as string);
  }

  // Re-initialize with new keys
  await initAuth(config);

  // Note: all existing tokens are now invalid (signature won't verify)
}

export async function upgradeAuth(
  config: LedgerConfig['jwt'],
  database: Database.Database
): Promise<LedgerConfig['jwt']> {
  // Generate RS256 keypair
  const basePath = process.cwd();
  const privatePath = join(basePath, '.ledger/private.pem');
  const publicPath = join(basePath, '.ledger/public.pem');

  ensureDir(join(basePath, '.ledger'));
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  writeFileSync(privatePath, privateKey as string);
  writeFileSync(publicPath, publicKey as string);

  const newConfig: LedgerConfig['jwt'] = {
    ...config,
    mode: 'rs256' as JWTMode,
    private_key_path: '.ledger/private.pem',
    public_key_path: '.ledger/public.pem',
  };

  // Re-initialize
  await initAuth(newConfig);

  return newConfig;
}

// ---- Utility ----

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
