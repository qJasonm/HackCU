"use strict";
// ============================================================
// Ledger Client — HTTP client for VS Code extension
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerClient = void 0;
class LedgerClient {
    serverUrl;
    token = null;
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
    }
    setToken(token) {
        this.token = token;
    }
    async request(method, path, body) {
        const headers = {
            'Content-Type': 'application/json',
        };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        const res = await fetch(`${this.serverUrl}${path}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });
        const data = await res.json();
        if (!res.ok)
            throw new Error(`${data.error}: ${data.message}`);
        return data;
    }
    async register(agentId, tier) {
        const result = await this.request('POST', '/auth/register', { agent_id: agentId, tier });
        this.token = result.token;
        return result;
    }
    async getStatus() {
        return this.request('GET', '/admin/status');
    }
    async notifyExternalEdit(resource, start, end) {
        return this.request('POST', '/sync/notify-external-edit', {
            resource,
            changed_lines: { start, end },
        });
    }
    async health() {
        try {
            await this.request('GET', '/health');
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.LedgerClient = LedgerClient;
//# sourceMappingURL=ledger-client.js.map