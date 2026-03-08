// ============================================================
// HTTP Client — Fetch wrapper for MCP server
// ============================================================

interface ClientOptions {
  serverUrl: string;
  token?: string;
}

let defaultOptions: ClientOptions = {
  serverUrl: 'http://localhost:3000',
};

export function setClientOptions(opts: Partial<ClientOptions>): void {
  defaultOptions = { ...defaultOptions, ...opts };
}

export function getToken(): string | undefined {
  return defaultOptions.token;
}

export function setToken(token: string): void {
  defaultOptions.token = token;
}

async function request<T = any>(
  method: string,
  path: string,
  body?: any
): Promise<T> {
  const url = `${defaultOptions.serverUrl}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (defaultOptions.token) {
    headers['Authorization'] = `Bearer ${defaultOptions.token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`${data.error}: ${data.message}`);
  }

  return data as T;
}

export const client = {
  get: <T = any>(path: string) => request<T>('GET', path),
  post: <T = any>(path: string, body?: any) => request<T>('POST', path, body),
};
