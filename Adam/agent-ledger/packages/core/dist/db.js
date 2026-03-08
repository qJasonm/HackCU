// ============================================================
// @agent-ledger/core — SQLite Database Layer
// ============================================================
import Database from 'better-sqlite3';
import { join } from 'node:path';
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS agents (
  agent_id       TEXT PRIMARY KEY,
  tier           TEXT NOT NULL CHECK(tier IN ('orchestrator','worker','observer','human')),
  session_id     TEXT UNIQUE NOT NULL,
  token_hash     TEXT NOT NULL,
  registered_at  INTEGER NOT NULL,
  last_heartbeat INTEGER
);

CREATE TABLE IF NOT EXISTS leases (
  lease_id       TEXT PRIMARY KEY,
  agent_id       TEXT NOT NULL REFERENCES agents(agent_id),
  resource       TEXT NOT NULL,
  scope          TEXT NOT NULL CHECK(scope IN ('file','symbol','region')),
  line_start     INTEGER,
  line_end       INTEGER,
  status         TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','queued','released')),
  priority       INTEGER NOT NULL DEFAULT 2,
  granted_at     INTEGER,
  expires_at     INTEGER,
  correlation_id TEXT
);

CREATE TABLE IF NOT EXISTS events (
  event_id        TEXT PRIMARY KEY,
  parent_event_id TEXT REFERENCES events(event_id),
  correlation_id  TEXT NOT NULL,
  agent_id        TEXT NOT NULL REFERENCES agents(agent_id),
  agent_token_tier TEXT NOT NULL,
  type            TEXT NOT NULL,
  resource        TEXT,
  lease_scope     TEXT,
  intent          TEXT,
  ground_truth    TEXT,
  tree_depth      INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending',
  created_at      INTEGER NOT NULL,
  completed_at    INTEGER
);

CREATE TABLE IF NOT EXISTS revoked_sessions (
  session_id  TEXT PRIMARY KEY,
  agent_id    TEXT NOT NULL,
  revoked_at  INTEGER NOT NULL,
  reason      TEXT
);

CREATE TABLE IF NOT EXISTS milestones (
  milestone_id TEXT PRIMARY KEY,
  description  TEXT NOT NULL,
  trigger      TEXT NOT NULL,
  summary      TEXT,
  created_at   INTEGER NOT NULL,
  embedding    BLOB
);

CREATE TABLE IF NOT EXISTS lease_queue (
  request_id   TEXT PRIMARY KEY,
  agent_id     TEXT NOT NULL,
  resource     TEXT NOT NULL,
  scope        TEXT NOT NULL,
  line_start   INTEGER,
  line_end     INTEGER,
  priority     INTEGER NOT NULL DEFAULT 2,
  queued_at    INTEGER NOT NULL,
  promoted_at  INTEGER
);

