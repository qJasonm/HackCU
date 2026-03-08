/**
 * AgentCtl Ledger Watcher — VS Code Extension
 *
 * Automatically records agent file actions into ledger.md using the same
 * SHA-256 blockchain logic as the Python agentctl CLI tool.
 * No build step required — plain CommonJS, no external dependencies.
 */

"use strict";

const vscode = require("vscode");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GENESIS_PREVIOUS_HASH = "0".repeat(64);
const PR_DIVIDER = "\n---\n\n## Pull Requests\n";
const HEADER = "# Agent Ledger\n";

// ---------------------------------------------------------------------------
// Ledger file utilities (mirrors Python md_store.py logic)
// ---------------------------------------------------------------------------

/**
 * Stable JSON stringify that sorts all object keys recursively.
 * Must match Python's json.dumps(sort_keys=True, separators=(",",":")).
 */
function stableJSON(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return JSON.stringify(value);
  }
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => `"${k}":${stableJSON(value[k])}`).join(",") + "}";
}

function computeHash(block) {
  const canonical = stableJSON({
    action_type: block.action_type,
    agent_id: block.agent_id,
    block_index: block.block_index,
    payload: block.payload,
    previous_hash: block.previous_hash,
    timestamp: block.timestamp,
  });
  return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
}

function utcNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * Parse all fenced JSON blocks from ledger.md content.
 * Returns { blocks: LedgerBlock[], prs: CorrectionProposal[] }
 */
function parseSections(text) {
  const blocks = [];
  const prs = [];
  const lines = text.split(/\r?\n/);
  let currentType = null; // "block" | "pr"
  let inFence = false;
  let fenceBuf = [];

  for (const line of lines) {
    if (line.startsWith("## Block ")) {
      currentType = "block";
      inFence = false;
      fenceBuf = [];
    } else if (line.startsWith("### PR ")) {
      currentType = "pr";
      inFence = false;
      fenceBuf = [];
    } else if (line === "```json" && currentType && !inFence) {
      inFence = true;
      fenceBuf = [];
    } else if (line === "```" && inFence) {
      inFence = false;
      try {
        const data = JSON.parse(fenceBuf.join("\n"));
        if (currentType === "block") blocks.push(data);
        else if (currentType === "pr") prs.push(data);
      } catch (_) {
        // skip malformed
      }
      currentType = null;
    } else if (inFence) {
      fenceBuf.push(line);
    }
  }
  return { blocks, prs };
}

function readLedger(ledgerPath) {
  if (!fs.existsSync(ledgerPath)) return "";
  return fs.readFileSync(ledgerPath, "utf8");
}

function writeLedger(ledgerPath, text) {
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  fs.writeFileSync(ledgerPath, text, "utf8");
}

function blockSection(block) {
  const j = JSON.stringify(block, null, 2);
  return `\n## Block ${block.block_index} — ${block.action_type}\n\n\`\`\`json\n${j}\n\`\`\`\n`;
}

/**
 * Create genesis block if ledger.md is missing or empty.
 */
function ensureGenesis(ledgerPath) {
  const text = readLedger(ledgerPath);
  const { blocks } = parseSections(text);
  if (blocks.length > 0) return;

  const genesis = {
    block_index: 0,
    timestamp: utcNow(),
    agent_id: "ledger-system",
    action_type: "genesis",
    payload: { message: "Agent ledger initialised." },
    previous_hash: GENESIS_PREVIOUS_HASH,
    block_hash: "",
  };
  genesis.block_hash = computeHash(genesis);

  writeLedger(ledgerPath, HEADER + blockSection(genesis));
}

/**
 * Append a new block to ledger.md and return it.
 */
function appendBlock(ledgerPath, agentId, actionType, payload) {
  ensureGenesis(ledgerPath);

  let text = readLedger(ledgerPath);
  const { blocks } = parseSections(text);
  const prev = blocks[blocks.length - 1];

  const block = {
    block_index: prev.block_index + 1,
    timestamp: utcNow(),
    agent_id: agentId,
    action_type: actionType,
    payload: payload || {},
    previous_hash: prev.block_hash,
    block_hash: "",
  };
  block.block_hash = computeHash(block);

  const section = blockSection(block);

  if (text.includes(PR_DIVIDER)) {
    const idx = text.indexOf(PR_DIVIDER);
    text = text.slice(0, idx) + section + text.slice(idx);
  } else {
    text = text.trimEnd() + "\n" + section;
  }

  writeLedger(ledgerPath, text);
  return block;
}

