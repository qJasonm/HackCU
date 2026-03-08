// ============================================================
// Ledger Client — HTTP client for VS Code extension
// ============================================================

export class LedgerClient {
  private serverUrl: string;
  private token: string | null = null;

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  setToken(token: string): void {
    this.token = token;
  }

  private async request(method: string, path: string, body?: any): Promise<any> {
    const headers: Record<string, string> = {
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
    if (!res.ok) throw new Error(`${data.error}: ${data.message}`);
    return data;
  }

  async register(agentId: string, tier: string): Promise<any> {
    const result = await this.request('POST', '/auth/register', { agent_id: agentId, tier });
    this.token = result.token;
    return result;
  }

  async getStatus(): Promise<any> {
    return this.request('GET', '/admin/status');
  }

  async notifyExternalEdit(resource: string, start: number, end: number): Promise<any> {
    return this.request('POST', '/sync/notify-external-edit', {
      resource,
      changed_lines: { start, end },
    });
  }

  async health(): Promise<boolean> {
    try {
      await this.request('GET', '/health');
      return true;
    } catch {
      return false;
    }
  }
}
