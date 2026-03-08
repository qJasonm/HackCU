# 🔌 Using Agent Ledger in VS Code with AI Agents

A step-by-step guide to using Agent Ledger to coordinate AI agents on a real project.

---

## Prerequisites

- The Agent Ledger server is running (`http://localhost:3000`)
- Your project is open in VS Code
- You have an MCP-compatible AI agent (Copilot, Claude, Gemini, etc.)

---

## Step 1: Make Sure the Server is Running

In a terminal, run:

```bash
cd /home/atom/Documents/GitHub/HackCU/Adam/agent-ledger
pnpm build
node packages/mcp-server/dist/index.js
```

You should see:
```
🔒 Agent Ledger MCP Server running on http://0.0.0.0:3000
```

**Leave this running.** Open the dashboard at http://localhost:3000/dashboard to watch in real time.

---

## Step 2: Configure Your AI Agent to Use the MCP Tools

### Option A: MCP Config File (Claude Desktop / Copilot / Any MCP Client)

Copy this into your MCP client's settings. The file path depends on your client:

- **Claude Desktop**: `~/.claude/claude_desktop_config.json`
- **VS Code Copilot**: `.vscode/mcp.json` in your project

```json
{
  "mcpServers": {
    "agent-ledger": {
      "command": "node",
      "args": [
        "/home/atom/Documents/GitHub/HackCU/Adam/agent-ledger/packages/mcp-server/dist/mcp/bridge.js"
      ],
      "env": {
        "LEDGER_SERVER_URL": "http://localhost:3000"
      }
    }
  }
}
```

### Option B: Add via VS Code Settings (Copilot)

1. Open VS Code **Settings** (Ctrl+,)
2. Search for "MCP"
3. Click **Edit in settings.json**
4. Add the `agent-ledger` server config from above

---

## Step 3: Open Your New Project

Open a new VS Code window with your project:

```bash
code /path/to/your/new-project
```

---

## Step 4: Tell the AI Agent to Register

In your AI chat (Copilot Chat, Claude sidebar, etc.), say:

> **"Use the ledger_register tool to register as `copilot-agent-1` with tier `worker`"**

The agent will call the MCP tool and get back:
```
Registered as copilot-agent-1 (worker).
You can now acquire leases and report events.
```

✅ Check the dashboard — you'll see the new agent appear.

---

## Step 5: The Agent Coordinates Through the Ledger

Now, whenever the AI agent edits a file, it should follow this protocol:

### Before editing a file:
> **"Use ledger_acquire_lease to lock `src/app.ts` with scope `file`"**

### Before making changes:
> **"Use ledger_report_intent with resource `src/app.ts` and intent `Add login endpoint`"**

### After making changes:
> **"Use ledger_report_action with the event_id and describe what you changed"**

### When done with the file:
> **"Use ledger_release_lease to unlock the file"**

---

## Step 6: Multi-Agent Scenario

To see the real power, open **two VS Code windows** with the same project:

| Window 1 | Window 2 |
|----------|----------|
| Agent: `copilot-agent-1` (worker) | Agent: `gemini-agent-2` (worker) |
| Working on: `src/auth.ts` | Working on: `src/database.ts` |

If Agent 2 tries to edit `src/auth.ts` while Agent 1 has it locked:
```
File is locked by another agent.
You are queued at position 1.
Work on a different file and check back later.
```

When Agent 1 releases → Agent 2 automatically gets the lock!

---

## Step 7: Use the System Prompt (Advanced)

For fully automatic coordination, add this to your agent's system prompt:

```
You have access to Agent Ledger tools for multi-agent coordination.

RULES:
1. At the start of every session, call ledger_register with your agent_id and tier "worker"
2. BEFORE editing any file, call ledger_acquire_lease on that file
3. If the lease is queued (not granted), work on a different file instead
4. BEFORE making changes, call ledger_report_intent with what you plan to do
5. AFTER making changes, call ledger_report_action with what you did
6. When done with a file, call ledger_release_lease
7. Periodically call ledger_check_sync to see if humans edited your files
8. Call ledger_status to see what other agents are working on
```

---

## Quick Reference

| What You Want | What to Say |
|---------------|-------------|
| Register | "Register with the ledger as `my-agent` worker" |
| Lock a file | "Acquire a lease on `src/app.ts`" |
| Log intent | "Report intent: adding login validation" |
| Log result | "Report action: added input sanitization to login" |
| Unlock file | "Release the lease on src/app.ts" |
| Check status | "What's the current ledger status?" |
| Search history | "Search the ledger for anything related to authentication" |
| Declare milestone | "Declare milestone: v1.0 API complete" |

---

## Watching It All Live

Open the dashboard while your agents work:

```
http://localhost:3000/dashboard
```

You'll see agents register, leases being acquired, events flowing in, and milestones appearing — all in real time.