/**
 * Verify the entire chain; returns { valid, block_count, message }.
 */
function verifyChain(ledgerPath) {
  const text = readLedger(ledgerPath);
  const { blocks } = parseSections(text);

  if (blocks.length === 0) {
    return { valid: true, block_count: 0, message: "Ledger is empty." };
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const recomputed = computeHash(block);
    if (recomputed !== block.block_hash) {
      return {
        valid: false,
        block_count: blocks.length,
        message: `Block #${block.block_index} has been tampered with.`,
      };
    }
    if (i > 0 && block.previous_hash !== blocks[i - 1].block_hash) {
      return {
        valid: false,
        block_count: blocks.length,
        message: `Block #${block.block_index} is not correctly linked to block #${blocks[i - 1].block_index}.`,
      };
    }
  }
  return {
    valid: true,
    block_count: blocks.length,
    message: `Chain is valid. All ${blocks.length} block(s) verified.`,
  };
}

// ---------------------------------------------------------------------------
// Glob matching helpers
// ---------------------------------------------------------------------------

/**
 * Minimal glob → RegExp without requiring extra npm packages.
 * Supports * ** and ? patterns.
 */
function globToRe(glob) {
  const esc = glob
    .replace(/\\/g, "/")
    .replace(/[.+^${}()|[\]]/g, "\\$&")
    .replace(/\*\*/g, "§DOUBLESTAR§")
    .replace(/\*/g, "[^/]*")
    .replace(/§DOUBLESTAR§/g, ".*")
    .replace(/\?/g, "[^/]");
  return new RegExp(`(^|/)${esc}($|/)`);
}

function isExcluded(filePath, patterns) {
  const normalized = filePath.replace(/\\/g, "/");
  return patterns.some((p) => globToRe(p).test(normalized));
}

// ---------------------------------------------------------------------------
// Extension state
// ---------------------------------------------------------------------------

let statusBar = null;
let disposables = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cfg(key) {
  return vscode.workspace.getConfiguration("agentctl").get(key);
}

function getLedgerPath() {
  const custom = cfg("ledgerPath");
  if (custom && custom.trim()) return custom.trim();
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return null;
  return path.join(folders[0].uri.fsPath, "ledger.md");
}

function relativeToWorkspace(absolutePath) {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return absolutePath;
  const root = folders[0].uri.fsPath;
  return path.relative(root, absolutePath).replace(/\\/g, "/");
}

function updateStatusBar(ledgerPath) {
  if (!statusBar) return;
  try {
    if (!ledgerPath || !fs.existsSync(ledgerPath)) {
      statusBar.text = "$(database) Ledger: no file";
      statusBar.tooltip = "AgentCtl: no ledger.md found.\nClick to open settings.";
      return;
    }
    const text = readLedger(ledgerPath);
    const { blocks } = parseSections(text);
    statusBar.text = `$(database) Ledger: ${blocks.length} blocks`;
    statusBar.tooltip = `AgentCtl ledger at ${ledgerPath}\nClick to open ledger.md`;
  } catch (_) {
    statusBar.text = "$(database) Ledger";
  }
}

