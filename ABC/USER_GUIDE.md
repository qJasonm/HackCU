# ABC (Agent BlockChain) User Guide

Welcome! This guide will walk you through everything you need to know to set up and use **ABC** from scratch—even if you've never used a command-line tool before.

---

## What is ABC?

**ABC (Agent BlockChain)** is like a "diary" or "audit trail" for AI agents. When AI agents perform tasks (like writing code, answering questions, or making decisions), ABC records *exactly* what they did, when they did it, and why. Additionally ABC incorporates a hashing algorithm so the block chain. **cannot be tampered with**.

### Why does this matter?

Imagine you have AI agents that manage files, write code for you, and collectively work on projects over long spans of time. An issue you might run into is getting all of these agents to pick up where other agents left off efficiently. Suppose Agent A makes a change to your codebase that depends strictly on its own reasoning—how will Agent B pick up on some of the more subtle changes that are actually crucial design decisions?

More importantly, does Agent A's reasoning follow a logical basis that makes sense for the direction of the project, and is that communicated to the other agents that depend on Agent A's actions? Typically, it doesn't—and this results in a cascade of issues.

During the development process, agents might take actions like:
"Switching from Pydantic to LangChain"
"Moving from a Postgres database to MongoDB"
Or maybe you just want to know:
"What did these agents do yesterday or last week?"
"Why did this particular agent delete that file?"

ABC answers all of these questions by using blockchain-style technology. ABC optimizes agentic orchestration by providing agents with a constant source of ground truth for every action that is taken.

Each agent’s action is compressed into a data-efficient payload that extracts the most crucial details from the agent's reasoning and any changes it made to your code. These contextual updates are then passed along to any agent that depends on the previous agent’s actions, preventing catastrophic development issues throughout the course of a project.

To top it all off, every action is recorded with a unique "fingerprint" (called a hash) that links to the previous record—making the system securely tamper-resistant from any external source.

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
git clone https://github.com/YOUR_USERNAME/abc.git
```

> **What is Git?** Git is a version control tool that downloads code from repositories (online storage). If you don't have Git installed, download it from [git-scm.com](https://git-scm.com/downloads).

> **Note:** Replace `YOUR_USERNAME/abc` with the actual repository URL provided to you.

After cloning, you'll have a new `abc/` folder containing:
- `cli/` — The command-line interface
- `ledger/` — Core logic for the blockchain ledger
- `dashboard/` — Web-based visual interface
- `pyproject.toml` — Configuration file

### Step 4: Create a Virtual Environment

A **virtual environment** is an isolated Python workspace that keeps ABC's dependencies separate from your system Python. This is required on most modern Linux systems and recommended everywhere.

```bash
# Navigate into the abc folder
cd abc

# Create a virtual environment named "venv"
python3 -m venv venv
```

**What does this do?**
- Creates a folder called `venv/` containing a private copy of Python
- Keeps your project's packages separate from other projects

### Step 5: Activate the Virtual Environment

Before installing or running ABC, you must **activate** the virtual environment:

**Linux / Mac:**
```bash
source venv/bin/activate
```

**Windows (Command Prompt):**
```cmd
venv\Scripts\activate.bat
```

**Windows (PowerShell):**
```powershell
venv\Scripts\Activate.ps1
```

After activation, you should see `(venv)` at the beginning of your terminal prompt, like this:
```
(venv) atom@laptop:~/abc$
```

> **Important:** You need to activate the virtual environment every time you open a new terminal to use ABC.

### Step 6: Install ABC

Now install ABC inside the activated virtual environment:

```bash
# Install ABC and its dependencies
pip install -e .
```

**What does this do?**
- `pip install` downloads and installs Python packages
- `-e .` means "install this folder in editable mode" — so you can modify the code and see changes immediately
- This installs dependencies like `typer` (for CLI), `rich` (for pretty output), and `pydantic` (for data validation)

### Step 7: Verify Installation

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

## Using the Dashboard (Web Interface)

The dashboard provides a visual way to view and manage your ledger. **Start here** — it's the easiest way to see ABC in action!

### Step 8: Install Dashboard Dependencies

The dashboard needs a few extra packages. Install them (make sure your virtual environment is still activated):

```bash
pip install fastapi uvicorn sse-starlette httpx
```

### Step 9: Start the Dashboard

```bash
python dashboard/run.py
```

You should see:
```
[abc-dashboard] Scratchpad: /your/project/scratchpad
INFO:     Uvicorn running on http://127.0.0.1:7070
```

### Step 10: Open the Dashboard in Your Browser

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

### Registering an Agent

Before an AI agent can record actions, it should be registered in ABC. This helps you track which agents are active and what they do.

#### Step 11: Open the Add Agent Form

In the left sidebar of the dashboard, click the **+ Add** button next to "Agents."

#### Step 12: Fill in Agent Details

A form will appear with three fields:

1. **Agent ID** — A unique name for this agent (e.g., `copilot`, `claude-assistant`, `my-coding-bot`)
   - Use lowercase letters, numbers, and hyphens
   - This is how the agent identifies itself when recording actions

2. **Description** — A brief description of what this agent does
   - Example: "GitHub Copilot coding assistant"
   - Example: "Research and analysis bot"

3. **Default Endpoint** (optional) — If your agent runs as a service, enter its URL here
   - Leave blank if your agent doesn't have a web endpoint
   - Example: `http://localhost:8080`

