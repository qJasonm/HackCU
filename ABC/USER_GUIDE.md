# ABC (Agent BlockChain) User Guide

Welcome! This guide will walk you through everything you need to know to set up and use **ABC** from scratch—even if you've never used a command-line tool before.

---

## What is ABC?

**ABC (Agent BlockChain)** is like a "diary" or "audit trail" for AI agents. When AI agents perform tasks (like writing code, answering questions, or making decisions), ABC records *exactly* what they did, when they did it, and why—in a way that **cannot be tampered with**.

### Why does this matter?

Imagine you have an AI agent that manages files or writes code for you. Later, you might want to know:
- "What did this agent do yesterday?"
- "Who told it to delete that file?"
- "Can I trust that this log hasn't been modified?"

ABC answers all of these questions by using **blockchain-style technology**—every action is recorded with a unique "fingerprint" (called a **hash**) that links to the previous record. If anyone tries to change past records, the fingerprints won't match, and you'll know something was tampered with.

### Key Concepts (Quick Glossary)

| Term | What it means |
|------|---------------|
| **Ledger** | A file (`ledger.md`) that stores all recorded agent actions in order. Think of it as a permanent history book. |
| **Block** | A single entry in the ledger. Each block contains: who did it, what they did, when, and a unique hash. |
| **Hash** | A digital "fingerprint"—a string of letters/numbers that uniquely identifies a block's contents. If you change anything, the hash changes completely. |
| **Agent** | Any AI or automated program whose actions you want to track (e.g., a coding assistant, a research bot). |
| **Payload** | The actual data inside a block—like the task details, files modified, or AI response. |
| **CLI** | Command Line Interface—a text-based way to interact with programs by typing commands. |

---

## Prerequisites

Before you start, make sure you have these installed on your computer:

### 1. Python 3.11 or higher

Python is a programming language that ABC is built with.

**To check if you have Python installed:**
```bash
python --version
```
or
```bash
python3 --version
```

