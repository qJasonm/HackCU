// ============================================================
// @agent-ledger/mcp-server — Express Server Entry Point
// ============================================================

import express from 'express';
import cors from 'cors';
import { join } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import {
  initDatabase,
  initAuth,
  loadLedgerConfig,
  loadJanitorConfig,
  expireStaleLeases,
  promoteStarvedRequests,
  grantNextInQueue,
  markOrphanedEvents,
} from '@agent-ledger/core';
import { authMiddleware } from './middleware/auth.js';
import { authRoutes } from './routes/auth.js';
import { leaseRoutes } from './routes/lease.js';
import { ledgerRoutes } from './routes/ledger.js';
import { adminRoutes } from './routes/admin.js';
import { syncRoutes } from './routes/sync.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { ActiveTailService } from './services/active-tail.js';
import { AuditLogService } from './services/audit-log.js';

// ---- Init ----

const config = loadLedgerConfig();
const janitorConfig = loadJanitorConfig();

// Ensure .ledger directory exists
const ledgerDir = join(process.cwd(), '.ledger');
if (!existsSync(ledgerDir)) {
  mkdirSync(ledgerDir, { recursive: true });
}

const db = initDatabase(join(process.cwd(), config.storage.db_path));
await initAuth(config.jwt);

// Services
const activeTail = new ActiveTailService(config.storage.active_tail_size);
const auditLog = new AuditLogService(config.storage.audit_log_dir);

// ---- Express App ----

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Public routes (no auth required)
app.use('/auth', authRoutes(db, config));

// Protected routes
app.use('/lease', authMiddleware(db), leaseRoutes(db, config, activeTail));
app.use('/ledger', authMiddleware(db), ledgerRoutes(db, config, activeTail, auditLog));
app.use('/admin', authMiddleware(db), adminRoutes(db, config));
app.use('/sync', authMiddleware(db), syncRoutes(db));

// Dashboard (no auth — for live demo viewing)
const startTime = Date.now();
app.use('/dashboard', dashboardRoutes(db, startTime));

// ---- Background Tasks ----

// Heartbeat expiry check — every 10 seconds
setInterval(() => {
  const expired = expireStaleLeases(db);
  for (const { lease, next_in_queue } of expired) {
    console.log(`[EXPIRE] Lease ${lease.lease_id} expired for agent ${lease.agent_id}`);
    if (next_in_queue) {
      const granted = grantNextInQueue(lease.resource, db);
      if (granted) {
        console.log(`[GRANT] Queued lease ${granted.lease_id} granted to ${granted.agent_id}`);
      }
    }
  }
}, 10000);

// Starvation prevention — every 60 seconds
setInterval(() => {
  const promoted = promoteStarvedRequests(config.lease.queue_timeout_ms, db);
  for (const entry of promoted) {
    console.log(`[PROMOTE] Queue entry ${entry.request_id} promoted to P0 (starvation prevention)`);
  }
}, 60000);

// Orphan detection — every 5 minutes
setInterval(() => {
  const agents = db.prepare('SELECT agent_id FROM agents').all() as { agent_id: string }[];
  for (const agent of agents) {
    const orphaned = markOrphanedEvents(agent.agent_id, db);
    if (orphaned > 0) {
      console.log(`[ORPHAN] Marked ${orphaned} orphaned events for agent ${agent.agent_id}`);
    }
  }
}, 300000);

// ---- Start ----

const port = config.server.port;
const host = config.server.host;

app.listen(port, host, () => {
  console.log(`🔒 Agent Ledger MCP Server running on http://${host}:${port}`);
  console.log(`   JWT Mode: ${config.jwt.mode.toUpperCase()}`);
  console.log(`   DB: ${config.storage.db_path}`);
});

export { app, db, config };
