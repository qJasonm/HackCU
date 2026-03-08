# The Agent Ledger — HackCU Build Plan

> **Team**: 4 people · **Timeline**: ~10 hours · **Goal**: Deployable demo of the full framework

---

## Tech Stack

| Component | Technology | Rationale |
|---|---|---|
| **Monorepo** | TypeScript + pnpm workspaces | Shared types across all components, one language for the whole team |
| **MCP Server** | Node.js + Express + better-sqlite3 | Fast SQLite access, native MCP SDK available in TS |
| **VS Code Extension** | TypeScript (VS Code API) | Standard; can query LSP directly |
| **Ledger CLI** | TypeScript + Commander.js | Shares core lib with MCP server |
| **Symbol Parsing** | tree-sitter (via `node-tree-sitter`) | Headless AST-based symbol resolution |
| **Auth** | jose (JWT library) | Supports HS256 + RS256, zero native deps |
| **Vector Search** | sqlite-vss or basic cosine similarity | Semantic retrieval layer |
| **Embedding** | OpenAI `text-embedding-3-small` or local | For vector DB population |

---

## Monorepo Structure

```
HackCU/Adam/agent-ledger/
├── packages/
│   ├── core/                  # Shared types, DB schemas, utilities
│   │   ├── src/
│   │   │   ├── types.ts       # All shared interfaces & enums
│   │   │   ├── db.ts          # SQLite schema + migrations
│   │   │   ├── auth.ts        # JWT signing/verification, session blacklist
│   │   │   ├── lease.ts       # Lease data structures & interval logic
│   │   │   ├── config.ts      # Config loading (ledger_config.json)
│   │   │   └── events.ts      # Event tree types & cycle detection
│   │   └── package.json
│   │
│   ├── mcp-server/            # MCP Server — the brain
│   │   ├── src/
│   │   │   ├── index.ts       # Server entry point
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts    # /auth/register, /auth/public-key
│   │   │   │   ├── lease.ts   # /lease/acquire, /lease/release, /lease/escalate
│   │   │   │   ├── ledger.ts  # /ledger/report, /ledger/query, /ledger/latest
│   │   │   │   └── admin.ts   # /admin/revoke-session, /admin/rotate-key
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts    # JWT verification + session blacklist check
│   │   │   ├── services/
│   │   │   │   ├── lease-manager.ts    # Core lease logic, queue, heartbeat
│   │   │   │   ├── event-tree.ts       # Hierarchical events, cycle detection
│   │   │   │   ├── symbol-resolver.ts  # tree-sitter integration
│   │   │   │   ├── vector-store.ts     # SQLite-VSS + temporal decay
│   │   │   │   ├── janitor.ts          # BYOLLM summarization engine
│   │   │   │   └── active-tail.ts      # Per-agent in-memory buffer
│   │   │   └── mcp/
│   │   │       └── tools.ts   # MCP tool definitions (check, lease, act, report)
│   │   └── package.json
│   │
│   ├── vscode-extension/      # VS Code Extension — the observer
│   │   ├── src/
│   │   │   ├── extension.ts   # Activation, commands, status bar
│   │   │   ├── lsp-bridge.ts  # LSP documentSymbol queries
│   │   │   ├── file-watcher.ts # onDidChangeTextDocument handler
│   │   │   ├── unauthorized-detector.ts # External edit detection
│   │   │   ├── ledger-client.ts # HTTP client talking to MCP server
│   │   │   └── sidebar.ts     # Webview sidebar for lease/entry visualization
│   │   └── package.json
│   │
│   └── cli/                   # Ledger CLI — headless interface
│       ├── src/
│       │   ├── index.ts       # CLI entry point (Commander.js)
│       │   ├── commands/
│       │   │   ├── exec.ts    # ledger-agent exec --intent "..." "cmd"
│       │   │   ├── read.ts    # ledger-agent read --last N
│       │   │   ├── milestone.ts # ledger-agent milestone "description"
│       │   │   ├── revoke.ts  # ledger revoke-session / revoke-agent
│       │   │   └── upgrade-auth.ts # ledger upgrade-auth
│       │   └── client.ts     # Shared HTTP client for server communication
│       └── package.json
│
├── config/
│   ├── ledger_config.example.json
│   └── janitor_config.example.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

---

## Build Phases (Hour-by-Hour)

### Phase 1: Foundation (Hours 0–3)

**Goal**: Core library + working MCP Server with basic auth and file-level leasing.

| Task | Owner | Est. |
|---|---|---|
| Set up monorepo (pnpm workspaces, tsconfig, shared deps) | Person 1 | 30m |
| `core/` — Types, config loader, SQLite schema + migrations | Person 1 | 1h |
| `core/` — JWT auth (HS256/RS256 dual mode), session blacklist | Person 2 | 1.5h |
| `mcp-server/` — Express server scaffold, auth middleware | Person 2 | 1h |
| `mcp-server/` — Auth routes (register, public-key) | Person 2 | 30m |
| `mcp-server/` — Basic lease manager (file-level only) | Person 3 | 2h |
| `mcp-server/` — Ledger routes (report_intent, report_action, get_latest) | Person 4 | 2h |
| `mcp-server/` — Active Tail (in-memory per-agent buffer) | Person 4 | 1h |

**Checkpoint**: Server starts, accepts agent registration, issues JWTs, handles file-level leases, logs intents/actions.

---

### Phase 2: Intelligence (Hours 3–6)

**Goal**: Symbol-level leasing, event trees, vector search, CLI.

| Task | Owner | Est. |
|---|---|---|
| `mcp-server/` — tree-sitter symbol resolver | Person 1 | 2h |
| `mcp-server/` — Symbol + region lease support, interval overlap | Person 3 | 2h |
| `mcp-server/` — Lease escalation + priority queue (P0/P1/P2) | Person 3 | 1h |
| `mcp-server/` — Event tree (hierarchical entries, cycle detection, depth limit) | Person 4 | 2h |
| `mcp-server/` — Vector store (SQLite-VSS + temporal decay) | Person 1 | 1.5h |
| `cli/` — Commander.js scaffold + exec, read, milestone commands | Person 2 | 2h |
| `cli/` — revoke-session, revoke-agent, rotate-key, upgrade-auth | Person 2 | 1h |

**Checkpoint**: Agents can acquire symbol-level leases, tree-sitter resolves symbols, CLI can interact with server, events form trees.

---

### Phase 3: Observer (Hours 6–8)

**Goal**: VS Code Extension as a passive observer + unauthorized edit detection.

| Task | Owner | Est. |
|---|---|---|
| `vscode-extension/` — Extension scaffold, activation | Person 4 | 30m |
| `vscode-extension/` — LSP bridge (documentSymbol queries) | Person 4 | 1h |
| `vscode-extension/` — File watcher + unauthorized edit detection | Person 4 | 1h |
| `vscode-extension/` — Ledger client (talks to MCP server via HTTP) | Person 2 | 30m |
| `mcp-server/` — Unauthorized action detection, freeze, broadcast, ack protocol | Person 3 | 1.5h |
| `mcp-server/` — BYOLLM Janitor (cloud mode — Anthropic/OpenAI) | Person 1 | 1.5h |
| `mcp-server/` — Milestone triggers + Janitor scheduling | Person 1 | 30m |

**Checkpoint**: Extension detects edits, queries LSP for symbols, flags unauthorized changes. Janitor can summarize via cloud LLM.

---

### Phase 4: Polish & Demo (Hours 8–10)

**Goal**: MCP tool wrappers, integration testing, demo scenario, README.

| Task | Owner | Est. |
|---|---|---|
| `mcp-server/` — MCP tool definitions (check, lease, act, report) | Person 1 | 1h |
| `vscode-extension/` — Status bar + sidebar webview | Person 4 | 1h |
| Integration test: multi-agent lease conflict scenario | Person 3 | 1h |
| Integration test: unauthorized edit → freeze → ack flow | Person 3 | 30m |
| `cli/` — Demo script (scripted multi-agent interaction) | Person 2 | 1h |
| Audit log export (`agent_log_YYYY-MM.md` generation) | Person 1 | 30m |
| README.md + demo recording | Person 2 | 30m |
| Bug fixes and hardening | All | 30m |

**Checkpoint**: Full working demo — MCP server running, CLI agents interacting, VS Code extension observing, leases enforced, Janitor summarizing.

---

## Database Schema (SQLite)

```sql
-- Core tables
CREATE TABLE agents (
  agent_id    TEXT PRIMARY KEY,
  tier        TEXT NOT NULL CHECK(tier IN ('orchestrator','worker','observer','human')),
  session_id  TEXT UNIQUE NOT NULL,
  token_hash  TEXT NOT NULL,
  registered_at INTEGER NOT NULL,
  last_heartbeat INTEGER
);