You should see something like `Python 3.11.x` or higher. If not, download Python from [python.org](https://www.python.org/downloads/).

### 2. pip (Python Package Manager)

**pip** is a tool that installs Python packages (small programs that add features). It usually comes with Python.

**To check if pip is installed:**
```bash
pip --version
```
or
```bash
pip3 --version
```

### 3. A Code Editor (Recommended: VS Code)

While not strictly required, **Visual Studio Code** (VS Code) makes it easier to work with ABC. Download it from [code.visualstudio.com](https://code.visualstudio.com/).

---

## Installation (Step-by-Step)

Follow these steps to get ABC running in your project:

### Step 1: Open a Terminal

A **terminal** (also called "command prompt" or "shell") is where you type commands.

**How to open a terminal:**
- **VS Code**: Press `` Ctrl+` `` (backtick key, usually below Escape) or go to `View → Terminal`
- **Windows**: Press `Win+R`, type `cmd`, and press Enter
- **Mac**: Press `Cmd+Space`, type "Terminal", and press Enter
- **Linux**: Press `Ctrl+Alt+T`

### Step 2: Navigate to Your Project Folder

Use the `cd` (change directory) command to go to where your project lives.

```bash
# Replace this path with your actual project folder
cd /path/to/your/project
```

**Example:**
```bash
cd ~/Documents/my-ai-project
```

**Tips:**
- `~` means your home folder
- Use `ls` (Mac/Linux) or `dir` (Windows) to see what's in the current folder
- Use `cd ..` to go up one folder level

### Step 3: Clone ABC Into Your Project

Use **Git** to clone the ABC repository directly into your project folder:

```bash
git clone https://github.com/qJasonm/HackCU
```

> **What is Git?** Git is a version control tool that downloads code from repositories (online storage). If you don't have Git installed, download it from [git-scm.com](https://git-scm.com/downloads).

> **Note:** Replace `YOUR_USERNAME/abc` with the actual repository URL provided to you.

After cloning, you'll have a new `abc/` folder containing:
- `cli/` — The command-line interface
- `ledger/` — Core logic for the blockchain ledger
- `dashboard/` — Web-based visual interface
- `pyproject.toml` — Configuration file

### Step 4: Install ABC

From your terminal, navigate into the cloned ABC folder and install it:

```bash
# Navigate to the abc folder (adjust path as needed)
cd abc

# Install ABC and its dependencies
pip install -e .
```

**What does this do?**
- `pip install` downloads and installs Python packages
- `-e .` means "install this folder in editable mode" — so you can modify the code and see changes immediately
- This installs dependencies like `typer` (for CLI), `rich` (for pretty output), and `pydantic` (for data validation)

**If you see permission errors**, try:
```bash
pip install --user -e .
```

### Step 5: Verify Installation

Test that ABC was installed correctly:

```bash
abc --help
```

You should see a help message listing available commands:
```
abc — Agent BlockChain.

Manage an append-only, immutable agent action ledger stored in a human-readable
ledger.md file. Record actions, inspect the log, diff payloads, and verify 
chain integrity.

Commands:
  record  Append a new action block to the ledger.
  log     Show ledger blocks in a git log-style table.
  diff    Show payload diff between two blocks.
  verify  Re-compute hash chain and verify integrity.
```

---

## Using the CLI (Command Line Interface)

The CLI is the primary way to interact with ABC. Here are the main commands:

### Recording an Action

When an agent does something, record it to the ledger:

```bash
abc record --agent-id my-agent --action task_completed --payload '{"task": "Generated report", "files": ["report.pdf"]}'
```

**Breaking this down:**
- `--agent-id my-agent` — Who performed the action (name of the agent)
- `--action task_completed` — What type of action it was
- `--payload '{...}'` — The details (in JSON format)

**Common action types you might use:**
- `task_assigned` — An agent was given a task
- `task_completed` — An agent finished a task
- `code_written` — Code was generated
- `file_modified` — A file was changed
- `error` — Something went wrong

**Using a JSON file instead of typing it out:**
```bash
abc record --agent-id my-agent --action task_completed --file payload.json
```

### Viewing the Ledger

See all recorded actions:

```bash
abc log
```

This shows a formatted table with:
- Block number (index)
- Timestamp (when it happened)
- Agent ID (who did it)
- Action type
- Payload preview
- Hash (fingerprint)

**Filtering the log:**
```bash
# Only show actions from a specific agent
abc log --agent my-agent

# Only show specific action types
abc log --action task_completed

# Show last 10 entries
abc log --limit 10

# Show entries after block #5
abc log --since 5
```

### Verifying Integrity

Check that no one has tampered with the ledger:

```bash
abc verify
```

If everything is intact, you'll see a success message with all green checkmarks. If tampering is detected, you'll see exactly which block was modified.

### Comparing Changes (Diff)

See what changed between two blocks:

```bash
abc diff 3 7
```

This compares the payload of block #3 with block #7, showing additions (`+`) and deletions (`-`).

---

## Using the Dashboard (Web Interface)

The dashboard provides a visual way to view and manage your ledger.

### Starting the Dashboard

```bash
# Install dashboard dependencies first (one-time setup)
pip install fastapi uvicorn sse-starlette httpx

# Start the dashboard server
python dashboard/run.py
```

You should see:
```
[abc-dashboard] Scratchpad: /your/project/scratchpad
INFO:     Uvicorn running on http://127.0.0.1:7070
```

### Opening the Dashboard

Open your web browser and go to: **http://127.0.0.1:7070**

**What is 127.0.0.1?** This is also called "localhost" — it means "this computer." The dashboard runs on your own machine, not on the internet.

**What is port 7070?** A port is like a specific "door" into your computer. Port 7070 is where the dashboard is listening for web traffic.

### Dashboard Features

**Left Sidebar — Agent Registry:**
- Shows all agents that have recorded actions
- Green dot = recently active
- Click an agent to filter the view

**Main Area — Block Feed:**
- Scrolling list of all ledger entries
- Each block shows: index, action type, agent, timestamp, payload preview, and hash
- Click a block to see full details

**Filter Bar:**
- Search by agent name, action type, or payload content
- Type to instantly filter the visible blocks

**Verify Integrity Button:**
- Click to re-check all hashes
- Green = all good
- Red = tampering detected

### Stopping the Dashboard

Press `Ctrl+C` in the terminal where the dashboard is running.

---

## Understanding the Ledger File

The ledger is stored in a file called `ledger.md`. Here's what the inside looks like:

```markdown
# Agent Ledger

## Block 0 — genesis

```json
{
  "block_index": 0,
  "timestamp": "2024-01-15T10:30:00Z",
  "agent_id": "ledger-system",
  "action_type": "genesis",
  "payload": {"message": "Agent ledger initialised."},
  "previous_hash": "0000000000000000000000000000000000000000000000000000000000000000",
  "block_hash": "a1b2c3d4..."
}
```

## Block 1 — task_assigned

```json
{
  "block_index": 1,
  "timestamp": "2024-01-15T10:35:00Z",
  "agent_id": "code-assistant",
  "action_type": "task_assigned",
  "payload": {"task": "Write a Python function"},
  "previous_hash": "a1b2c3d4...",
  "block_hash": "e5f6g7h8..."
}
```
```

**Notice how each block's `previous_hash` matches the prior block's `block_hash`?** This creates a chain—if anyone changes an old block, the hashes won't line up anymore.

---

## Project Folder Structure

After setup, your project should look like this:

```
your-project/
├── ledger.md           # Your blockchain ledger (created after first record)
├── scratchpad/         # Raw agent outputs (created when dashboard runs)
├── cli/                # Command-line interface code
│   ├── main.py         # Entry point for CLI
│   └── commands/       # Individual command implementations
├── ledger/             # Core blockchain logic
│   ├── blockchain.py   # Hash computation and verification
│   ├── md_store.py     # Reading/writing ledger.md
│   └── models.py       # Data structures
├── dashboard/          # Web interface
│   ├── run.py          # Server launcher
│   ├── server.py       # API endpoints
│   └── index.html      # Frontend interface
└── pyproject.toml      # Package configuration
```

---

## Troubleshooting Common Issues

### "command not found: abc"

**Problem:** The system can't find the abc command.

**Solutions:**
1. Make sure you ran `pip install -e .` in the abc folder
2. Try using `python -m cli.main` instead of `abc`
3. Your Python scripts folder might not be in your PATH. Try:
   ```bash
   pip show abc  # Shows where it's installed
   ```

### "No module named 'typer'" or similar

**Problem:** A required Python package is missing.

**Solution:** Install dependencies:
```bash
pip install typer[all] rich pydantic
```

### "Ledger not found"

**Problem:** You're running a command but there's no ledger.md file yet.

**Solution:** Record your first action to create the ledger:
```bash
abc record --agent-id my-agent --action init --payload '{"message": "Ledger initialized"}'
```

### Dashboard shows blank page

**Problem:** Dashboard isn't loading properly.

**Solutions:**
1. Check the terminal for error messages
2. Make sure you installed dashboard dependencies:
   ```bash
   pip install fastapi uvicorn sse-starlette
   ```
3. Try refreshing the browser with `Ctrl+Shift+R` (hard refresh)

### "Address already in use" when starting dashboard

**Problem:** Something else is using port 7070.

**Solution:** Use a different port:
```bash
python dashboard/run.py --port 8080
```
Then open http://127.0.0.1:8080 instead.

---

## Quick Reference Card

| What you want to do | Command |
|---------------------|---------|
| See all commands | `abc --help` |
| Record an action | `abc record --agent-id NAME --action TYPE --payload '{...}'` |
| View ledger | `abc log` |
| Filter by agent | `abc log --agent NAME` |
| Verify integrity | `abc verify` |
| Compare blocks | `abc diff BLOCK1 BLOCK2` |
| Start dashboard | `python dashboard/run.py` |
| Dashboard URL | http://127.0.0.1:7070 |

---

## Next Steps

Now that ABC is set up, here are some things you can try:

1. **Record a test action** to make sure everything works
2. **Open the dashboard** and explore the interface
3. **Connect it to your AI agents** by calling `abc record` after each agent action
4. **Set up automated recording** by integrating ABC into your agent's code

For programmatic usage, you can import the ledger directly in Python:
```python
from ledger.md_store import MarkdownLedgerStore
from ledger.models import ActionRecord

store = MarkdownLedgerStore("ledger.md")
action = ActionRecord(
    agent_id="my-agent",
    action_type="task_completed",
    payload={"result": "success"}
)
block = store.append_block(action)
print(f"Recorded block #{block.block_index}")
```

---

**Questions?** Check the code comments in the source files, or open an issue on the project repository.
