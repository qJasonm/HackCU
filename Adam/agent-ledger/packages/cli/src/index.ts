#!/usr/bin/env node
// ============================================================
// @agent-ledger/cli — Ledger CLI Entry Point
// ============================================================

import { Command } from 'commander';
import { registerCmd } from './commands/register.js';
import { execCmd } from './commands/exec.js';
import { readCmd } from './commands/read.js';
import { milestoneCmd } from './commands/milestone.js';
import { statusCmd } from './commands/status.js';
import { revokeCmd } from './commands/revoke.js';

const program = new Command();

program
  .name('ledger')
  .description('🔒 Agent Ledger CLI — Multi-agent coordination tool')
  .version('1.0.0')
  .option('-s, --server <url>', 'Server URL', 'http://localhost:3000');

program.addCommand(registerCmd);
program.addCommand(execCmd);
program.addCommand(readCmd);
program.addCommand(milestoneCmd);
program.addCommand(statusCmd);
program.addCommand(revokeCmd);

program.parse();
