# 🔒 Agent Ledger

**Persistent Multi-Agent Coordination & Long-Term Memory Framework**

Agent Ledger provides a protocol-level coordination layer for AI agents working on shared codebases. It prevents agents from overwriting each other's work, maintains a complete audit trail, and provides long-term memory across sessions.

## Quick Start

```bash
pnpm install && pnpm build
node packages/mcp-server/dist/index.js    # Start server on :3000
open http://localhost:3000/dashboard       # Live dashboard
bash demo.sh                              # Run multi-agent demo
```

> Full setup guide: **[QUICKSTART.md](./QUICKSTART.md)** — install, VS Code/Copilot config, curl commands, CLI usage

## Architecture

```
  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
  │  VS Code Ext │   │  CLI Client  │   │  MCP Bridge  │
  │ (file watch) │   │ (commands)   │   │ (AI agents)  │
  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
         └──────────────────┼──────────────────┘
                            │ HTTP / MCP stdio
                 ┌──────────┴──────────┐
                 │   MCP Server (:3000) │
                 │  ┌───────────────┐   │
                 │  │ JWT Auth      │   │
                 │  │ Lease Manager │   │
                 │  │ Event Tree    │   │
                 │  │ Active Tail   │   │
                 │  │ Audit Log     │   │
                 │  │ Dashboard     │   │
                 │  └───────┬───────┘   │
                 │  ┌───────┴───────┐   │
                 │  │  SQLite (WAL) │   │
                 │  └───────────────┘   │
                 └──────────────────────┘
```

## Packages

| Package | Description |
|---------|-------------|
| `@agent-ledger/core` | Types, SQLite, JWT auth, lease management, event tree, config |
| `@agent-ledger/mcp-server` | Express REST API + MCP stdio bridge + dashboard |
| `@agent-ledger/cli` | Commander.js CLI (register, exec, read, milestone, revoke, status) |
| `@agent-ledger/vscode-extension` | File watcher, sync protocol, sidebar webview |

## Key Features

- **Lease-Based File Locking** — Agents lock files before editing. Conflicts are queued with priority-based auto-resolution.
- **Event Tree** — Hierarchical event tracking with correlation IDs, cycle detection, and depth limiting.
- **12 MCP Tools** — AI agents call `ledger_acquire_lease`, `ledger_report_intent`, etc. as native tools.
- **Real-Time Dashboard** — Live view of agents, leases, events, and milestones at `/dashboard`.
- **Trust Tiers** — Orchestrator (admin), Worker (edit), Observer (read-only), Human (trusted).
- **Unauthorized Edit Detection** — VS Code extension detects external edits → freeze → broadcast → acknowledge.
- **Append-Only Audit Log** — Monthly Markdown audit files in `.ledger/logs/`.

## VS Code + Copilot Integration

1. Create `.vscode/mcp.json` in your project:
```json
{
  "servers": {
    "agent-ledger": {
      "type": "stdio",
      "command": "node",
      "args": ["<path-to>/agent-ledger/packages/mcp-server/dist/mcp/bridge.js"],
      "env": { "LEDGER_SERVER_URL": "http://localhost:3000" }
    }
  }
}
```

2. Create `.github/copilot-instructions.md` with coordination rules (see [QUICKSTART.md](./QUICKSTART.md))

3. Reload VS Code → register via Copilot Chat → agents auto-coordinate

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/health` | GET | No | Health check |
| `/dashboard` | GET | No | Live web dashboard |
| `/auth/register` | POST | No | Register agent, get JWT |
| `/lease/acquire` | POST | Yes | Lock a file |
| `/lease/release` | POST | Yes | Unlock a file |
| `/lease/heartbeat` | POST | Yes | Keep lease alive |
| `/lease/escalate` | POST | Yes | Expand lease scope |
| `/ledger/report-intent` | POST | Yes | Log intent |
| `/ledger/report-action` | POST | Yes | Log result |
| `/ledger/latest` | GET | Yes | Recent entries |
| `/ledger/query` | GET | Yes | Search events |
| `/ledger/milestone` | POST | Yes | Declare milestone |
| `/sync/notify-external-edit` | POST | Yes | Report unauthorized edit |
| `/sync/acknowledge` | POST | Yes | Acknowledge sync |
| `/sync/pending` | GET | Yes | Check pending syncs |
| `/admin/status` | GET | Yes | System overview |
| `/admin/revoke-session` | POST | Yes | Revoke session (admin) |
| `/admin/revoke-agent` | POST | Yes | Revoke agent (admin) |
| `/admin/rotate-key` | POST | Yes | Rotate JWT keys (admin) |

## MCP Tools (for AI Agents)

| Tool | Purpose |
|------|---------|
| `ledger_register` | Register and get token |
| `ledger_acquire_lease` | Lock a file before editing |
| `ledger_release_lease` | Unlock when done |
| `ledger_heartbeat` | Keep lease alive |
| `ledger_report_intent` | Log what you plan to do |
| `ledger_report_action` | Log what you did |
| `ledger_read_history` | Read recent entries |
| `ledger_search` | Search events |
| `ledger_status` | System overview |
| `ledger_declare_milestone` | Mark a milestone |
| `ledger_check_sync` | Check external edit notifications |
| `ledger_acknowledge_sync` | Acknowledge external edits |

## Configuration

Place `ledger_config.json` in your project root to override defaults:

```json
{
  "server": { "port": 3000, "host": "0.0.0.0" },
  "jwt": { "mode": "hs256" },
  "lease": { "ttl_ms": 300000, "heartbeat_interval_ms": 60000 },
  "storage": { "db_path": ".ledger/ledger.db" }
}
```

## Team

Built at HackCU 2025 by Team Adam.
