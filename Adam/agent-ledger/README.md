# 🔒 Agent Ledger

**Persistent Multi-Agent Coordination & Long-Term Memory Framework**

Agent Ledger provides a protocol-level coordination layer for AI agents working on shared codebases. It ensures agents don't overwrite each other's work, maintains a complete audit trail of all actions, and provides long-term memory that persists across sessions.

## Architecture

```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  VS Code Ext │  │  CLI Client  │  │  Agent SDK   │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       └─────────────────┼─────────────────┘
                         │ HTTP/REST
              ┌──────────┴──────────┐
              │   MCP Server        │
              │  ┌───────────────┐  │
              │  │ Auth (JWT)    │  │
              │  │ Lease Manager │  │
              │  │ Event Tree    │  │
              │  │ Active Tail   │  │
              │  │ Audit Log     │  │
              │  └───────┬───────┘  │
              │          │          │
              │  ┌───────┴───────┐  │
              │  │  SQLite (WAL) │  │
              │  └───────────────┘  │
              └─────────────────────┘
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start the server
node packages/mcp-server/dist/index.js

# In another terminal — register an agent
node packages/cli/dist/index.js register -a my-agent -t worker

# Execute a coordinated action
node packages/cli/dist/index.js exec -a my-agent -r src/app.ts -i "Add auth" --result '{"action":"done"}'

# Check system status
node packages/cli/dist/index.js status -a my-agent
```

## Packages

| Package | Description |
|---------|-------------|
| `@agent-ledger/core` | Shared types, SQLite layer, JWT auth, lease management, event tree |
| `@agent-ledger/mcp-server` | Express REST API server with all endpoints |
| `@agent-ledger/cli` | Commander.js CLI for agent interaction |
| `@agent-ledger/vscode-extension` | VS Code extension with file watcher and sidebar |

## Key Features

- **Lease-Based File Locking** — Agents acquire file/symbol/region leases before editing. Conflicts are queued with priority-based resolution.
- **Hierarchical Event Tree** — Events form parent-child trees with correlation IDs, cycle detection, and depth limiting.
- **Dual JWT Authentication** — Starts with HS256 for simplicity, upgradeable to RS256 for production.
- **Trust Tiers** — Orchestrator, Worker, Observer, Human — each with different permissions and lease limits.
- **Unauthorized Edit Detection** — VS Code extension detects external edits and triggers sync protocol (freeze → broadcast → acknowledge).
- **Append-Only Audit Log** — Every action is logged to monthly Markdown files.
- **Active Tail** — Per-agent in-memory ring buffer for fast context retrieval.

## API Endpoints

### Auth
- `POST /auth/register` — Register agent, receive JWT
- `GET /auth/public-key` — Get RS256 public key

### Lease
- `POST /lease/acquire` — Request a file lease
- `POST /lease/release` — Release a lease
- `POST /lease/escalate` — Expand lease scope
- `POST /lease/heartbeat` — Keep lease alive

### Ledger
- `POST /ledger/report-intent` — Log intent before action
- `POST /ledger/report-action` — Log ground truth after action
- `GET /ledger/latest` — Get latest entries
- `GET /ledger/query` — Search events
- `POST /ledger/milestone` — Declare milestone

### Admin
- `POST /admin/revoke-session` — Revoke a session
- `POST /admin/revoke-agent` — Revoke all agent sessions
- `POST /admin/rotate-key` — Nuclear key rotation
- `POST /admin/upgrade-auth` — Migrate HS256 → RS256
- `GET /admin/status` — System overview

### Sync
- `POST /sync/notify-external-edit` — Report unauthorized edit
- `POST /sync/acknowledge` — Acknowledge sync
- `GET /sync/pending` — Check pending sync requirements

## Configuration

Place `ledger_config.json` and `janitor_config.json` in your project root. See `packages/core/src/config.ts` for defaults.

## Team

Built at HackCU 2025 by Team Adam.
