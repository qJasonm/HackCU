# 🚀 Quick Start Guide

Get AI agents coordinating on your project in under 10 minutes.

---

## How It Works

Agent Ledger is a **standalone server** that runs in the background. Your project connects to it — you don't copy any files into your codebase.

```
Your Project (VS Code)  ──→  Agent Ledger Server (localhost:3000)  ──→  SQLite DB
```

---

## Part 1: Automated Setup (Recommended)

One command does everything — clones the repo, installs dependencies, builds, and configures your project:

```bash
# From inside your project directory:
git clone https://github.com/qJasonm/HackCU /tmp/agent-ledger-install
bash /tmp/agent-ledger-install/Adam/agent-ledger/setup.sh .
```

This will:
- ✅ Check Node.js and pnpm are installed
- ✅ Clone & build the agent-ledger server to `~/.agent-ledger`
- ✅ Create `.vscode/mcp.json` in your project (MCP config for Copilot)
- ✅ Create `.github/copilot-instructions.md` (auto-coordination rules)
- ✅ Add `.ledger/` to your `.gitignore`

Then start the server from your project directory:

```bash
node ~/.agent-ledger/Adam/agent-ledger/packages/mcp-server/dist/index.js
```

> 💡 **Each project gets its own ledger.** The database (`.ledger/`) is created wherever you start the server from. To reset, just delete the `.ledger/` folder and restart.

---

## Part 1 (Alternative): Manual Setup

If you prefer to do it step by step:

### 1. Clone & build the server

```bash
git clone https://github.com/qJasonm/HackCU ~/.agent-ledger
cd ~/.agent-ledger/Adam/agent-ledger
npm install -g pnpm
pnpm install
pnpm build
```

### 2. Start the server from your project directory

```bash
cd /path/to/your-project
node ~/.agent-ledger/Adam/agent-ledger/packages/mcp-server/dist/index.js
```

You'll see:
```
🔒 Agent Ledger MCP Server running on http://0.0.0.0:3000
   DB: .ledger/ledger.db     ← created inside YOUR project
```

**Leave this terminal open.**

### 3. Verify it works

Open **http://localhost:3000/dashboard** in your browser.

### 4. (Optional) Run the demo

In a second terminal:
```bash
cd ~/.agent-ledger/Adam/agent-ledger
bash demo.sh
```

Watch the dashboard fill up with agents, leases, and events.


## Part 2: Connect Your Project

> If you used `setup.sh`, this is already done — skip to Part 3.

These steps happen inside **your own project** — not the agent-ledger repo.

### 1. Create `.vscode/mcp.json`

In your project root, create this file:

```json
{
  "servers": {
    "agent-ledger": {
      "type": "stdio",
      "command": "node",
      "args": [
        "~/.agent-ledger/Adam/agent-ledger/packages/mcp-server/dist/mcp/bridge.js"
      ],
      "env": {
        "LEDGER_SERVER_URL": "http://localhost:3000"
      }
    }
  }
}
```

> ⚠️ **Replace `/absolute/path/to/agent-ledger`** with the actual path where you cloned the server (e.g. `/home/you/agent-ledger`).

### 2. Create `.github/copilot-instructions.md`

This tells your AI agent to use the ledger automatically:

```markdown
You have access to Agent Ledger MCP tools for multi-agent file coordination.

MANDATORY PROTOCOL for EVERY file edit:
1. Call `ledger_acquire_lease` with the file path and scope "file"
2. If queued (not granted), work on a different file instead
3. Call `ledger_report_intent` with what you plan to do
4. Make your edits
5. Call `ledger_report_action` with what you changed
6. Call `ledger_release_lease` when done
```

### 3. Reload VS Code

Press **Ctrl+Shift+P** → **"Developer: Reload Window"**

### 4. Register your agent

In Copilot Chat:

> *"Call ledger_register with agent_id 'copilot-1' and tier 'worker'"*

Check the dashboard — your agent should appear.

### 5. Start working

Give Copilot a task as normal. It will now coordinate through the ledger automatically:

> *"Create a new file called src/hello.ts with a hello world function"*

Watch the dashboard — you'll see the lease, intent, action, and release happen in real time.

---

## Part 3: Manually Querying the Ledger

You can interact with the ledger directly from any terminal using `curl`. All commands hit `http://localhost:3000`.

### Register & Get a Token

```bash
curl -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"agent_id": "my-agent", "tier": "worker"}'

# Save the token from the response:
export TOKEN="paste-your-token-here"
```

### Lock a File

```bash
curl -X POST http://localhost:3000/lease/acquire \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"resource": "src/app.ts", "scope": "file"}'
```

If `"granted": true` → you have the lock. Save the `lease_id`.
If `"granted": false` → another agent has it. You're queued.

### Log Intent → Edit → Log Result → Release

```bash
# 1. Log what you're about to do
curl -X POST http://localhost:3000/ledger/report-intent \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"resource": "src/app.ts", "intent": "Add login validation"}'
# Save the event_id from the response

# 2. (Make your changes to the file)

# 3. Log what you actually did
curl -X POST http://localhost:3000/ledger/report-action \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"event_id": "YOUR_EVENT_ID", "ground_truth": {"action": "Added input sanitization", "exit_code": 0}}'

# 4. Unlock the file
curl -X POST http://localhost:3000/lease/release \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"lease_id": "YOUR_LEASE_ID"}'
```

### Query the Ledger

```bash
# Latest entries for an agent
curl "http://localhost:3000/ledger/latest?agent_id=my-agent&count=10" \
  -H "Authorization: Bearer $TOKEN"

# Search events by keyword
curl "http://localhost:3000/ledger/query?q=authentication&limit=20" \
  -H "Authorization: Bearer $TOKEN"

# System status overview
curl http://localhost:3000/admin/status \
  -H "Authorization: Bearer $TOKEN"

# Declare a milestone
curl -X POST http://localhost:3000/ledger/milestone \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"description": "v1.0 API complete"}'
```

### Sync & External Edits

```bash
# Check for pending sync notifications
curl http://localhost:3000/sync/pending \
  -H "Authorization: Bearer $TOKEN"

# Acknowledge an external edit
curl -X POST http://localhost:3000/sync/acknowledge \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"event_id": "ext-XXXXXXXX"}'
```

---

## Your Project Structure

After setup, your project should have these two extra files:

```
your-project/
├── .vscode/
│   └── mcp.json                   ← MCP server config (points to agent-ledger)
├── .github/
│   └── copilot-instructions.md    ← Auto-coordination rules
├── src/
│   └── ...                        ← Your actual code
└── ...
```

That's it. The agent-ledger server runs separately — no dependencies added to your project.
