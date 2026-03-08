import type Database from 'better-sqlite3';
import type { LedgerEvent, GroundTruth, ReportIntentRequest } from './types.js';
import { TrustTier } from './types.js';
export declare function detectCycle(parentEventId: string, agentId: string, database: Database.Database): {
    hasCycle: boolean;
    ancestorChain: string[];
};
export declare function getDepth(parentEventId: string | null, database: Database.Database): number;
export interface CreateEventResult {
    success: boolean;
    event?: LedgerEvent;
    error?: string;
    ancestor_chain?: string[];
}
export declare function createEvent(agentId: string, agentTier: TrustTier, request: ReportIntentRequest, maxTreeDepth: number, database: Database.Database): CreateEventResult;
export declare function completeEvent(eventId: string, groundTruth: GroundTruth, database: Database.Database): {
    success: boolean;
    event?: LedgerEvent;
    error?: string;
};
export declare function getEventTree(correlationId: string, database: Database.Database): LedgerEvent[];
export declare function getLatestEventsForAgent(agentId: string, count: number, database: Database.Database): LedgerEvent[];
export declare function markOrphanedEvents(agentId: string, database: Database.Database): number;
export declare function getEventsForSummarization(limit: number, database: Database.Database): LedgerEvent[];
