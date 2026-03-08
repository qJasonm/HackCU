// ============================================================
// Agent Ledger VS Code Extension — Entry Point
// ============================================================

import * as vscode from 'vscode';
import { LedgerClient } from './ledger-client.js';
import { FileWatcher } from './file-watcher.js';
import { LedgerSidebarProvider } from './sidebar.js';

let ledgerClient: LedgerClient;
let fileWatcher: FileWatcher;

export async function activate(context: vscode.ExtensionContext) {
  console.log('Agent Ledger extension activated');

  // Initialize client
  const config = vscode.workspace.getConfiguration('agentLedger');
  const serverUrl = config.get<string>('serverUrl', 'http://localhost:3000');

  ledgerClient = new LedgerClient(serverUrl);

  // Register sidebar
  const sidebarProvider = new LedgerSidebarProvider(context.extensionUri, ledgerClient);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('agentLedgerSidebar', sidebarProvider)
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('agent-ledger.refreshStatus', async () => {
      try {
        const status = await ledgerClient.getStatus();
        sidebarProvider.updateStatus(status);
        vscode.window.showInformationMessage(`Agent Ledger: ${status.agents} agents, ${status.active_leases} leases`);
      } catch (err: any) {
        vscode.window.showErrorMessage(`Agent Ledger: ${err.message}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('agent-ledger.register', async () => {
      const agentId = await vscode.window.showInputBox({ prompt: 'Agent ID' });
      if (!agentId) return;

      const tier = await vscode.window.showQuickPick(
        ['orchestrator', 'worker', 'observer', 'human'],
        { placeHolder: 'Select trust tier' }
      );
      if (!tier) return;

      try {
        const result = await ledgerClient.register(agentId, tier);
        vscode.window.showInformationMessage(`Registered ${agentId} as ${tier}`);
      } catch (err: any) {
        vscode.window.showErrorMessage(`Registration failed: ${err.message}`);
      }
    })
  );

  // File watcher for unauthorized edit detection
  fileWatcher = new FileWatcher(ledgerClient);
  context.subscriptions.push(fileWatcher);

  // Start watching if workspace is open
  if (vscode.workspace.workspaceFolders) {
    fileWatcher.start();
  }
}

export function deactivate() {
  fileWatcher?.dispose();
}