function record(actionType, payload) {
  const ledgerPath = getLedgerPath();
  if (!ledgerPath) return;

  const agentId = cfg("agentId") || "antigravity";

  try {
    const block = appendBlock(ledgerPath, agentId, actionType, payload);
    updateStatusBar(ledgerPath);
    console.log(`[agentctl] Recorded block #${block.block_index}: ${actionType}`);
    return block;
  } catch (err) {
    console.error(`[agentctl] Failed to record: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

function onDidSaveTextDocument(doc) {
  if (!cfg("recordFileSaves")) return;

  const filePath = doc.uri.fsPath;
  const excludePatterns = cfg("excludePatterns") || [];
  if (isExcluded(filePath, excludePatterns)) return;

  const rel = relativeToWorkspace(filePath);
  const lineCount = doc.lineCount;
  const language = doc.languageId;

  record("file_saved", {
    file: rel,
    language,
    line_count: lineCount,
  });
}

function onDidCreateFiles(event) {
  if (!cfg("recordFileCreations")) return;
  const excludePatterns = cfg("excludePatterns") || [];

  for (const file of event.files) {
    const filePath = file.fsPath;
    if (isExcluded(filePath, excludePatterns)) continue;
    const rel = relativeToWorkspace(filePath);
    record("file_created", { file: rel });
  }
}

function onDidDeleteFiles(event) {
  if (!cfg("recordFileDeletions")) return;
  const excludePatterns = cfg("excludePatterns") || [];

  for (const file of event.files) {
    const filePath = file.fsPath;
    if (isExcluded(filePath, excludePatterns)) continue;
    const rel = relativeToWorkspace(filePath);
    record("file_deleted", { file: rel });
  }
}

function onDidRenameFiles(event) {
  const excludePatterns = cfg("excludePatterns") || [];

  for (const { oldUri, newUri } of event.files) {
    if (isExcluded(newUri.fsPath, excludePatterns)) continue;
    record("file_renamed", {
      from: relativeToWorkspace(oldUri.fsPath),
      to: relativeToWorkspace(newUri.fsPath),
    });
  }
}

// ---------------------------------------------------------------------------
// Extension lifecycle
// ---------------------------------------------------------------------------

function activate(context) {
  console.log("[agentctl] Extension activated.");

  // Status bar
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = "agentctl.openLedger";
  statusBar.show();
  context.subscriptions.push(statusBar);

  updateStatusBar(getLedgerPath());

  // Register file event listeners
  disposables.push(
    vscode.workspace.onDidSaveTextDocument(onDidSaveTextDocument),
    vscode.workspace.onDidCreateFiles(onDidCreateFiles),
    vscode.workspace.onDidDeleteFiles(onDidDeleteFiles),
    vscode.workspace.onDidRenameFiles(onDidRenameFiles)
  );

  // Re-read config when settings change
  disposables.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("agentctl")) {
        updateStatusBar(getLedgerPath());
      }
    })
  );

  // Command: open ledger.md
  disposables.push(
    vscode.commands.registerCommand("agentctl.openLedger", async () => {
      const ledgerPath = getLedgerPath();
      if (!ledgerPath) {
        vscode.window.showWarningMessage("AgentCtl: No workspace folder found.");
        return;
      }
      ensureGenesis(ledgerPath);
      const doc = await vscode.workspace.openTextDocument(ledgerPath);
      await vscode.window.showTextDocument(doc);
    })
  );

  // Command: record custom action
  disposables.push(
    vscode.commands.registerCommand("agentctl.recordCustomAction", async () => {
      const actionType = await vscode.window.showInputBox({
        prompt: "Action type (e.g. task_completed, analysis_done)",
        placeHolder: "action_type",
      });
      if (!actionType) return;

      const payloadStr = await vscode.window.showInputBox({
        prompt: "Payload JSON (optional)",
        placeHolder: '{"key": "value"}',
        value: "{}",
      });

      let payload = {};
      try {
        payload = JSON.parse(payloadStr || "{}");
      } catch (_) {
        vscode.window.showErrorMessage("AgentCtl: Invalid JSON payload.");
        return;
      }

      const block = record(actionType, payload);
      if (block) {
        vscode.window.showInformationMessage(
          `AgentCtl: Block #${block.block_index} recorded (${actionType})`
        );
      }
    })
  );

  // Command: verify chain
  disposables.push(
    vscode.commands.registerCommand("agentctl.verifyChain", () => {
      const ledgerPath = getLedgerPath();
      if (!ledgerPath) {
        vscode.window.showWarningMessage("AgentCtl: No workspace folder found.");
        return;
      }
      const result = verifyChain(ledgerPath);
      const icon = result.valid ? "✓" : "✗";
      const fn = result.valid
        ? vscode.window.showInformationMessage
        : vscode.window.showErrorMessage;
      fn(`AgentCtl ${icon}: ${result.message}`);
    })
  );

  context.subscriptions.push(...disposables);
}

function deactivate() {
  disposables.forEach((d) => d.dispose());
  disposables = [];
}

module.exports = { activate, deactivate };
