#!/usr/bin/env node
// ============================================================
// MCP Stdio Bridge — Exposes Agent Ledger as MCP Tools
// ============================================================
// This process runs as a stdio MCP server. AI agents (Antigravity,
// Claude, Copilot, etc.) communicate with it over stdin/stdout.
// It translates MCP tool calls into HTTP requests to the REST API.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { LEDGER_TOOLS } from './tools.js';
// ---- Configuration ----
const SERVER_URL = process.env.LEDGER_SERVER_URL || 'http://localhost:3000';
// Token storage — persists across tool calls within a session
let currentToken = null;
let currentAgentId = null;
// ---- HTTP Client ----
async function ledgerRequest(method, path, body, requireAuth = true) {
    const headers = {
        'Content-Type': 'application/json',
    };
    if (requireAuth) {
        if (!currentToken) {
            throw new Error('Not registered. Call ledger_register first to get a token.');
        }
        headers['Authorization'] = `Bearer ${currentToken}`;
    }
    const res = await fetch(`${SERVER_URL}${path}`, {
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
// ---- Tool Handlers ----
async function handleToolCall(name, args) {
    switch (name) {
        // ---- Registration ----
        case 'ledger_register': {
            const result = await ledgerRequest('POST', '/auth/register', { agent_id: args.agent_id, tier: args.tier }, false);
            currentToken = result.token;
            currentAgentId = result.agent_id;
            return JSON.stringify({
                status: 'registered',
                agent_id: result.agent_id,
                tier: result.tier,
                session_id: result.session_id,
                expires_at: new Date(result.expires_at * 1000).toISOString(),
                message: `Registered as ${result.agent_id} (${result.tier}). You can now acquire leases and report events.`,
            }, null, 2);
        }
        // ---- Lease Management ----
        case 'ledger_acquire_lease': {
            const result = await ledgerRequest('POST', '/lease/acquire', {
                resource: args.resource,
                scope: args.scope,
                line_start: args.line_start,
                line_end: args.line_end,
            });
            if (result.granted) {
                return JSON.stringify({
                    status: 'granted',
                    lease_id: result.lease.lease_id,
                    resource: args.resource,
                    scope: args.scope,
                    message: `Lease granted. You may now edit ${args.resource}. Remember to call ledger_report_intent before editing and ledger_release_lease when done.`,
                }, null, 2);
            }
            else {
                return JSON.stringify({
                    status: 'queued',
                    queue_position: result.queue_position,
                    request_id: result.request_id,
                    resource: args.resource,
                    message: `File is locked by another agent. You are queued at position ${result.queue_position}. Work on a different file and check back later, or call ledger_status to see who holds the lock.`,
                }, null, 2);
            }
        }
        case 'ledger_release_lease': {
            await ledgerRequest('POST', '/lease/release', {
                lease_id: args.lease_id,
            });
            return JSON.stringify({
                status: 'released',
                lease_id: args.lease_id,
                message: 'Lease released. Any queued agents will be granted the lock automatically.',
            });
        }
        case 'ledger_heartbeat': {
            await ledgerRequest('POST', '/lease/heartbeat', {
                lease_id: args.lease_id,
            });
            return JSON.stringify({
                status: 'ok',
                message: 'Heartbeat received. Lease expiry extended.',
            });
        }
        // ---- Event Logging ----
        case 'ledger_report_intent': {
            const result = await ledgerRequest('POST', '/ledger/report-intent', {
                resource: args.resource,
                intent: args.intent,
                parent_event_id: args.parent_event_id,
            });
            return JSON.stringify({
                status: 'logged',
                event_id: result.event_id,
                correlation_id: result.correlation_id,
                message: `Intent logged as ${result.event_id}. Proceed with your edit, then call ledger_report_action with this event_id when done.`,
            }, null, 2);
        }
        case 'ledger_report_action': {
            const result = await ledgerRequest('POST', '/ledger/report-action', {
                event_id: args.event_id,
                ground_truth: args.ground_truth,
            });
            return JSON.stringify({
                status: 'complete',
                event_id: result.event_id,
                message: 'Action recorded with ground truth. The audit trail is complete.',
            });
        }
        // ---- Querying ----
        case 'ledger_read_history': {
            const agentId = args.agent_id || currentAgentId;
            const count = args.count || 10;
            const result = await ledgerRequest('GET', `/ledger/latest?agent_id=${agentId}&count=${count}`);
            const entries = result.entries.map((e) => ({
                time: new Date(e.created_at * 1000).toISOString(),
                type: e.type,
                status: e.status,
                resource: e.resource,
                intent: e.intent,
            }));
            return JSON.stringify({
                agent_id: result.agent_id,
                count: entries.length,
                entries,
            }, null, 2);
        }
        case 'ledger_search': {
            const limit = args.limit || 20;
            const result = await ledgerRequest('GET', `/ledger/query?q=${encodeURIComponent(args.query)}&limit=${limit}`);
            const results = result.results.map((e) => ({
                event_id: e.event_id,
                agent: e.agent_id,
                time: new Date(e.created_at * 1000).toISOString(),
                resource: e.resource,
                intent: e.intent,
                status: e.status,
            }));
            return JSON.stringify({
                query: args.query,
                count: result.count,
                results,
            }, null, 2);
        }
        case 'ledger_status': {
            const result = await ledgerRequest('GET', '/admin/status');
            return JSON.stringify({
                agents: result.agents,
                active_leases: result.active_leases,
                queued_requests: result.queued_requests,
                total_events: result.total_events,
                pending_events: result.pending_events,
                milestones: result.milestones,
                jwt_mode: result.jwt_mode,
                uptime_seconds: Math.floor(result.server_uptime),
            }, null, 2);
        }
        // ---- Milestones ----
        case 'ledger_declare_milestone': {
            const result = await ledgerRequest('POST', '/ledger/milestone', {
                description: args.description,
            });
            return JSON.stringify({
                milestone_id: result.milestone_id,
                description: result.description,
                message: 'Milestone declared and recorded.',
            });
        }
        // ---- Sync ----
        case 'ledger_check_sync': {
            const result = await ledgerRequest('GET', '/sync/pending');
            if (result.count === 0) {
                return JSON.stringify({
                    status: 'clear',
                    message: 'No pending sync notifications. You are free to continue working.',
                });
            }
            return JSON.stringify({
                status: 'sync_required',
                count: result.count,
                pending: result.pending.map((e) => ({
                    event_id: e.event_id,
                    resource: e.resource,
                    lines: `${e.change_start}-${e.change_end}`,
                    detected_at: new Date(e.detected_at * 1000).toISOString(),
                })),
                message: `${result.count} external edits need your acknowledgement. Review the changes and call ledger_acknowledge_sync for each.`,
            }, null, 2);
        }
        case 'ledger_acknowledge_sync': {
            const result = await ledgerRequest('POST', '/sync/acknowledge', {
                event_id: args.event_id,
            });
            return JSON.stringify({
                acknowledged: true,
                freeze_lifted: result.freeze_lifted,
                message: result.freeze_lifted
                    ? 'All agents acknowledged. Freeze lifted — you can resume editing.'
                    : 'Acknowledged. Waiting for other agents to acknowledge before freeze is lifted.',
            });
        }
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}
// ---- MCP Server ----
const server = new Server({
    name: 'agent-ledger',
    version: '1.0.0',
}, {
    capabilities: {
        tools: {},
    },
});
// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: LEDGER_TOOLS,
}));
// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        const result = await handleToolCall(name, args);
        return {
            content: [{ type: 'text', text: result }],
        };
    }
    catch (err) {
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        error: true,
                        message: err.message,
                        hint: err.message.includes('Not registered')
                            ? 'Call ledger_register first with your agent_id and tier.'
                            : err.message.includes('ECONNREFUSED')
                                ? 'The Agent Ledger server is not running. Start it with: node packages/mcp-server/dist/index.js'
                                : undefined,
                    }),
                },
            ],
            isError: true,
        };
    }
});
// ---- Start ----
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('🔒 Agent Ledger MCP Bridge running (stdio mode)');
    console.error(`   Connecting to: ${SERVER_URL}`);
}
main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=bridge.js.map