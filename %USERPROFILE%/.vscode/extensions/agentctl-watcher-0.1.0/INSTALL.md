# AgentCtl Watcher — Installation Guide

## VS Code Extension

### Install (no build required)

Copy the extension folder into your VS Code extensions directory:

```powershell
# Windows
xcopy /E /I "C:\Users\Bo_jr\.gemini\antigravity\scratch\agentctl-watcher" "%USERPROFILE%\.vscode\extensions\agentctl-watcher-0.1.0"

# Then reload VS Code
```

Or, during development, open the folder in VS Code and press **F5** to launch
an Extension Development Host.

### Configure (`File → Preferences → Settings → AgentCtl`)

| Setting | Default | Description |
|---|---|---|
| `agentctl.agentId` | `antigravity` | Agent ID written to every block |
| `agentctl.ledgerPath` | `<workspace>/ledger.md` | Where to write the ledger |
| `agentctl.recordFileSaves` | `true` | Record every file save |
| `agentctl.recordFileCreations` | `true` | Record new files |
| `agentctl.recordFileDeletions` | `true` | Record deleted files |
| `agentctl.excludePatterns` | `.git, node_modules, …` | Files to ignore |

### Commands (`Ctrl+Shift+P`)

| Command | What it does |
|---|---|
| `AgentCtl: Open Ledger` | Open `ledger.md` in the editor |
| `AgentCtl: Record Custom Action` | Manually record any action + payload |
| `AgentCtl: Verify Chain Integrity` | Re-hash every block, show pass/fail |

### Status bar

A `⊞ Ledger: N blocks` item in the bottom-right shows the live block count.
Click it to open `ledger.md`.

---

## Python Watchdog (non-VS Code)

```powershell
pip install watchdog
python C:\Users\Bo_jr\.gemini\antigravity\scratch\agentctl\auto_recorder.py `
    --watch  C:\myproject `
    --agent-id claude-agent `
    --ledger  C:\myproject\ledger.md
```

---

## How it works

```
Agent edits / saves a file
        │
        ▼
VS Code fires onDidSaveTextDocument
        │
        ▼
extension.js reads ledger.md
        │
        ▼
Computes next block (SHA-256 hash chain, same algo as Python agentctl)
        │
        ▼
Appends  ## Block N — file_saved  section to ledger.md
        │
        ▼
Status bar updates to show new block count
```

The JS hash is 100% compatible with the Python CLI — you can freely mix
`agentctl record` (manual) with the extension (auto) in the same `ledger.md`.
