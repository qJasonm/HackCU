// ============================================================
// @agent-ledger/core — Hierarchical Event Tree Logic
// ============================================================

import { nanoid } from 'nanoid';
import type Database from 'better-sqlite3';
import type { LedgerEvent, GroundTruth, ReportIntentRequest } from './types.js';
import { EventType, EventStatus, TrustTier, LeaseScope } from './types.js';
import * as dbHelpers from './db.js';

// ---- Cycle Detection ----

export function detectCycle(
  parentEventId: string,
  agentId: string,
  database: Database.Database
): { hasCycle: boolean; ancestorChain: string[] } {
  const chain: string[] = [];
  let currentId: string | null = parentEventId;

  while (currentId) {
    chain.push(currentId);
    const event = dbHelpers.getEventById(database).get(currentId) as LedgerEvent | undefined;
    if (!event) break;

    // Cycle detected: this agent already appears in the ancestor chain
    if (event.agent_id === agentId && event.event_id !== parentEventId) {
      return { hasCycle: true, ancestorChain: chain };
    }

    currentId = event.parent_event_id;

    // Safety: prevent infinite loop on corrupted data
    if (chain.length > 100) break;
  }

  return { hasCycle: false, ancestorChain: chain };
}

// ---- Depth Check ----

export function getDepth(
  parentEventId: string | null,
  database: Database.Database
): number {
  if (!parentEventId) return 0;

  const parent = dbHelpers.getEventById(database).get(parentEventId) as LedgerEvent | undefined;
  if (!parent) return 0;

  return parent.tree_depth + 1;
}

// ---- Create Event (report intent) ----

export interface CreateEventResult {
  success: boolean;
  event?: LedgerEvent;
  error?: string;
  ancestor_chain?: string[];
}

export function createEvent(
  agentId: string,
  agentTier: TrustTier,
  request: ReportIntentRequest,
  maxTreeDepth: number,
  database: Database.Database
): CreateEventResult {
  // Check cycle
  if (request.parent_event_id) {
    const cycleCheck = detectCycle(request.parent_event_id, agentId, database);
    if (cycleCheck.hasCycle) {
      return {
        success: false,
        error: 'CYCLE_DETECTED',
        ancestor_chain: cycleCheck.ancestorChain,
      };
    }
  }

  // Check depth
  const depth = getDepth(request.parent_event_id ?? null, database);
  let parentEventId = request.parent_event_id ?? null;
  let treeOverflow = false;

  if (depth >= maxTreeDepth) {
    // Write as new root-level entry
    treeOverflow = true;
    parentEventId = null;
  }

  const now = Math.floor(Date.now() / 1000);
  const eventId = `evt-${nanoid(8)}`;
  const correlationId = `cid-${nanoid(8)}`;

  const event: LedgerEvent = {
    event_id: eventId,
    parent_event_id: parentEventId,
    correlation_id: correlationId,
    agent_id: agentId,
    agent_token_tier: agentTier,
    type: request.type || EventType.FileEdit,
    resource: request.resource,
    lease_scope: request.lease_scope || null,
    intent: request.intent,
    ground_truth: null,
    tree_depth: treeOverflow ? 0 : depth,
    status: EventStatus.Pending,
    created_at: now,
    completed_at: null,
  };

  dbHelpers.insertEvent(database).run({
    ...event,
    ground_truth: null,
  });

  return { success: true, event };
}

// ---- Complete Event (report action) ----

export function completeEvent(
  eventId: string,
  groundTruth: GroundTruth,
  database: Database.Database
): { success: boolean; event?: LedgerEvent; error?: string } {
  const event = dbHelpers.getEventById(database).get(eventId) as LedgerEvent | undefined;
  if (!event) {
    return { success: false, error: 'EVENT_NOT_FOUND' };
  }

  if (event.status === EventStatus.Complete) {
    return { success: false, error: 'EVENT_ALREADY_COMPLETE' };
  }

  const now = Math.floor(Date.now() / 1000);
  database.prepare(
    'UPDATE events SET ground_truth = ?, status = ?, completed_at = ? WHERE event_id = ?'
  ).run(JSON.stringify(groundTruth), EventStatus.Complete, now, eventId);

  const updated = dbHelpers.getEventById(database).get(eventId) as LedgerEvent;
  return { success: true, event: updated };
}

// ---- Get Event Tree ----

export function getEventTree(
  correlationId: string,
  database: Database.Database
): LedgerEvent[] {
  return dbHelpers.getEventsByCorrelationId(database).all(correlationId) as LedgerEvent[];
}

// ---- Get Latest Events for Agent ----

export function getLatestEventsForAgent(
  agentId: string,
  count: number,
  database: Database.Database
): LedgerEvent[] {
  return database.prepare(
    'SELECT * FROM events WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?'
  ).all(agentId, count) as LedgerEvent[];
}

// ---- Mark Orphaned Events ----

export function markOrphanedEvents(
  agentId: string,
  database: Database.Database
): number {
  const result = database.prepare(
    "UPDATE events SET status = 'orphaned' WHERE agent_id = ? AND status = 'pending' AND created_at < ?"
  ).run(agentId, Math.floor(Date.now() / 1000) - 600); // 10 minute TTL

  return result.changes;
}

// ---- Get All Events (for janitor) ----

export function getEventsForSummarization(
  limit: number,
  database: Database.Database
): LedgerEvent[] {
  return database.prepare(
    "SELECT * FROM events WHERE status = 'complete' ORDER BY created_at ASC LIMIT ?"
  ).all(limit) as LedgerEvent[];
}
