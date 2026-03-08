// ============================================================
// Exec Command — Acquire lease, report intent, execute, report result
// ============================================================
import { Command } from 'commander';
import { client, setClientOptions, setToken } from '../client.js';
import { loadToken } from './register.js';
export const execCmd = new Command('exec')
    .description('Execute an action on a file (acquire, intent, action, release)')
    .requiredOption('-a, --agent-id <id>', 'Agent ID')
    .requiredOption('-r, --resource <path>', 'Resource path (file)')
    .requiredOption('-i, --intent <text>', 'Intent description')
    .option('--scope <scope>', 'Lease scope (file, symbol, region)', 'file')
    .option('--result <json>', 'Ground truth result (JSON)')
    .action(async (opts) => {
    const parent = execCmd.parent;
    const serverUrl = parent.opts().server;
    setClientOptions({ serverUrl });
    const token = loadToken(opts.agentId);
    if (!token) {
        console.error(`❌ No token found for ${opts.agentId}. Run: ledger register -a ${opts.agentId} -t <tier>`);
        process.exit(1);
    }
    setToken(token);
    try {
        // 1. Acquire lease
        console.log(`\n🔑 Acquiring ${opts.scope} lease on ${opts.resource}...`);
        const lease = await client.post('/lease/acquire', {
            resource: opts.resource,
            scope: opts.scope,
        });
        if (!lease.granted) {
            console.log(`⏳ Queued at position ${lease.queue_position} (request: ${lease.request_id})`);
            return;
        }
        console.log(`   Lease granted: ${lease.lease.lease_id}`);
        // 2. Report intent
        console.log(`📋 Reporting intent: "${opts.intent}"`);
        const intent = await client.post('/ledger/report-intent', {
            resource: opts.resource,
            intent: opts.intent,
        });
        console.log(`   Event: ${intent.event_id} (${intent.correlation_id})`);
        // 3. Report action (if result provided)
        if (opts.result) {
            let groundTruth;
            try {
                groundTruth = JSON.parse(opts.result);
            }
            catch {
                groundTruth = { action: opts.result };
            }
            console.log(`✅ Reporting action result...`);
            const action = await client.post('/ledger/report-action', {
                event_id: intent.event_id,
                ground_truth: groundTruth,
            });
            console.log(`   Status: ${action.status}`);
        }
        // 4. Release lease
        console.log(`🔓 Releasing lease...`);
        await client.post('/lease/release', { lease_id: lease.lease.lease_id });
        console.log(`   Done!\n`);
    }
    catch (err) {
        console.error(`❌ Exec failed: ${err.message}`);
        process.exit(1);
    }
});
//# sourceMappingURL=exec.js.map