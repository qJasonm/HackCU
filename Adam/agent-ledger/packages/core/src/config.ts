// ============================================================
// @agent-ledger/core — Configuration Loader
// ============================================================

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { LedgerConfig, JanitorConfig } from './types.js';
import { JWTMode } from './types.js';

const DEFAULT_LEDGER_CONFIG: LedgerConfig = {
  jwt: {
    mode: JWTMode.HS256,
    secret_path: '.ledger/secret.key',
    private_key_path: '.ledger/private.pem',
    public_key_path: '.ledger/public.pem',
    expiry_hours: 8,
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  lease: {
    heartbeat_interval_ms: 30000,
    heartbeat_timeout_ms: 60000,
    queue_timeout_ms: 300000, // 5 minutes
    intent_ttl_ms: 600000,   // 10 minutes
  },
  event_tree: {
    max_tree_depth: 10,
  },
  storage: {
    db_path: '.ledger/ledger.db',
    active_tail_size: 10,
    audit_log_dir: '.ledger/logs',
  },
  vector: {
    decay_lambda: 0.05,
    milestone_boost: 1.5,
  },
};

const DEFAULT_JANITOR_CONFIG: JanitorConfig = {
  active_mode: 'cloud',
  local: {
    engine: 'ollama',
    model: 'llama3',
    endpoint: 'http://localhost:11434',
  },
  cloud: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    api_key_env: 'ANTHROPIC_API_KEY',
  },
  milestone_threshold: 500,
  max_tree_depth_for_summary: 10,
  run_schedule: {
    trigger_on_milestone_events: true,
    defer_during_active_session: true,
    idle_threshold_minutes: 15,
    fallback_cron: '0 0 * * 0',
  },
};

export function loadLedgerConfig(basePath?: string): LedgerConfig {
  const configPath = join(basePath || process.cwd(), 'ledger_config.json');

  if (!existsSync(configPath)) {
    return { ...DEFAULT_LEDGER_CONFIG };
  }

  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<LedgerConfig>;
    return deepMerge(DEFAULT_LEDGER_CONFIG as any, parsed as any) as unknown as LedgerConfig;
  } catch {
    console.warn(`Failed to parse ${configPath}, using defaults.`);
    return { ...DEFAULT_LEDGER_CONFIG };
  }
}

export function loadJanitorConfig(basePath?: string): JanitorConfig {
  const configPath = join(basePath || process.cwd(), 'janitor_config.json');

  if (!existsSync(configPath)) {
    return { ...DEFAULT_JANITOR_CONFIG };
  }

  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<JanitorConfig>;
    return deepMerge(DEFAULT_JANITOR_CONFIG as any, parsed as any) as unknown as JanitorConfig;
  } catch {
    console.warn(`Failed to parse ${configPath}, using defaults.`);
    return { ...DEFAULT_JANITOR_CONFIG };
  }
}

// ---- Deep Merge ----

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };

  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(
        target[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>
      );
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

export { DEFAULT_LEDGER_CONFIG, DEFAULT_JANITOR_CONFIG };
