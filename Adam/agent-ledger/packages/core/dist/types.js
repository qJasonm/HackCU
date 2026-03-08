// ============================================================
// @agent-ledger/core — Shared Types & Interfaces
// ============================================================
// ---- Enums ----
export var TrustTier;
(function (TrustTier) {
    TrustTier["Orchestrator"] = "orchestrator";
    TrustTier["Worker"] = "worker";
    TrustTier["Observer"] = "observer";
    TrustTier["Human"] = "human";
})(TrustTier || (TrustTier = {}));
export var LeaseScope;
(function (LeaseScope) {
    LeaseScope["File"] = "file";
    LeaseScope["Symbol"] = "symbol";
    LeaseScope["Region"] = "region";
})(LeaseScope || (LeaseScope = {}));
export var LeaseStatus;
(function (LeaseStatus) {
    LeaseStatus["Active"] = "active";
    LeaseStatus["Suspended"] = "suspended";
    LeaseStatus["Queued"] = "queued";
    LeaseStatus["Released"] = "released";
})(LeaseStatus || (LeaseStatus = {}));
export var EventType;
(function (EventType) {
    EventType["FileEdit"] = "FILE_EDIT";
    EventType["TerminalCommand"] = "TERMINAL_COMMAND";
    EventType["RecoveryAction"] = "RECOVERY_ACTION";
    EventType["LeaseUpgrade"] = "LEASE_UPGRADE";
    EventType["Milestone"] = "MILESTONE";
    EventType["UnauthorizedExternalAction"] = "UNAUTHORIZED_EXTERNAL_ACTION";
    EventType["SyncRequired"] = "SYNC_REQUIRED";
    EventType["SessionRevoked"] = "SESSION_REVOKED";
})(EventType || (EventType = {}));
export var Priority;
(function (Priority) {
    Priority[Priority["P0"] = 0] = "P0";
    Priority[Priority["P1"] = 1] = "P1";
    Priority[Priority["P2"] = 2] = "P2";
})(Priority || (Priority = {}));
export var EventStatus;
(function (EventStatus) {
    EventStatus["Pending"] = "pending";
    EventStatus["Complete"] = "complete";
    EventStatus["Orphaned"] = "orphaned";
    EventStatus["Abandoned"] = "abandoned";
})(EventStatus || (EventStatus = {}));
export var JWTMode;
(function (JWTMode) {
    JWTMode["HS256"] = "hs256";
    JWTMode["RS256"] = "rs256";
})(JWTMode || (JWTMode = {}));
// ---- Lease max per tier ----
export const MAX_CONCURRENT_LEASES = {
    [TrustTier.Orchestrator]: Infinity,
    [TrustTier.Worker]: 3,
    [TrustTier.Observer]: 0,
    [TrustTier.Human]: 0,
};
// ---- Scope permissions per tier ----
export const TIER_SCOPES = {
    [TrustTier.Orchestrator]: ['read', 'write', 'lease', 'admin'],
    [TrustTier.Worker]: ['read', 'write', 'lease'],
    [TrustTier.Observer]: ['read', 'write'],
    [TrustTier.Human]: ['read'],
};
//# sourceMappingURL=types.js.map