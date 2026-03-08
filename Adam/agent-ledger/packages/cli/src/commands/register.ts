// ============================================================
// Register Command — Register agent and receive JWT
// ============================================================

import { Command } from 'commander';
import { client, setClientOptions, setToken } from '../client.js';
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const registerCmd = new Command('register')
  .description('Register an agent with the ledger')
  .requiredOption('-a, --agent-id <id>', 'Agent ID')
  .requiredOption('-t, --tier <tier>', 'Trust tier (orchestrator, worker, observer, human)')
  .action(async (opts) => {
    const parent = registerCmd.parent!;
    const serverUrl = parent.opts().server;
    setClientOptions({ serverUrl });

    try {
      const result = await client.post('/auth/register', {
        agent_id: opts.agentId,
        tier: opts.tier,
      });

      console.log(`\n✅ Registered as ${result.agent_id} (${result.tier})`);
      console.log(`   Session: ${result.session_id}`);
      console.log(`   Expires: ${new Date(result.expires_at * 1000).toISOString()}`);

      // Save token to .ledger/tokens/<agent_id>.json
      const tokenDir = join(process.cwd(), '.ledger', 'tokens');
      if (!existsSync(tokenDir)) mkdirSync(tokenDir, { recursive: true });

      const tokenFile = join(tokenDir, `${opts.agentId}.json`);
      writeFileSync(tokenFile, JSON.stringify({
        token: result.token,
        agent_id: result.agent_id,
        session_id: result.session_id,
        tier: result.tier,
        expires_at: result.expires_at,
        server: serverUrl,
      }, null, 2));

      console.log(`   Token saved to: ${tokenFile}\n`);
    } catch (err: any) {
      console.error(`❌ Registration failed: ${err.message}`);
      process.exit(1);
    }
  });

export function loadToken(agentId: string): string | null {
  const tokenFile = join(process.cwd(), '.ledger', 'tokens', `${agentId}.json`);
  if (!existsSync(tokenFile)) return null;
  const data = JSON.parse(readFileSync(tokenFile, 'utf-8'));
  return data.token;
}
