// ============================================================
// Active Tail Service — Per-Agent In-Memory Ring Buffer
// ============================================================
export class ActiveTailService {
    tails = new Map();
    maxSize;
    constructor(maxSize = 10) {
        this.maxSize = maxSize;
    }
    push(agentId, event) {
        if (!this.tails.has(agentId)) {
            this.tails.set(agentId, []);
        }
        const tail = this.tails.get(agentId);
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
    get(agentId) {
        return this.tails.get(agentId) || [];
    }
    getAll() {
        // Round-robin merge for cross-agent queries
        const allTails = Array.from(this.tails.values());
        if (allTails.length === 0)
            return [];
        const merged = [];
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
    clear(agentId) {
        this.tails.delete(agentId);
    }
}
//# sourceMappingURL=active-tail.js.map