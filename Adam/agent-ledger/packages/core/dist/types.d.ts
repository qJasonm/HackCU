export declare enum TrustTier {
    Orchestrator = "orchestrator",
    Worker = "worker",
    Observer = "observer",
    Human = "human"
}
export declare enum LeaseScope {
    File = "file",
    Symbol = "symbol",
    Region = "region"
}
export declare enum LeaseStatus {
    Active = "active",
    Suspended = "suspended",
    Queued = "queued",
    Released = "released"
}
export declare enum EventType {
    FileEdit = "FILE_EDIT",
    TerminalCommand = "TERMINAL_COMMAND",
    RecoveryAction = "RECOVERY_ACTION",
    LeaseUpgrade = "LEASE_UPGRADE",
    Milestone = "MILESTONE",
    UnauthorizedExternalAction = "UNAUTHORIZED_EXTERNAL_ACTION",
    SyncRequired = "SYNC_REQUIRED",
    SessionRevoked = "SESSION_REVOKED"
}
export declare enum Priority {
    P0 = 0,// Orchestrator / starvation-promoted
    P1 = 1,// Escalation requests
    P2 = 2
}
export declare enum EventStatus {
    Pending = "pending",
    Complete = "complete",
    Orphaned = "orphaned",
    Abandoned = "abandoned"
}
export declare enum JWTMode {
    HS256 = "hs256",
    RS256 = "rs256"
}
export interface Agent {
    agent_id: string;
    tier: TrustTier;
    session_id: string;
    token_hash: string;
    registered_at: number;
    last_heartbeat: number | null;
}
export interface Lease {
    lease_id: string;
    agent_id: string;
    resource: string;
    scope: LeaseScope;
    line_start: number | null;
    line_end: number | null;
    status: LeaseStatus;
    priority: Priority;
    granted_at: number | null;
    expires_at: number | null;
    correlation_id: string | null;
}
export interface LeaseRequest {
    resource: string;
    scope: LeaseScope;
    line_start?: number;
    line_end?: number;
    symbol_name?: string;
}
export interface LeaseQueueEntry {
    request_id: string;
    agent_id: string;
    resource: string;
    scope: LeaseScope;
    line_start: number | null;
    line_end: number | null;
    priority: Priority;
    queued_at: number;
    promoted_at: number | null;
}
export interface LedgerEvent {
    event_id: string;
    parent_event_id: string | null;
    correlation_id: string;
    agent_id: string;
    agent_token_tier: TrustTier;
    type: EventType;
    resource: string | null;
    lease_scope: LeaseScope | null;
    intent: string | null;
    ground_truth: GroundTruth | null;
    tree_depth: number;
    status: EventStatus;
    created_at: number;
    completed_at: number | null;
}
export interface GroundTruth {
    action: string;
    exit_code?: number;
    diff?: string;
    output?: string;
}
export interface MilestoneEntry {
    milestone_id: string;
    description: string;
    trigger: string;
    summary: string | null;
    created_at: number;
    embedding: Buffer | null;
}
export interface RevokedSession {
    session_id: string;
    agent_id: string;
    revoked_at: number;
    reason: string | null;
}
export interface JWTPayload {
    agent_id: string;
    tier: TrustTier;
    session_id: string;
    issued_at: number;
    expires_at: number;
    max_concurrent_leases: number;
    scope: string[];
    signing_mode: JWTMode;
}
export interface LedgerConfig {
    jwt: {
        mode: JWTMode;
        secret_path?: string;
        private_key_path?: string;
        public_key_path?: string;
        expiry_hours: number;
    };
    server: {
        port: number;
        host: string;
    };
    lease: {
        heartbeat_interval_ms: number;
        heartbeat_timeout_ms: number;
        queue_timeout_ms: number;
        intent_ttl_ms: number;
    };
    event_tree: {
        max_tree_depth: number;
    };
    storage: {
        db_path: string;
        active_tail_size: number;
        audit_log_dir: string;
    };
    vector: {
        decay_lambda: number;
        milestone_boost: number;
    };
}
export interface JanitorConfig {
    active_mode: 'local' | 'cloud';
    local: {
        engine: string;
        model: string;
        endpoint: string;
    };
    cloud: {
        provider: string;
        model: string;
        api_key_env: string;
    };
    milestone_threshold: number;
    max_tree_depth_for_summary: number;
    run_schedule: {
        trigger_on_milestone_events: boolean;
        defer_during_active_session: boolean;
        idle_threshold_minutes: number;
        fallback_cron: string;
    };
}
export interface ExternalEditNotification {
    event_id: string;
    resource: string;
    changed_lines: {
        start: number;
        end: number;
    };
    detected_at: number;
    detected_by: string;
}
export interface SyncAcknowledgement {
    event_id: string;
    agent_id: string;
    acknowledged_at: number;
}
export interface SymbolRange {
    name: string;
    start_line: number;
    end_line: number;
    kind: 'function' | 'class' | 'method' | 'other';
}
export interface SymbolResolutionResult {
    resolved: boolean;
    range?: SymbolRange;
    backend: 'lsp' | 'tree-sitter' | 'none';
    escalated_to_file: boolean;
}
export interface RegisterRequest {
    agent_id: string;
    tier: TrustTier;
}
export interface RegisterResponse {
    token: string;
    session_id: string;
    agent_id: string;
    tier: TrustTier;
    expires_at: number;
}
export interface LeaseAcquireResponse {
    granted: boolean;
    lease?: Lease;
    queue_position?: number;
    request_id?: string;
    warning?: string;
}
export interface ReportIntentRequest {
    resource: string;
    intent: string;
    parent_event_id?: string;
    lease_scope?: LeaseScope;
    type?: EventType;
}
export interface ReportActionRequest {
    event_id: string;
    ground_truth: GroundTruth;
}
export interface LatestEntriesResponse {
    entries: LedgerEvent[];
    agent_id: string;
}
export declare const MAX_CONCURRENT_LEASES: Record<TrustTier, number>;
export declare const TIER_SCOPES: Record<TrustTier, string[]>;
