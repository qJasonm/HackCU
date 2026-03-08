// ============================================================
// Status Command — Get system status
// ============================================================

import { Command } from 'commander';
import { client, setClientOptions, setToken } from '../client.js';
import { loadToken } from './register.js';

export const statusCmd = new Command('status')
  .description('Get system status')
  .requiredOption('-a, --agent-id <id>', 'Agent ID')
  .action(async (opts) => {
    const parent = statusCmd.parent!;
    const serverUrl = parent.opts().server;
    setClientOptions({ serverUrl });

    const token = loadToken(opts.agentId);
    if (!token) {
      console.error(`❌ No token found for ${opts.agentId}.`);
      process.exit(1);
    }
    setToken(token);

    try {
      const result = await client.get('/admin/status');

      console.log(`\n🔒 Agent Ledger Status\n`);
      console.log(`  Agents:           ${result.agents}`);
      console.log(`  Active Leases:    ${result.active_leases}`);
      console.log(`  Queued Requests:  ${result.queued_requests}`);
      console.log(`  Total Events:     ${result.total_events}`);
      console.log(`  Pending Events:   ${result.pending_events}`);
      console.log(`  Revoked Sessions: ${result.revoked_sessions}`);
      console.log(`  Milestones:       ${result.milestones}`);
      console.log(`  JWT Mode:         ${result.jwt_mode}`);
      console.log(`  Uptime:           ${Math.floor(result.server_uptime)}s\n`);
    } catch (err: any) {
      console.error(`❌ Status failed: ${err.message}`);
      process.exit(1);
    }
  });
