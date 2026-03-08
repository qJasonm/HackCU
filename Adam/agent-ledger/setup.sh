#!/usr/bin/env bash
# ============================================================
# Agent Ledger — One-Command Setup
# ============================================================
# Usage:
#   curl -sSL <raw-url>/setup.sh | bash
#   — or —
#   bash setup.sh
#   — or —
#   bash setup.sh /path/to/your-project
# ============================================================

set -e

GREEN="\033[1;32m"
BLUE="\033[1;34m"
YELLOW="\033[1;33m"
RED="\033[1;31m"
BOLD="\033[1m"
RESET="\033[0m"

step() { echo -e "\n${GREEN}▶ $1${RESET}"; }
info() { echo -e "  ${BLUE}$1${RESET}"; }
warn() { echo -e "  ${YELLOW}⚠ $1${RESET}"; }

echo -e "${BOLD}🔒 Agent Ledger — Setup${RESET}\n"

# ---- Check prerequisites ----

step "Checking prerequisites..."

if ! command -v node &> /dev/null; then
  echo -e "${RED}✗ Node.js not found. Install v20+ from https://nodejs.org${RESET}" && exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo -e "${RED}✗ Node.js v20+ required (found v$(node -v))${RESET}" && exit 1
fi
info "Node.js $(node -v) ✓"

if ! command -v pnpm &> /dev/null; then
  warn "pnpm not found — installing..."
  npm install -g pnpm
fi
info "pnpm $(pnpm -v) ✓"

# ---- Determine install location ----

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}" 2>/dev/null)" && pwd 2>/dev/null || echo "")"

# Check if we're already inside the agent-ledger repo
if [ -f "$SCRIPT_DIR/packages/mcp-server/package.json" ]; then
  LEDGER_DIR="$SCRIPT_DIR"
  info "Using existing install at: $LEDGER_DIR"
elif [ -f "./packages/mcp-server/package.json" ]; then
  LEDGER_DIR="$(pwd)"
  info "Using existing install at: $LEDGER_DIR"
else
  # Clone fresh
  step "Cloning Agent Ledger..."
  CLONE_DIR="${HOME}/.agent-ledger"
  if [ -d "$CLONE_DIR" ]; then
    info "Found existing clone at $CLONE_DIR — pulling latest..."
    git -C "$CLONE_DIR" pull --quiet 2>/dev/null || true
  else
    git clone --quiet https://github.com/qJasonm/HackCU "$CLONE_DIR"
  fi
  LEDGER_DIR="$CLONE_DIR/Adam/agent-ledger"
fi

# ---- Install & build ----

step "Installing dependencies..."
(cd "$LEDGER_DIR" && pnpm install --silent 2>&1 | tail -1)
info "Dependencies installed ✓"

step "Building packages..."
(cd "$LEDGER_DIR" && pnpm build 2>&1 | tail -1)
info "Build complete ✓"

# ---- Determine project directory ----

PROJECT_DIR="${1:-$(pwd)}"
if [ "$PROJECT_DIR" = "$LEDGER_DIR" ]; then
  echo ""
  warn "You're inside the agent-ledger repo itself."
  warn "To set up a project, run:  bash setup.sh /path/to/your-project"
  echo ""
fi

# ---- Set up project config ----

BRIDGE_PATH="$LEDGER_DIR/packages/mcp-server/dist/mcp/bridge.js"

step "Setting up project at: $PROJECT_DIR"

# .vscode/mcp.json
mkdir -p "$PROJECT_DIR/.vscode"
cat > "$PROJECT_DIR/.vscode/mcp.json" << EOF
{
  "servers": {
    "agent-ledger": {
      "type": "stdio",
      "command": "node",
      "args": [
        "$BRIDGE_PATH"
      ],
      "env": {
        "LEDGER_SERVER_URL": "http://localhost:3000"
      }
    }
  }
}
EOF
info "Created .vscode/mcp.json ✓"

# .github/copilot-instructions.md
mkdir -p "$PROJECT_DIR/.github"
cat > "$PROJECT_DIR/.github/copilot-instructions.md" << 'EOF'
You have access to Agent Ledger MCP tools for multi-agent file coordination.

MANDATORY PROTOCOL for EVERY file edit:
1. Call `ledger_acquire_lease` with the file path and scope "file"
2. If queued (not granted), work on a different file instead
3. Call `ledger_report_intent` with what you plan to do
4. Make your edits
5. Call `ledger_report_action` with what you changed
6. Call `ledger_release_lease` when done

Other useful tools:
- `ledger_status` — see what other agents are working on
- `ledger_search` — find past actions related to a topic
- `ledger_check_sync` — check if humans edited your locked files
EOF
info "Created .github/copilot-instructions.md ✓"

# .gitignore entry
if [ -f "$PROJECT_DIR/.gitignore" ]; then
  if ! grep -q ".ledger/" "$PROJECT_DIR/.gitignore" 2>/dev/null; then
    echo -e "\n# Agent Ledger\n.ledger/" >> "$PROJECT_DIR/.gitignore"
    info "Added .ledger/ to .gitignore ✓"
  fi
else
  echo -e "# Agent Ledger\n.ledger/" > "$PROJECT_DIR/.gitignore"
  info "Created .gitignore with .ledger/ ✓"
fi

# ---- Done ----

SERVER_CMD="cd \"$PROJECT_DIR\" && node \"$BRIDGE_PATH/../../../index.js\""

echo ""
echo -e "${BOLD}${GREEN}✅ Setup complete!${RESET}"
echo ""
echo -e "${BOLD}To start the server:${RESET}"
echo -e "  cd $PROJECT_DIR"
echo -e "  node $LEDGER_DIR/packages/mcp-server/dist/index.js"
echo ""
echo -e "${BOLD}Then:${RESET}"
echo "  1. Open http://localhost:3000/dashboard"
echo "  2. Reload VS Code (Ctrl+Shift+P → Developer: Reload Window)"
echo "  3. In Copilot Chat: \"Call ledger_register with agent_id 'copilot-1' and tier 'worker'\""
echo ""
