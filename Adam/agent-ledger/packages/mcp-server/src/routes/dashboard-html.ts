// ============================================================
// Dashboard HTML — Inline HTML/CSS/JS for the real-time dashboard
// ============================================================

export function getDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Ledger — Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #0a0e1a;
      --bg-secondary: #111827;
      --bg-card: rgba(17, 24, 39, 0.7);
      --bg-card-hover: rgba(30, 41, 59, 0.8);
      --border: rgba(99, 102, 241, 0.15);
      --border-hover: rgba(99, 102, 241, 0.3);
      --text-primary: #f1f5f9;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --accent-indigo: #818cf8;
      --accent-purple: #a78bfa;
      --accent-emerald: #34d399;
      --accent-amber: #fbbf24;
      --accent-rose: #fb7185;
      --accent-cyan: #22d3ee;
      --accent-blue: #60a5fa;
      --glow-indigo: rgba(99, 102, 241, 0.15);
      --glow-emerald: rgba(52, 211, 153, 0.15);
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      min-height: 100vh;
      overflow-x: hidden;
    }

    /* Background gradient animation */
    body::before {
      content: '';
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background:
        radial-gradient(ellipse at 20% 20%, rgba(99, 102, 241, 0.08) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 80%, rgba(139, 92, 246, 0.06) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 50%, rgba(52, 211, 153, 0.04) 0%, transparent 50%);
      z-index: -1;
      animation: bgShift 20s ease-in-out infinite alternate;
    }

    @keyframes bgShift {
      0% { opacity: 0.7; }
      100% { opacity: 1; }
    }

    /* Header */
    .header {
      padding: 24px 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border);
      backdrop-filter: blur(20px);
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(10, 14, 26, 0.85);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .logo {
      font-size: 24px;
      font-weight: 800;
      background: linear-gradient(135deg, var(--accent-indigo), var(--accent-purple));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.5px;
    }

    .logo-icon {
      font-size: 28px;
      filter: drop-shadow(0 0 8px rgba(99, 102, 241, 0.4));
    }

    .live-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 20px;
      background: rgba(52, 211, 153, 0.1);
      border: 1px solid rgba(52, 211, 153, 0.3);
      font-size: 12px;
      font-weight: 600;
      color: var(--accent-emerald);
    }

    .live-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--accent-emerald);
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.4); }
      50% { opacity: 0.7; box-shadow: 0 0 0 6px rgba(52, 211, 153, 0); }
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 16px;
      color: var(--text-secondary);
      font-size: 13px;
    }

    .uptime { font-family: 'JetBrains Mono', monospace; color: var(--text-muted); }

    /* Main Content */
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 32px 40px;
    }

    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 32px;
    }

    .stat-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 20px 24px;
      backdrop-filter: blur(12px);
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }

    .stat-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, var(--accent-indigo), transparent);
      opacity: 0;
      transition: opacity 0.3s;
    }

    .stat-card:hover { border-color: var(--border-hover); transform: translateY(-2px); }
    .stat-card:hover::before { opacity: 1; }

    .stat-label {
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-muted);
      margin-bottom: 8px;
    }

    .stat-value {
      font-size: 32px;
      font-weight: 800;
      font-family: 'JetBrains Mono', monospace;
      background: linear-gradient(135deg, var(--text-primary), var(--accent-indigo));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .stat-card.highlight .stat-value {
      background: linear-gradient(135deg, var(--accent-emerald), var(--accent-cyan));
      -webkit-background-clip: text;
    }

    .stat-card.warning .stat-value {
      background: linear-gradient(135deg, var(--accent-amber), var(--accent-rose));
      -webkit-background-clip: text;
    }

    /* Section */
    .section {
      margin-bottom: 32px;
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .section-title {
      font-size: 16px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .section-count {
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 10px;
      background: rgba(99, 102, 241, 0.15);
      color: var(--accent-indigo);
      font-weight: 600;
      font-family: 'JetBrains Mono', monospace;
    }

    /* Main Grid Layout */
    .main-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }

    .full-width { grid-column: 1 / -1; }

    /* Tables */
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
      backdrop-filter: blur(12px);
    }

    .card-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .card-title {
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th {
      text-align: left;
      padding: 10px 16px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      border-bottom: 1px solid var(--border);
    }

    td {
      padding: 12px 16px;
      font-size: 13px;
      border-bottom: 1px solid rgba(99, 102, 241, 0.06);
      transition: background 0.2s;
    }

    tr:hover td { background: rgba(99, 102, 241, 0.04); }
    tr:last-child td { border-bottom: none; }

    .mono {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
    }

    /* Badges */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .badge-orchestrator { background: rgba(251, 113, 133, 0.12); color: var(--accent-rose); border: 1px solid rgba(251, 113, 133, 0.2); }
    .badge-worker { background: rgba(96, 165, 250, 0.12); color: var(--accent-blue); border: 1px solid rgba(96, 165, 250, 0.2); }
    .badge-observer { background: rgba(148, 163, 184, 0.12); color: var(--text-secondary); border: 1px solid rgba(148, 163, 184, 0.2); }
    .badge-human { background: rgba(251, 191, 36, 0.12); color: var(--accent-amber); border: 1px solid rgba(251, 191, 36, 0.2); }

    .badge-active { background: rgba(52, 211, 153, 0.12); color: var(--accent-emerald); border: 1px solid rgba(52, 211, 153, 0.2); }
    .badge-pending { background: rgba(251, 191, 36, 0.12); color: var(--accent-amber); border: 1px solid rgba(251, 191, 36, 0.2); }
    .badge-complete { background: rgba(99, 102, 241, 0.12); color: var(--accent-indigo); border: 1px solid rgba(99, 102, 241, 0.2); }
    .badge-orphaned { background: rgba(251, 113, 133, 0.12); color: var(--accent-rose); border: 1px solid rgba(251, 113, 133, 0.2); }
    .badge-file { background: rgba(34, 211, 238, 0.12); color: var(--accent-cyan); border: 1px solid rgba(34, 211, 238, 0.2); }

    /* Event Feed */
    .event-item {
      padding: 14px 20px;
      border-bottom: 1px solid rgba(99, 102, 241, 0.06);
      transition: background 0.2s;
      animation: fadeIn 0.4s ease-out;
    }

    .event-item:hover { background: rgba(99, 102, 241, 0.04); }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .event-top {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;
    }

    .event-agent {
      font-weight: 600;
      font-size: 13px;
    }

    .event-time {
      font-size: 11px;
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
      margin-left: auto;
    }

    .event-intent {
      font-size: 13px;
      color: var(--text-secondary);
      padding-left: 4px;
    }

    .event-resource {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: var(--accent-cyan);
    }

    /* Milestones */
    .milestone-item {
      padding: 16px 20px;
      border-bottom: 1px solid rgba(99, 102, 241, 0.06);
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .milestone-icon {
      font-size: 20px;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .milestone-desc {
      font-size: 14px;
      font-weight: 500;
    }

    .milestone-time {
      font-size: 11px;
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
      margin-top: 4px;
    }

    /* Queue */
    .queue-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: rgba(251, 191, 36, 0.06);
      border-bottom: 1px solid rgba(251, 191, 36, 0.1);
      font-size: 12px;
      color: var(--accent-amber);
    }

    .empty-state {
      padding: 32px 20px;
      text-align: center;
      color: var(--text-muted);
      font-size: 13px;
    }

    .empty-icon { font-size: 28px; margin-bottom: 8px; opacity: 0.5; }

    /* Responsive */
    @media (max-width: 1024px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .main-grid { grid-template-columns: 1fr; }
      .container { padding: 20px; }
      .header { padding: 16px 20px; }
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="header-left">
      <span class="logo-icon">🔒</span>
      <span class="logo">Agent Ledger</span>
      <div class="live-badge">
        <span class="live-dot"></span>
        LIVE
      </div>
    </div>
    <div class="header-right">
      <span>Refresh: 2s</span>
      <span class="uptime" id="uptime">—</span>
    </div>
  </header>

  <div class="container">
    <!-- Stats -->
    <div class="stats-grid">
      <div class="stat-card highlight">
        <div class="stat-label">Agents Online</div>
        <div class="stat-value" id="stat-agents">—</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Active Leases</div>
        <div class="stat-value" id="stat-leases">—</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Events</div>
        <div class="stat-value" id="stat-events">—</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-label">Queued Requests</div>
        <div class="stat-value" id="stat-queued">—</div>
      </div>
    </div>

    <!-- Main Grid -->
    <div class="main-grid">
      <!-- Agents -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">👤 Registered Agents <span class="section-count" id="agents-count">0</span></div>
        </div>
        <div id="agents-table">
          <div class="empty-state"><div class="empty-icon">👤</div>No agents registered yet</div>
        </div>
      </div>

      <!-- Active Leases -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">🔑 Active Leases <span class="section-count" id="leases-count">0</span></div>
        </div>
        <div id="leases-content">
          <div class="empty-state"><div class="empty-icon">🔓</div>No active leases</div>
        </div>
      </div>

      <!-- Live Event Feed -->
      <div class="card full-width">
        <div class="card-header">
          <div class="card-title">⚡ Live Event Feed <span class="section-count" id="events-count">0</span></div>
        </div>
        <div id="events-feed" style="max-height:400px;overflow-y:auto">
          <div class="empty-state"><div class="empty-icon">📭</div>No events yet</div>
        </div>
      </div>

      <!-- Milestones -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">🏆 Milestones <span class="section-count" id="milestones-count">0</span></div>
        </div>
        <div id="milestones-list">
          <div class="empty-state"><div class="empty-icon">🏆</div>No milestones declared</div>
        </div>
      </div>

      <!-- Queue -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">⏳ Lease Queue <span class="section-count" id="queue-count">0</span></div>
        </div>
        <div id="queue-content">
          <div class="empty-state"><div class="empty-icon">✅</div>Queue empty — no conflicts</div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const API_URL = '/dashboard/data';
    let lastEventCount = 0;

    function formatTime(epoch) {
      if (!epoch) return '—';
      const d = new Date(epoch * 1000);
      return d.toLocaleTimeString('en-US', { hour12: false });
    }

    function formatUptime(seconds) {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return h > 0 ? h + 'h ' + m + 'm ' + s + 's' : m + 'm ' + s + 's';
    }

    function tierBadge(tier) {
      return '<span class="badge badge-' + tier + '">' + tier + '</span>';
    }

    function statusBadge(status) {
      return '<span class="badge badge-' + status + '">' + status + '</span>';
    }

    function renderAgents(agents) {
      document.getElementById('agents-count').textContent = agents.length;
      if (agents.length === 0) {
        document.getElementById('agents-table').innerHTML =
          '<div class="empty-state"><div class="empty-icon">👤</div>No agents registered yet</div>';
        return;
      }
      let html = '<table><thead><tr><th>Agent</th><th>Tier</th><th>Session</th><th>Registered</th></tr></thead><tbody>';
      for (const a of agents) {
        html += '<tr>' +
          '<td style="font-weight:600">' + a.agent_id + '</td>' +
          '<td>' + tierBadge(a.tier) + '</td>' +
          '<td class="mono">' + a.session_id + '</td>' +
          '<td class="mono" style="color:var(--text-muted)">' + formatTime(a.registered_at) + '</td>' +
          '</tr>';
      }
      html += '</tbody></table>';
      document.getElementById('agents-table').innerHTML = html;
    }

    function renderLeases(leases) {
      document.getElementById('leases-count').textContent = leases.active.length;
      if (leases.active.length === 0) {
        document.getElementById('leases-content').innerHTML =
          '<div class="empty-state"><div class="empty-icon">🔓</div>No active leases</div>';
        return;
      }
      let html = '<table><thead><tr><th>Agent</th><th>Resource</th><th>Scope</th><th>Granted</th></tr></thead><tbody>';
      for (const l of leases.active) {
        const range = (l.line_start != null && l.line_end != null) ? ' :' + l.line_start + '-' + l.line_end : '';
        html += '<tr>' +
          '<td style="font-weight:600">' + l.agent_id + '</td>' +
          '<td class="event-resource">' + l.resource + range + '</td>' +
          '<td><span class="badge badge-file">' + l.scope + '</span></td>' +
          '<td class="mono" style="color:var(--text-muted)">' + formatTime(l.granted_at) + '</td>' +
          '</tr>';
      }
      html += '</tbody></table>';
      document.getElementById('leases-content').innerHTML = html;
    }

    function renderEvents(events) {
      document.getElementById('events-count').textContent = events.length;
      if (events.length === 0) {
        document.getElementById('events-feed').innerHTML =
          '<div class="empty-state"><div class="empty-icon">📭</div>No events yet</div>';
        return;
      }
      let html = '';
      for (const e of events) {
        const isNew = events.length > lastEventCount;
        html += '<div class="event-item">' +
          '<div class="event-top">' +
            '<span class="event-agent">' + e.agent_id + '</span>' +
            statusBadge(e.status) +
            (e.resource ? '<span class="event-resource">' + e.resource + '</span>' : '') +
            '<span class="event-time">' + formatTime(e.created_at) + '</span>' +
          '</div>' +
          (e.intent ? '<div class="event-intent">"' + e.intent + '"</div>' : '') +
          '</div>';
      }
      document.getElementById('events-feed').innerHTML = html;
      lastEventCount = events.length;
    }

    function renderMilestones(milestones) {
      document.getElementById('milestones-count').textContent = milestones.length;
      if (milestones.length === 0) {
        document.getElementById('milestones-list').innerHTML =
          '<div class="empty-state"><div class="empty-icon">🏆</div>No milestones declared</div>';
        return;
      }
      let html = '';
      for (const m of milestones) {
        html += '<div class="milestone-item">' +
          '<span class="milestone-icon">🏆</span>' +
          '<div>' +
            '<div class="milestone-desc">' + m.description + '</div>' +
            '<div class="milestone-time">' + formatTime(m.created_at) + '</div>' +
          '</div>' +
          '</div>';
      }
      document.getElementById('milestones-list').innerHTML = html;
    }

    function renderQueue(queued) {
      document.getElementById('queue-count').textContent = queued.length;
      if (queued.length === 0) {
        document.getElementById('queue-content').innerHTML =
          '<div class="empty-state"><div class="empty-icon">✅</div>Queue empty — no conflicts</div>';
        return;
      }
      let html = '<table><thead><tr><th>#</th><th>Agent</th><th>Resource</th><th>Priority</th><th>Waiting Since</th></tr></thead><tbody>';
      queued.forEach((q, i) => {
        html += '<tr>' +
          '<td class="mono">' + (i + 1) + '</td>' +
          '<td style="font-weight:600">' + q.agent_id + '</td>' +
          '<td class="event-resource">' + q.resource + '</td>' +
          '<td><span class="badge badge-pending">P' + q.priority + '</span></td>' +
          '<td class="mono" style="color:var(--text-muted)">' + formatTime(q.queued_at) + '</td>' +
          '</tr>';
      });
      html += '</tbody></table>';
      document.getElementById('queue-content').innerHTML = html;
    }

    async function refresh() {
      try {
        const res = await fetch(API_URL);
        const data = await res.json();

        // Stats
        document.getElementById('stat-agents').textContent = data.stats.total_agents;
        document.getElementById('stat-leases').textContent = data.stats.active_leases;
        document.getElementById('stat-events').textContent = data.stats.total_events;
        document.getElementById('stat-queued').textContent = data.stats.queued_requests;
        document.getElementById('uptime').textContent = 'Uptime: ' + formatUptime(data.uptime);

        // Sections
        renderAgents(data.agents);
        renderLeases(data.leases);
        renderEvents(data.events);
        renderMilestones(data.milestones);
        renderQueue(data.leases.queued);
      } catch (e) {
        console.error('Dashboard refresh failed:', e);
      }
    }

    // Initial + interval
    refresh();
    setInterval(refresh, 2000);
  </script>
</body>
</html>`;
}
