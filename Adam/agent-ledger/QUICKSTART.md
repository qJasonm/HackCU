# 🚀 Quick Start Guide

Get the Agent Ledger running in under 5 minutes.

## Prerequisites

- **Node.js** v20+ ([install](https://nodejs.org))
- **pnpm** (`npm install -g pnpm`)

## 1. Install & Build

```bash
cd Adam/agent-ledger
pnpm install
pnpm build
```

## 2. Start the Server

```bash
node packages/mcp-server/dist/index.js
```

You should see:
```
🔒 Agent Ledger MCP Server running on http://0.0.0.0:3000
   JWT Mode: HS256
   DB: .ledger/ledger.db
```

> **Leave this terminal open.** Open a new terminal for the steps below.

---

## 3. Register Your First Agent

Every agent needs a name and a trust tier. Tiers control what an agent can do:

| Tier | Can Do |
|------|--------|
| `orchestrator` | Everything (admin, leases, events) |
| `worker` | Leases + events (max 3 files at once) |
| `observer` | Read-only access |
| `human` | Full access, trusted edits |

```bash
curl -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"agent_id": "my-agent", "tier": "worker"}'
```

**Save the `token` from the response** — you'll need it for every request.

```bash
# Tip: save it to a variable
export TOKEN="paste-your-token-here"
```

## 4. Acquire a File Lease

Before editing a file, you must acquire a lease. This prevents other agents from editing the same file:

```bash
curl -X POST http://localhost:3000/lease/acquire \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"resource": "src/app.ts", "scope": "file"}'
```

If `"granted": true`, you own the lock. Save the `lease_id`.

If `"granted": false`, someone else has it — you're **queued** and will get it when they release.

```bash
export LEASE_ID="paste-your-lease-id-here"
```

## 5. Log What You're About to Do (Intent)

```bash
curl -X POST http://localhost:3000/ledger/report-intent \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"resource": "src/app.ts", "intent": "Add login endpoint"}'
```

Save the `event_id` from the response.

```bash
export EVENT_ID="paste-your-event-id-here"
```

## 6. Log What You Actually Did (Action)

After making your changes, report the ground truth:

```bash
curl -X POST http://localhost:3000/ledger/report-action \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"event_id\": \"$EVENT_ID\", \"ground_truth\": {\"action\": \"Added POST /login route\", \"exit_code\": 0}}"
```

## 7. Release the Lease

When you're done editing, release the lock so others can use the file:

```bash
curl -X POST http://localhost:3000/lease/release \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"lease_id\": \"$LEASE_ID\"}"
```

## 8. Check System Status

```bash
curl http://localhost:3000/admin/status \
  -H "Authorization: Bearer $TOKEN"
```

---

## Using the CLI (Alternative)

Instead of curl, you can use the built-in CLI:

```bash
# Register
node packages/cli/dist/index.js register -a my-agent -t worker

# Do everything in one command (acquire → intent → action → release)
node packages/cli/dist/index.js exec \
  -a my-agent \
  -r src/app.ts \
  -i "Add login endpoint" \
  --result '{"action": "Added POST /login route"}'

# Read your history
node packages/cli/dist/index.js read -a my-agent

# Check status
node packages/cli/dist/index.js status -a my-agent
```

---

## Run the Full Demo

To see everything working end-to-end with 3 agents:

```bash
bash demo.sh
```

---

## How It Works (30-Second Version)

```
1. Agent registers     → gets a JWT token
2. Agent acquires lease → locks a file so nobody else can edit it
3. Agent reports intent → "I'm about to do X"
4. Agent does the work  → (your code changes happen here)
5. Agent reports action → "I actually did Y" (with diff, exit code, etc.)
6. Agent releases lease → unlocks the file for others
```

If two agents try to lock the same file, the second one **waits in a queue** and gets the lock automatically when the first one releases.

That's it. Every action is logged, every conflict is resolved, and the full history is queryable.
