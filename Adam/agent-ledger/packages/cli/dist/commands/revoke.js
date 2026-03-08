// ============================================================
// Revoke Command — Revoke sessions/agents (admin)
// ============================================================
import { Command } from 'commander';
import { client, setClientOptions, setToken } from '../client.js';
import { loadToken } from './register.js';
export const revokeCmd = new Command('revoke')
    .description('Revoke a session or agent (orchestrator only)')
    .requiredOption('-a, --agent-id <id>', 'Your agent ID (must be orchestrator)')
    .option('--session <id>', 'Session ID to revoke')
    .option('--target <id>', 'Target agent ID to revoke all sessions')
    .option('--reason <text>', 'Reason for revocation', 'CLI revocation')
    .action(async (opts) => {
    const parent = revokeCmd.parent;
    const serverUrl = parent.opts().server;
    setClientOptions({ serverUrl });
    const token = loadToken(opts.agentId);
    if (!token) {
        console.error(`❌ No token found for ${opts.agentId}.`);
        process.exit(1);
    }
    setToken(token);
    try {
        if (opts.session) {
            const result = await client.post('/admin/revoke-session', {
                session_id: opts.session,
                reason: opts.reason,
            });
            console.log(`\n🚫 Session ${result.session_id} revoked for agent ${result.agent_id}\n`);
        }
        else if (opts.target) {
            const result = await client.post('/admin/revoke-agent', {
                agent_id: opts.target,
                reason: opts.reason,
            });
            console.log(`\n🚫 All sessions revoked for agent ${result.agent_id}\n`);
        }
        else {
            console.error('❌ Must specify --session or --target');
            process.exit(1);
        }
    }
    catch (err) {
        console.error(`❌ Revoke failed: ${err.message}`);
        process.exit(1);
    }
});
//# sourceMappingURL=revoke.js.map