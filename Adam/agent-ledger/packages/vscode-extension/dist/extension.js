"use strict";
// ============================================================
// Agent Ledger VS Code Extension — Entry Point
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const ledger_client_js_1 = require("./ledger-client.js");
const file_watcher_js_1 = require("./file-watcher.js");
const sidebar_js_1 = require("./sidebar.js");
let ledgerClient;
let fileWatcher;
async function activate(context) {
    console.log('Agent Ledger extension activated');
    // Initialize client
    const config = vscode.workspace.getConfiguration('agentLedger');
    const serverUrl = config.get('serverUrl', 'http://localhost:3000');
    ledgerClient = new ledger_client_js_1.LedgerClient(serverUrl);
    // Register sidebar
    const sidebarProvider = new sidebar_js_1.LedgerSidebarProvider(context.extensionUri, ledgerClient);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('agentLedgerSidebar', sidebarProvider));
    // Register commands
    context.subscriptions.push(vscode.commands.registerCommand('agent-ledger.refreshStatus', async () => {
        try {
            const status = await ledgerClient.getStatus();
            sidebarProvider.updateStatus(status);
            vscode.window.showInformationMessage(`Agent Ledger: ${status.agents} agents, ${status.active_leases} leases`);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Agent Ledger: ${err.message}`);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('agent-ledger.register', async () => {
        const agentId = await vscode.window.showInputBox({ prompt: 'Agent ID' });
        if (!agentId)
            return;
        const tier = await vscode.window.showQuickPick(['orchestrator', 'worker', 'observer', 'human'], { placeHolder: 'Select trust tier' });
        if (!tier)
            return;
        try {
            const result = await ledgerClient.register(agentId, tier);
            vscode.window.showInformationMessage(`Registered ${agentId} as ${tier}`);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Registration failed: ${err.message}`);
        }
    }));
    // File watcher for unauthorized edit detection
    fileWatcher = new file_watcher_js_1.FileWatcher(ledgerClient);
    context.subscriptions.push(fileWatcher);
    // Start watching if workspace is open
    if (vscode.workspace.workspaceFolders) {
        fileWatcher.start();
    }
}
function deactivate() {
    fileWatcher?.dispose();
}
//# sourceMappingURL=extension.js.map