#### Step 13: Click Add

Click the **Add** button. Your agent will appear in the left sidebar.

> **Note:** Agents can also register themselves automatically! When an agent records its first action with `abc record --agent-id my-agent ...`, it will appear in the registry even if you didn't manually add it.

### Connecting Your IDE Agent

If you're using an AI coding assistant (like GitHub Copilot, Claude, or a custom agent), you can have it record actions to ABC. There are two approaches:

**Option 1: Manual Recording (Simple)**

After your AI agent completes a task, manually record it:
```bash
abc record --agent-id copilot --action code_written --payload '{"file": "main.py", "description": "Added error handling"}'
```

**Option 2: Auto-Recorder (Automatic)**

ABC includes a file watcher that automatically records file changes. This is perfect for tracking what your IDE agents modify.

**Step 1: Open a New Terminal**

The dashboard is still running in your first terminal, so you need a second one:
- **VS Code**: Click the `+` icon in the terminal panel, or press `` Ctrl+Shift+` ``
- **Linux**: Press `Ctrl+Alt+T`
- **Mac**: Press `Cmd+T` in Terminal
- **Windows**: Open a new Command Prompt window

**Step 2: Navigate to the ABC Folder**

```bash
cd /path/to/your/project/ABC
```

Replace `/path/to/your/project` with your actual project path.

**Step 3: Reactivate the Virtual Environment**

Each new terminal starts fresh, so you must activate venv again:

**Linux / Mac:**
```bash
source venv/bin/activate
```

**Windows:**
```cmd
venv\Scripts\activate.bat
```

You should see `(venv)` appear in your prompt.

**Step 4: Install Watchdog and Start the Auto-Recorder**

```bash
# Install watchdog (only needed once)
pip install watchdog

# Start watching your project folder (must exist!)
python auto_recorder.py --watch /path/to/your/code --agent-id copilot --ledger ./ledger.md
```

**Example:** To watch your current directory:
```bash
python auto_recorder.py --watch . --agent-id copilot --ledger ./ledger.md
```

> **Important:** The watched folder must exist before starting the auto-recorder. If you get `FileNotFoundError`, create the folder first or use `.` to watch the current directory.

The auto-recorder will automatically create ledger entries whenever files are created, modified, renamed, or deleted in the watched folder.

**What gets recorded:**
- `file_saved` — A file was modified
- `file_created` — A new file appeared
- `file_deleted` — A file was removed
- `file_renamed` — A file was moved or renamed

> **Tip:** Run the auto-recorder in a separate terminal while you work. It will silently track all file changes in the background.

### Configuring the Overseer LLM

The **Overseer** is an AI that reads agent outputs and structures them into clean ledger blocks. You need to configure an LLM provider for it to work. **All configuration is done inside the dashboard.**

#### Step 14: Open the Assign Tab

In the dashboard, click the **Assign** tab in the top navigation. This is where you configure which AI model the Overseer uses.

#### Step 15: Choose Your LLM Provider

Select one of the available platforms from the dropdown:

**Option A: Google Gemini (Recommended for beginners)**
1. Select **"Gemini"** from the platform dropdown
2. Paste your API key in the input field
3. Click **Save**

> **How to get a Gemini API key:** Visit [makersuite.google.com](https://makersuite.google.com/app/apikey), sign in with Google, and create an API key. It's free for limited use.

**Option B: OpenAI**
1. Select **"OpenAI"** from the platform dropdown
2. Paste your API key in the input field
3. Click **Save**

> **How to get an OpenAI API key:** Visit [platform.openai.com/api-keys](https://platform.openai.com/api-keys), sign in, and create a new secret key.

**Option C: Anthropic (Claude)**
1. Select **"Anthropic"** from the platform dropdown
2. Paste your API key in the input field
3. Click **Save**

> **How to get an Anthropic API key:** Visit [console.anthropic.com](https://console.anthropic.com), sign in, and create an API key.

**Option D: Ollama (Local Model — Free, Private)**

**Ollama** lets you run AI models locally on your own computer — no API key needed, and your data never leaves your machine.

1. **Install Ollama:** Download from [ollama.ai](https://ollama.ai)

2. **Pull a model** (in a terminal):
   ```bash
   ollama pull llama3
   ```

3. **Start Ollama** (if not already running):
   ```bash
   ollama serve
   ```
   
   > **Got "address already in use" error?** That's fine! It means Ollama is already running as a background service on your system. Skip this step and proceed to configuring it in the dashboard.

4. **In the dashboard Assign tab:**
   - Select **"Ollama (local)"** as the platform
   - URL: `http://localhost:11434` (default)
   - Model: `llama3` (or whichever model you pulled)
   - Click **Save**

> **Note:** Local models require decent hardware. A computer with 8GB+ RAM can run smaller models like `llama3:8b`.

#### Where Are Keys Stored?

Your API keys are stored in your browser's **localStorage** — they stay on your computer and are never sent anywhere except to the AI provider you selected. If you clear your browser data, you'll need to re-enter your key.

### Stopping the Dashboard

Press `Ctrl+C` in the terminal where the dashboard is running.

---

## Using the CLI (Command Line Interface)

The CLI provides a text-based way to interact with ABC. Use it for scripting, automation, or when you prefer typing commands.

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
