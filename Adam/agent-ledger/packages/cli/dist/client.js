// ============================================================
// HTTP Client — Fetch wrapper for MCP server
// ============================================================
let defaultOptions = {
    serverUrl: 'http://localhost:3000',
};
export function setClientOptions(opts) {
    defaultOptions = { ...defaultOptions, ...opts };
}
export function getToken() {
    return defaultOptions.token;
}
export function setToken(token) {
    defaultOptions.token = token;
}
async function request(method, path, body) {
    const url = `${defaultOptions.serverUrl}${path}`;
    const headers = {
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
    return data;
}
export const client = {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
};
//# sourceMappingURL=client.js.map