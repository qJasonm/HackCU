// ============================================================
// Active Tail Service — Per-Agent In-Memory Ring Buffer
// ============================================================

import type { LedgerEvent } from '@agent-ledger/core';

export class ActiveTailService {
  private tails: Map<string, LedgerEvent[]> = new Map();
  private maxSize: number;

  constructor(maxSize: number = 10) {
    this.maxSize = maxSize;
  }

  push(agentId: string, event: LedgerEvent): void {
    if (!this.tails.has(agentId)) {
      this.tails.set(agentId, []);
    }

    const tail = this.tails.get(agentId)!;

    // Update existing event if same event_id (for completions)
    const existingIndex = tail.findIndex(e => e.event_id === event.event_id);
    if (existingIndex !== -1) {
      tail[existingIndex] = event;
      return;
    }

    // Add new event, maintain max size
    tail.push(event);
    if (tail.length > this.maxSize) {
      tail.shift(); // Remove oldest
    }
  }

  get(agentId: string): LedgerEvent[] {
    return this.tails.get(agentId) || [];
  }

  getAll(): LedgerEvent[] {
    // Round-robin merge for cross-agent queries
    const allTails = Array.from(this.tails.values());
    if (allTails.length === 0) return [];

    const merged: LedgerEvent[] = [];
    const maxLen = Math.max(...allTails.map(t => t.length));

    for (let i = 0; i < maxLen; i++) {
      for (const tail of allTails) {
        if (i < tail.length) {
          merged.push(tail[i]);
        }
      }
    }

    return merged.sort((a, b) => b.created_at - a.created_at);
  }

  clear(agentId: string): void {
    this.tails.delete(agentId);
  }
}
