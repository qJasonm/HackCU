// ============================================================
// Read Command — Query the ledger
// ============================================================

import { Command } from 'commander';
import { client, setClientOptions, setToken } from '../client.js';
import { loadToken } from './register.js';

export const readCmd = new Command('read')
  .description('Read ledger entries')
  .requiredOption('-a, --agent-id <id>', 'Agent ID')
  .option('-n, --count <n>', 'Number of entries', '10')
  .option('-q, --query <text>', 'Search query')
  .option('--target <agent>', 'Target agent ID (defaults to self)')
  .action(async (opts) => {
    const parent = readCmd.parent!;
    const serverUrl = parent.opts().server;
    setClientOptions({ serverUrl });

    const token = loadToken(opts.agentId);
    if (!token) {
      console.error(`❌ No token found for ${opts.agentId}.`);
      process.exit(1);
    }
    setToken(token);

    try {
      if (opts.query) {
        const result = await client.get(`/ledger/query?q=${encodeURIComponent(opts.query)}&limit=${opts.count}`);
        console.log(`\n📖 Search results for "${opts.query}" (${result.count}):\n`);
        for (const e of result.results) {
          const time = new Date(e.created_at * 1000).toISOString().slice(11, 19);
          console.log(`  [${time}] ${e.agent_id} | ${e.type} | ${e.status}`);
          if (e.intent) console.log(`           Intent: "${e.intent}"`);
          if (e.resource) console.log(`           Resource: ${e.resource}`);
        }
      } else {
        const targetAgent = opts.target || opts.agentId;
        const result = await client.get(`/ledger/latest?agent_id=${targetAgent}&count=${opts.count}`);
        console.log(`\n📖 Latest entries for ${result.agent_id} (${result.entries.length}):\n`);
        for (const e of result.entries) {
          const time = new Date(e.created_at * 1000).toISOString().slice(11, 19);
          console.log(`  [${time}] ${e.type} | ${e.status} | ${e.resource || 'N/A'}`);
          if (e.intent) console.log(`           "${e.intent}"`);
        }
      }
      console.log();
    } catch (err: any) {
      console.error(`❌ Read failed: ${err.message}`);
      process.exit(1);
    }
  });
