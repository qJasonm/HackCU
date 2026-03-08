// ============================================================
// MCP Tool Definitions — Agent Ledger Tools for AI Agents
// ============================================================
// This file defines all the tools that AI agents can invoke
// via the Model Context Protocol (MCP) standard.
export const LEDGER_TOOLS = [
    // ---- Registration ----
    {
        name: 'ledger_register',
        description: 'Register yourself as an agent with the Agent Ledger. You MUST call this before any other ledger tool. ' +
            'Choose a unique agent_id and a tier: "orchestrator" (full admin), "worker" (can edit, max 3 files), ' +
            '"observer" (read-only), or "human" (trusted). Returns a JWT token used for all subsequent calls.',
        inputSchema: {
            type: 'object',
            properties: {
                agent_id: {
                    type: 'string',
                    description: 'Your unique agent identifier (e.g. "gemini-coder-1", "claude-reviewer")',
                },
                tier: {
                    type: 'string',
                    enum: ['orchestrator', 'worker', 'observer', 'human'],
                    description: 'Trust tier determining your permissions',
                },
            },
            required: ['agent_id', 'tier'],
        },
    },
    // ---- Lease Management ----
    {
        name: 'ledger_acquire_lease',
        description: 'Acquire a lease (lock) on a file BEFORE editing it. This prevents other agents from editing the same file simultaneously. ' +
            'If the file is already locked by another agent, your request is QUEUED and you should work on something else until it\'s granted. ' +
            'You MUST acquire a lease before making any file edits. Scope can be "file" (entire file), "symbol" (a function/class), or "region" (line range).',
        inputSchema: {
            type: 'object',
            properties: {
                resource: {
                    type: 'string',
                    description: 'File path to lock (e.g. "src/auth.ts", "lib/utils.py")',
                },
                scope: {
                    type: 'string',
                    enum: ['file', 'symbol', 'region'],
                    description: 'Granularity of the lock. Use "file" unless you only need a specific function or line range.',
                },
                line_start: {
                    type: 'number',
                    description: 'Start line (only for "region" scope)',
                },
                line_end: {
                    type: 'number',
                    description: 'End line (only for "region" scope)',
                },
            },
            required: ['resource', 'scope'],
        },
    },
    {
        name: 'ledger_release_lease',
        description: 'Release a lease (unlock a file) when you are done editing. This allows queued agents to proceed. ' +
            'Always release your leases when finished — stale leases are auto-expired after 5 minutes of no heartbeat.',
        inputSchema: {
            type: 'object',
            properties: {
                lease_id: {
                    type: 'string',
                    description: 'The lease_id returned from ledger_acquire_lease',
                },
            },
            required: ['lease_id'],
        },
    },
    {
        name: 'ledger_heartbeat',
        description: 'Send a heartbeat to keep your lease alive during long operations. ' +
            'Leases expire after 60 seconds without a heartbeat. Call this periodically for long-running edits.',
        inputSchema: {
            type: 'object',
            properties: {
                lease_id: {
                    type: 'string',
                    description: 'Active lease ID to keep alive',
                },
            },
            required: ['lease_id'],
        },
    },
    // ---- Event Logging ----
    {
        name: 'ledger_report_intent',
        description: 'Log your INTENT before performing an action. Call this AFTER acquiring a lease but BEFORE editing the file. ' +
            'This creates an audit trail and lets other agents see what you\'re planning. ' +
            'Returns an event_id that you must use when reporting the action result.',
        inputSchema: {
            type: 'object',
            properties: {
                resource: {
                    type: 'string',
                    description: 'File you\'re about to modify',
                },
                intent: {
                    type: 'string',
                    description: 'Plain-language description of what you plan to do (e.g. "Add input validation to login handler")',
                },
                parent_event_id: {
                    type: 'string',
                    description: 'Optional. If this action is a subtask of a previous event, link them together.',
                },
            },
            required: ['resource', 'intent'],
        },
    },
    {
        name: 'ledger_report_action',
        description: 'Log the RESULT of your action after completing it. Call this AFTER editing the file. ' +
            'Provide the ground truth: what you actually changed, any diffs, exit codes, etc. ' +
            'This completes the intent→action audit trail.',
        inputSchema: {
            type: 'object',
            properties: {
                event_id: {
                    type: 'string',
                    description: 'The event_id returned from ledger_report_intent',
                },
                ground_truth: {
                    type: 'object',
                    description: 'What actually happened. Include fields like: action (description), diff (code changes), exit_code (0 for success), lines_changed (count).',
                    properties: {
                        action: { type: 'string', description: 'What you did' },
                        diff: { type: 'string', description: 'Code diff or summary of changes' },
                        exit_code: { type: 'number', description: '0 for success' },
                        lines_changed: { type: 'number', description: 'Number of lines modified' },
                    },
                },
            },
            required: ['event_id', 'ground_truth'],
        },
    },
    // ---- Querying ----
    {
        name: 'ledger_read_history',
        description: 'Read recent ledger entries for yourself or another agent. Use this to understand what has been done recently, ' +
            'check what another agent is working on, or resume work from a previous session.',
        inputSchema: {
            type: 'object',
            properties: {
                agent_id: {
                    type: 'string',
                    description: 'Agent to query (defaults to yourself if omitted)',
                },
                count: {
                    type: 'number',
                    description: 'Number of recent entries to retrieve (default: 10)',
                },
            },
        },
    },
    {
        name: 'ledger_search',
        description: 'Search the ledger for events matching a text query. Use this to find what was done to a specific file, ' +
            'or search for actions related to a feature.',
        inputSchema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Search term (searches intent descriptions)',
                },
                limit: {
                    type: 'number',
                    description: 'Max results (default: 20)',
                },
            },
            required: ['query'],
        },
    },
    {
        name: 'ledger_status',
        description: 'Get a system-wide status overview: number of agents, active leases, pending events, milestones, etc. ' +
            'Use this to understand the current state of the multi-agent workspace.',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
    // ---- Milestones ----
    {
        name: 'ledger_declare_milestone',
        description: 'Declare a project milestone. Use this when a significant piece of work is complete ' +
            '(e.g. "Authentication system implemented", "v1.0 API endpoints all working").',
        inputSchema: {
            type: 'object',
            properties: {
                description: {
                    type: 'string',
                    description: 'Milestone description',
                },
            },
            required: ['description'],
        },
    },
    // ---- Sync ----
    {
        name: 'ledger_check_sync',
        description: 'Check if there are any pending sync notifications. If a human or external process edited a file you have leased, ' +
            'you will see pending sync items here. You MUST acknowledge them before continuing work on that file.',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'ledger_acknowledge_sync',
        description: 'Acknowledge an external edit notification. After reviewing the changes made by a human or external process, ' +
            'call this to lift the freeze and resume work.',
        inputSchema: {
            type: 'object',
            properties: {
                event_id: {
                    type: 'string',
                    description: 'The external edit event_id to acknowledge',
                },
            },
            required: ['event_id'],
        },
    },
];
//# sourceMappingURL=tools.js.map