CREATE TABLE leases (
  lease_id    TEXT PRIMARY KEY,
  agent_id    TEXT NOT NULL REFERENCES agents(agent_id),
  resource    TEXT NOT NULL,
  scope       TEXT NOT NULL CHECK(scope IN ('file','symbol','region')),
  line_start  INTEGER,
  line_end    INTEGER,
  status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','queued','released')),
  priority    INTEGER NOT NULL DEFAULT 2,
  granted_at  INTEGER,
  expires_at  INTEGER,
  correlation_id TEXT
);

CREATE TABLE events (
  event_id        TEXT PRIMARY KEY,
  parent_event_id TEXT REFERENCES events(event_id),
  correlation_id  TEXT NOT NULL,
  agent_id        TEXT NOT NULL REFERENCES agents(agent_id),
  type            TEXT NOT NULL,
  resource        TEXT,
  lease_scope     TEXT,
  intent          TEXT,
  ground_truth    TEXT, -- JSON
  tree_depth      INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'pending',
  created_at      INTEGER NOT NULL,
  completed_at    INTEGER
);

CREATE TABLE revoked_sessions (
  session_id  TEXT PRIMARY KEY,
  agent_id    TEXT NOT NULL,
  revoked_at  INTEGER NOT NULL,
  reason      TEXT
);

