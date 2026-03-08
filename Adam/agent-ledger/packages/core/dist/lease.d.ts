import type Database from 'better-sqlite3';
import type { Lease, LeaseRequest, LeaseQueueEntry } from './types.js';
import { LeaseScope, TrustTier } from './types.js';
export declare function intervalsOverlap(aStart: number | null, aEnd: number | null, bStart: number | null, bEnd: number | null): boolean;
export declare function checkOverlap(existingLeases: Lease[], newRequest: {
    line_start: number | null;
    line_end: number | null;
    scope: LeaseScope;
}, agentId: string): Lease[];
export interface AcquireResult {
    granted: boolean;
    lease?: Lease;
    queue_position?: number;
    request_id?: string;
    conflicts?: Lease[];
}
export declare function acquireLease(agentId: string, tier: TrustTier, request: LeaseRequest, database: Database.Database): AcquireResult;
export interface ReleaseResult {
    released: boolean;
    next_in_queue?: LeaseQueueEntry;
}
export declare function releaseLease(leaseId: string, database: Database.Database): ReleaseResult;
export interface EscalateResult {
    escalated: boolean;
    lease?: Lease;
    queued?: boolean;
    request_id?: string;
    queue_position?: number;
}
export declare function escalateLease(leaseId: string, newScope: LeaseScope, newLineStart: number | null, newLineEnd: number | null, database: Database.Database): EscalateResult;
export declare function processHeartbeat(leaseId: string, database: Database.Database): boolean;
export interface ExpiredLease {
    lease: Lease;
    next_in_queue?: LeaseQueueEntry;
}
export declare function expireStaleLeases(database: Database.Database): ExpiredLease[];
export declare function promoteStarvedRequests(timeoutMs: number, database: Database.Database): LeaseQueueEntry[];
export declare function grantNextInQueue(resource: string, database: Database.Database): Lease | null;
