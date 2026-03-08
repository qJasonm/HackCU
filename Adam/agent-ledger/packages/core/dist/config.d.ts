import type { LedgerConfig, JanitorConfig } from './types.js';
declare const DEFAULT_LEDGER_CONFIG: LedgerConfig;
declare const DEFAULT_JANITOR_CONFIG: JanitorConfig;
export declare function loadLedgerConfig(basePath?: string): LedgerConfig;
export declare function loadJanitorConfig(basePath?: string): JanitorConfig;
export { DEFAULT_LEDGER_CONFIG, DEFAULT_JANITOR_CONFIG };
