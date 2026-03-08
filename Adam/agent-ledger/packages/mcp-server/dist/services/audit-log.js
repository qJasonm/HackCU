// ============================================================
// Audit Log Service — Append-Only Markdown Log
// ============================================================
import { appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
export class AuditLogService {
    logDir;
    constructor(logDir) {
        this.logDir = join(process.cwd(), logDir);
        if (!existsSync(this.logDir)) {
            mkdirSync(this.logDir, { recursive: true });
        }
    }
    getLogPath() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return join(this.logDir, `agent_log_${year}-${month}.md`);
    }
    appendEntry(event) {
        const logPath = this.getLogPath();
        const timestamp = new Date(event.created_at * 1000).toISOString().replace('T', ' ').slice(0, 19);
        let groundTruth = '';
        if (event.ground_truth) {
            const gt = typeof event.ground_truth === 'string'
                ? JSON.parse(event.ground_truth)
                : event.ground_truth;
            if (gt.diff)
                groundTruth = `\n**Diff:** ${gt.diff}`;
            if (gt.action)
                groundTruth += `\n**Action:** ${gt.action}`;
            if (gt.exit_code !== undefined)
                groundTruth += ` | Exit: ${gt.exit_code}`;
        }
        const entry = `
## [${timestamp}] | Agent: ${event.agent_id} | CID: ${event.correlation_id} | Status: ${event.status}
**Type:** ${event.type} | **Tree Depth:** ${event.tree_depth}${event.parent_event_id ? ` (parent: ${event.parent_event_id})` : ' (root)'}
**Resource:** \`${event.resource || 'N/A'}\`${event.lease_scope ? ` | **Scope:** ${event.lease_scope}` : ''}
${event.intent ? `**Intent:** "${event.intent}"` : ''}${groundTruth}

---
`;
        try {
            appendFileSync(logPath, entry, 'utf-8');
        }
        catch (err) {
            console.error(`[AUDIT-LOG] Failed to write to ${logPath}:`, err);
        }
    }
}
//# sourceMappingURL=audit-log.js.map