// ============================================================
// Milestone Command — Declare a milestone
// ============================================================

import { Command } from 'commander';
import { client, setClientOptions, setToken } from '../client.js';
import { loadToken } from './register.js';

export const milestoneCmd = new Command('milestone')
  .description('Declare a milestone')
  .requiredOption('-a, --agent-id <id>', 'Agent ID')
  .requiredOption('-d, --description <text>', 'Milestone description')
  .action(async (opts) => {
    const parent = milestoneCmd.parent!;
    const serverUrl = parent.opts().server;
    setClientOptions({ serverUrl });

    const token = loadToken(opts.agentId);
    if (!token) {
      console.error(`❌ No token found for ${opts.agentId}.`);
      process.exit(1);
    }
    setToken(token);

    try {
      const result = await client.post('/ledger/milestone', {
        description: opts.description,
      });

      console.log(`\n🏆 Milestone declared: ${result.milestone_id}`);
      console.log(`   Description: "${result.description}"`);
      console.log(`   Created: ${new Date(result.created_at * 1000).toISOString()}\n`);
    } catch (err: any) {
      console.error(`❌ Milestone failed: ${err.message}`);
      process.exit(1);
    }
  });
