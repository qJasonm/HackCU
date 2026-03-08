"use strict";
// ============================================================
// Sidebar Provider — Ledger Dashboard Webview
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerSidebarProvider = void 0;
class LedgerSidebarProvider {
    extensionUri;
    webviewView;
    client;
    constructor(extensionUri, client) {
        this.extensionUri = extensionUri;
        this.client = client;
    }
    resolveWebviewView(webviewView) {
        this.webviewView = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
        };
        webviewView.webview.html = this.getHtml();
    }
    updateStatus(status) {
        if (this.webviewView) {
            this.webviewView.webview.postMessage({ type: 'status', data: status });
        }
    }
    getHtml() {
        return `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      padding: 12px;
    }
    .header {
      font-size: 14px;
      font-weight: bold;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .stat {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      border-bottom: 1px solid var(--vscode-widget-border);
    }
    .label { opacity: 0.8; }
    .value { font-weight: bold; }
    .empty {
      text-align: center;
      opacity: 0.5;
      padding: 20px 0;
    }
  </style>
</head>
<body>
  <div class="header">🔒 Agent Ledger</div>
  <div id="content">
    <div class="empty">Click refresh to load status</div>
  </div>
  <script>
    const content = document.getElementById('content');
    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.type === 'status') {
        const s = msg.data;
        content.innerHTML = \`
          <div class="stat"><span class="label">Agents</span><span class="value">\${s.agents}</span></div>
          <div class="stat"><span class="label">Active Leases</span><span class="value">\${s.active_leases}</span></div>
          <div class="stat"><span class="label">Queued</span><span class="value">\${s.queued_requests}</span></div>
          <div class="stat"><span class="label">Events</span><span class="value">\${s.total_events}</span></div>
          <div class="stat"><span class="label">Pending</span><span class="value">\${s.pending_events}</span></div>
          <div class="stat"><span class="label">Milestones</span><span class="value">\${s.milestones}</span></div>
          <div class="stat"><span class="label">JWT Mode</span><span class="value">\${s.jwt_mode}</span></div>
          <div class="stat"><span class="label">Uptime</span><span class="value">\${Math.floor(s.server_uptime)}s</span></div>
        \`;
      }
    });
  </script>
</body>
</html>`;
    }
}
exports.LedgerSidebarProvider = LedgerSidebarProvider;
//# sourceMappingURL=sidebar.js.map