CREATE TABLE milestones (
  milestone_id TEXT PRIMARY KEY,
  description  TEXT NOT NULL,
  trigger      TEXT NOT NULL,
  summary      TEXT,
  created_at   INTEGER NOT NULL,
  embedding    BLOB  -- for vector search
);

CREATE TABLE lease_queue (
  request_id    TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL,
  resource      TEXT NOT NULL,
  scope         TEXT NOT NULL,
  line_start    INTEGER,
  line_end      INTEGER,
  priority      INTEGER NOT NULL DEFAULT 2,
  queued_at     INTEGER NOT NULL,
  promoted_at   INTEGER
);
```

---

## Key API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/register` | Register agent, receive JWT |
| GET | `/auth/public-key` | Get RS256 public key (unauthenticated) |
| POST | `/lease/acquire` | Request a lease (file/symbol/region) |
| POST | `/lease/release` | Release a held lease |
| POST | `/lease/escalate` | Expand lease scope in-place |
| POST | `/lease/heartbeat` | Keep lease alive (30s interval) |
| POST | `/ledger/report-intent` | Log intent before action |
| POST | `/ledger/report-action` | Log ground truth after action |
| GET | `/ledger/latest` | Get latest N entries for an agent |
| GET | `/ledger/query` | Semantic search across history |
| POST | `/ledger/milestone` | Declare a milestone |
| POST | `/admin/revoke-session` | Revoke a specific session |
| POST | `/admin/revoke-agent` | Revoke all sessions for an agent |
| POST | `/admin/rotate-key` | Nuclear key rotation |
| POST | `/admin/upgrade-auth` | Migrate HS256 → RS256 |
| POST | `/sync/acknowledge` | Acknowledge external edit notification |

---

## Demo Scenario

For the hackathon demo, we'll showcase a scripted multi-agent conflict:

1. **Agent A** registers, acquires symbol lease on `src/auth.py::generate_token`
2. **Agent B** registers, tries to lease overlapping region → **QUEUED**
3. **Agent A** reports intent + action (edits the function)
4. **Human** makes an unauthorized edit in VS Code → **FREEZE** triggered
5. VS Code Extension detects the edit, flags `UNAUTHORIZED_EXTERNAL_ACTION`
6. **Agent A** receives `SYNC_REQUIRED`, acknowledges
7. **Freeze lifts**, Agent B's queued lease is granted
8. **Milestone** triggered after sufficient entries → Janitor summarizes
9. CLI shows full audit log with tree structure

This demonstrates: leasing, conflict resolution, unauthorized edit detection, the full Check-Lease-Act-Report cycle, and the Janitor.