CREATE TABLE IF NOT EXISTS external_edits (
  event_id     TEXT PRIMARY KEY,
  resource     TEXT NOT NULL,
  change_start INTEGER NOT NULL,
  change_end   INTEGER NOT NULL,
  detected_at  INTEGER NOT NULL,
  detected_by  TEXT NOT NULL,
  resolved     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sync_acks (
  event_id        TEXT NOT NULL,
  agent_id        TEXT NOT NULL,
  acknowledged_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, agent_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_leases_resource ON leases(resource, status);
CREATE INDEX IF NOT EXISTS idx_leases_agent ON leases(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_events_correlation ON events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_events_agent ON events(agent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_parent ON events(parent_event_id);
CREATE INDEX IF NOT EXISTS idx_lease_queue_priority ON lease_queue(resource, priority, queued_at);
CREATE INDEX IF NOT EXISTS idx_revoked_session_agent ON revoked_sessions(agent_id);
`;
let dbInstance = null;
export function initDatabase(dbPath) {
    const resolvedPath = dbPath || join(process.cwd(), '.ledger', 'ledger.db');
    const db = new Database(resolvedPath);
    // Enable WAL mode for better concurrent read performance
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    // Run schema
    db.exec(SCHEMA_SQL);
    dbInstance = db;
    return db;
}
export function getDatabase() {
    if (!dbInstance) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return dbInstance;
}
export function closeDatabase() {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
    }
}
export function insertAgent(db) {
    return db.prepare(`
    INSERT INTO agents (agent_id, tier, session_id, token_hash, registered_at, last_heartbeat)
    VALUES (@agent_id, @tier, @session_id, @token_hash, @registered_at, @last_heartbeat)
  `);
}
export function getAgentById(db) {
    return db.prepare('SELECT * FROM agents WHERE agent_id = ?');
}
export function getAgentBySessionId(db) {
    return db.prepare('SELECT * FROM agents WHERE session_id = ?');
}
export function updateAgentHeartbeat(db) {
    return db.prepare('UPDATE agents SET last_heartbeat = ? WHERE agent_id = ?');
}
export function insertLease(db) {
    return db.prepare(`
    INSERT INTO leases (lease_id, agent_id, resource, scope, line_start, line_end, status, priority, granted_at, expires_at, correlation_id)
    VALUES (@lease_id, @agent_id, @resource, @scope, @line_start, @line_end, @status, @priority, @granted_at, @expires_at, @correlation_id)
  `);
}
export function getActiveLeasesByResource(db) {
    return db.prepare("SELECT * FROM leases WHERE resource = ? AND status = 'active'");
}
export function getActiveLeasesByAgent(db) {
    return db.prepare("SELECT * FROM leases WHERE agent_id = ? AND status = 'active'");
}
export function updateLeaseStatus(db) {
    return db.prepare('UPDATE leases SET status = ? WHERE lease_id = ?');
}
export function updateLeaseRange(db) {
    return db.prepare('UPDATE leases SET line_start = ?, line_end = ? WHERE lease_id = ?');
}
export function insertEvent(db) {
    return db.prepare(`
    INSERT INTO events (event_id, parent_event_id, correlation_id, agent_id, agent_token_tier, type, resource, lease_scope, intent, ground_truth, tree_depth, status, created_at, completed_at)
    VALUES (@event_id, @parent_event_id, @correlation_id, @agent_id, @agent_token_tier, @type, @resource, @lease_scope, @intent, @ground_truth, @tree_depth, @status, @created_at, @completed_at)
  `);
}
export function getEventById(db) {
    return db.prepare('SELECT * FROM events WHERE event_id = ?');
}
export function getEventsByCorrelationId(db) {
    return db.prepare('SELECT * FROM events WHERE correlation_id = ? ORDER BY created_at ASC');
}
export function getLatestEventsByAgent(db) {
    return db.prepare('SELECT * FROM events WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?');
}
export function updateEventStatus(db) {
    return db.prepare('UPDATE events SET status = ?, completed_at = ? WHERE event_id = ?');
}
export function updateEventGroundTruth(db) {
    return db.prepare('UPDATE events SET ground_truth = ?, status = ?, completed_at = ? WHERE event_id = ?');
}
export function insertRevokedSession(db) {
    return db.prepare(`
    INSERT INTO revoked_sessions (session_id, agent_id, revoked_at, reason)
    VALUES (@session_id, @agent_id, @revoked_at, @reason)
  `);
}
export function isSessionRevoked(db) {
    return db.prepare('SELECT 1 FROM revoked_sessions WHERE session_id = ?');
}
export function insertMilestone(db) {
    return db.prepare(`
    INSERT INTO milestones (milestone_id, description, trigger, summary, created_at, embedding)
    VALUES (@milestone_id, @description, @trigger, @summary, @created_at, @embedding)
  `);
}
export function insertLeaseQueueEntry(db) {
    return db.prepare(`
    INSERT INTO lease_queue (request_id, agent_id, resource, scope, line_start, line_end, priority, queued_at, promoted_at)
    VALUES (@request_id, @agent_id, @resource, @scope, @line_start, @line_end, @priority, @queued_at, @promoted_at)
  `);
}
export function getQueuedRequestsByResource(db) {
    return db.prepare('SELECT * FROM lease_queue WHERE resource = ? ORDER BY priority ASC, queued_at ASC');
}
export function removeQueueEntry(db) {
    return db.prepare('DELETE FROM lease_queue WHERE request_id = ?');
}
export function getStaleQueueEntries(db) {
    return db.prepare('SELECT * FROM lease_queue WHERE queued_at < ? AND priority > 0');
}
export function promoteQueueEntry(db) {
    return db.prepare('UPDATE lease_queue SET priority = 0, promoted_at = ? WHERE request_id = ?');
}
export function insertExternalEdit(db) {
    return db.prepare(`
    INSERT INTO external_edits (event_id, resource, change_start, change_end, detected_at, detected_by, resolved)
    VALUES (@event_id, @resource, @change_start, @change_end, @detected_at, @detected_by, 0)
  `);
}
export function getUnresolvedExternalEdits(db) {
    return db.prepare("SELECT * FROM external_edits WHERE resolved = 0 AND resource = ?");
}
export function insertSyncAck(db) {
    return db.prepare(`
    INSERT OR IGNORE INTO sync_acks (event_id, agent_id, acknowledged_at)
    VALUES (@event_id, @agent_id, @acknowledged_at)
  `);
}
export function getSyncAcks(db) {
    return db.prepare('SELECT * FROM sync_acks WHERE event_id = ?');
}
//# sourceMappingURL=db.js.map