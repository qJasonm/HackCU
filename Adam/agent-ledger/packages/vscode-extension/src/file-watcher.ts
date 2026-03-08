// ============================================================
// File Watcher — Detect unauthorized external edits
// ============================================================

import * as vscode from 'vscode';
import { LedgerClient } from './ledger-client.js';

export class FileWatcher implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private client: LedgerClient;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(client: LedgerClient) {
    this.client = client;
  }

  start(): void {
    // Watch for text document changes
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.contentChanges.length === 0) return;

        const uri = event.document.uri.fsPath;

        // Debounce: wait 500ms after last change before reporting
        const existing = this.debounceTimers.get(uri);
        if (existing) clearTimeout(existing);

        const changes = event.contentChanges;
        const minLine = Math.min(...changes.map(c => c.range.start.line));
        const maxLine = Math.max(...changes.map(c => c.range.end.line));

        this.debounceTimers.set(uri, setTimeout(() => {
          this.reportEdit(uri, minLine, maxLine);
          this.debounceTimers.delete(uri);
        }, 500));
      })
    );
  }

  private async reportEdit(resource: string, startLine: number, endLine: number): Promise<void> {
    try {
      await this.client.notifyExternalEdit(resource, startLine, endLine);
    } catch {
      // Silently fail — server might not be running
    }
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
    for (const timer of this.debounceTimers.values()) clearTimeout(timer);
  }
}
