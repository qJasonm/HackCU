# Project: The Agent Ledger
### A Standalone Framework for Persistent Multi-Agent Coordination & Long-Term Memory
**Version 6.0 — Production-Ready Engineering Edition**

---

## 1. The Core Vision

The Agent Ledger transforms a codebase into a living, searchable history where every *Why* (Intent) and *What* (Action) is captured, enforced, and attributed. Every agent — wrapped or unwrapped, cloud or local — operates within a shared coordination layer that prevents conflicts, surfaces history semantically, and degrades gracefully when assumptions break.

Version 6.0 addresses the final low-level engineering assumptions required before Phase 1 implementation: symbol detection via LSP/AST, granular token revocation without swarm restart, hardware overhead tiering, and a JWT signing strategy that scales from local to remote CI environments.

---

## 2. The "Check-Lease-Act-Report" Protocol

Enforcement lives at the **Tool Wrapper Layer**, not in system prompts. Tools gate execution on valid lease acquisition — agents cannot bypass the protocol through instruction drift.

1. **Check** — Query the Ledger API for recent context and active leases on target resources.
2. **Lease** — Request a scoped lock (File, Symbol, or Region). Denied requests enter a priority queue.
3. **Act** — Execute the tool (`bash`, `write_file`).
4. **Report** — Tool wrapper auto-sends ground truth (diffs, terminal output) tagged with `Correlation_ID`. Entry transitions to `complete`.

---

## 3. Symbol-Level Detection: LSP + AST Strategy

### 3.1 The Problem

Symbol-level leases (e.g., `src/auth.py::generate_token`) require the Lease Manager to know the exact line ranges of named symbols in real time — including after edits that shift line numbers. This cannot be hardcoded or guessed.

### 3.2 Two-Layer Detection Architecture

The system uses a **tiered approach** depending on what's available in the environment:

**Tier 1 — LSP Integration (Preferred, VS Code environments)**

The VS Code Extension queries the active Language Server via the LSP `textDocument/documentSymbol` request whenever a lease is requested or a file changes. The response returns a full symbol tree with precise `range` (start line, end line) for every function, class, and method.

```
Agent requests: lease(src/auth.py::generate_token, scope=symbol)
  → Extension queries LSP: documentSymbol(src/auth.py)
  → LSP returns: generate_token → { start: L44, end: L61 }
  → Lease Manager stores: lease covers L44–L61
  → On next file change, LSP is re-queried to detect if symbol boundaries shifted
```

The LSP is re-queried on every `onDidChangeTextDocument` event to keep symbol ranges current. If a prior edit shifts `generate_token` from L44–L61 to L48–L65, the Lease Manager updates the range in-place without releasing the lease.

**Tier 2 — AST Parsing via `tree-sitter` (Headless / CI environments)**

When no Language Server is available (CLI, CI pipelines, non-VS Code editors), the MCP Server falls back to `tree-sitter` for static AST parsing. On lease request:

1. The server reads the target file from disk.
2. `tree-sitter` parses it and extracts the byte/line range for the requested symbol name.
3. The range is cached with a file content hash. If the hash changes (file edited), the cache is invalidated and re-parsed on next access.

**Tier comparison:**

| Capability | LSP (Tier 1) | tree-sitter (Tier 2) |
|---|---|---|
| Real-time range updates | Yes — reacts to unsaved edits | No — reads disk only |
| Headless support | No | Yes |
| Language coverage | Depends on installed server | Wide (80+ grammars) |
| Accuracy on unsaved edits | High | Low (stale until save) |

**Fallback Rule:** If neither LSP nor `tree-sitter` can resolve a symbol name (e.g., dynamically generated function, unsupported language), the lease **automatically escalates to `file` scope** with a warning logged to the agent: `SYMBOL_UNRESOLVABLE — lease upgraded to file scope`.

### 3.3 Overlap Detection

With line ranges in hand, the Lease Manager checks spatial overlap using a simple interval intersection:

```
Lease A covers [L44, L61]
New request covers [L55, L70]
Overlap: L55–L61 → DENY or QUEUE
```

Two `symbol` leases on non-overlapping ranges in the same file are always compatible.

---

## 4. Authentication & Token Architecture

### 4.1 Dual JWT Signing Modes

Rather than committing to a single algorithm, the system supports two modes selected in `ledger_config.json` based on deployment context:

**Mode 1 — HS256 (Symmetric) — Local / Trusted Network**

- Single secret key stored in `.ledger/secret.key` (gitignored).
- All agents and the MCP Server share the same key — appropriate when all agents run on the same machine or trusted LAN.
- Lower overhead, simpler setup.
- Use for: local development, single-machine swarms.

**Mode 2 — RS256 (Asymmetric) — Remote / CI Environments**

- MCP Server holds the **private key** (signs tokens).
- Agents in remote CI pipelines or cloud environments receive only the **public key** (verifies tokens).
- The private key never leaves the server. A compromised CI runner cannot forge tokens — it can only verify ones it's already been issued.
- Use for: any setup where agents run outside the local machine (GitHub Actions, cloud VMs, remote containers).

```json
// ledger_config.json
{
  "jwt": {
    "mode": "rs256",
    "private_key_path": ".ledger/private.pem",
    "public_key_path": ".ledger/public.pem",
    "expiry_hours": 8
  }
}
```

The public key is distributed to remote agents at registration time via a `GET /auth/public-key` endpoint on the MCP Server (unauthenticated, read-only). Agents cache it locally and use it to verify token integrity on every API call without contacting the server.

**Migration path:** A project can start with HS256 locally and switch to RS256 when adding remote CI agents by running `ledger upgrade-auth`, which generates an RSA keypair, re-issues all active tokens, and updates `ledger_config.json`. Existing HS256 tokens are invalidated.

### 4.2 Granular Token Revocation (No Swarm Restart)

**The problem with `rotate-key`:** Rotating the signing key invalidates every active session simultaneously — appropriate for a full security breach, but excessive for revoking a single misbehaving or compromised agent.

**Solution: Session Blacklist in SQLite**

A `revoked_sessions` table in the Ledger's SQLite DB stores individual revocations:

```sql
CREATE TABLE revoked_sessions (
  session_id   TEXT PRIMARY KEY,
  agent_id     TEXT NOT NULL,
  revoked_at   INTEGER NOT NULL,
  reason       TEXT
);
```

On every authenticated API call, the MCP Server checks the `revoked_sessions` table for the incoming `session_id` *before* processing the request. If found, the call is rejected with `401 SESSION_REVOKED`.

**Revocation commands:**

```bash
# Revoke a single session (agent re-authenticates, gets new token)
ledger revoke-session sess-a3f9 --reason "Suspected loop behavior"

# Revoke all sessions for a specific agent identity
ledger revoke-agent claude-code-worker-02 --reason "Breach investigation"

# Nuclear option — rotate key, invalidate everything
ledger rotate-key
```

Revoked sessions are never deleted from the table — they serve as a permanent audit record of security events. The table is indexed on `session_id` for O(1) lookup overhead on every request.

**Blacklist overhead:** A single indexed SQLite lookup adds ~0.1ms per API call on local disk — negligible relative to network and LLM latency.

### 4.3 JWT Payload Schema

```json
{
  "agent_id": "claude-code-worker-01",
  "tier": "worker",
  "session_id": "sess-a3f9",
  "issued_at": 1741392000,
  "expires_at": 1741420800,
  "max_concurrent_leases": 3,
  "scope": ["read", "write", "lease"],
  "signing_mode": "rs256"
}
```

### 4.4 Trust Tiers

| Tier | Who | Permissions | Max Leases |
|---|---|---|---|
| Orchestrator | Primary coordinating agent | Full read/write, lease override, queue preemption | Unlimited |
| Worker | Autonomous sub-agents | Read, write own entries, request/escalate leases | 3 |
| Observer | VS Code Extension, CI monitors | Write passive entries only, no leases | 0 |
| Human | Developer via Ledger CLI | Read-only audit access | 0 |

---

## 5. Hardware Requirements & Deployment Tiers

### 5.1 The Problem

Running a local BYOLLM Janitor (e.g., Llama 3 via Ollama), multiple active agents, SQLite-VSS vector search, and an MCP Server simultaneously can exceed a standard laptop's capacity. This needs to be explicitly tiered so developers can make informed deployment decisions.

### 5.2 Three Deployment Profiles

**Profile A — Minimal (Laptop / Low-Resource)**

Intended for solo developers on a standard MacBook or mid-range Windows machine.

| Component | Configuration |
|---|---|
| MCP Server | Runs locally, lightweight (~50MB RAM) |
| SQLite-VSS | Enabled, single DB file |
| Janitor LLM | **Cloud mode only** (Anthropic / OpenAI API) — no local inference |
| Active Tail | Per-agent, 10 entries |
| VS Code Extension | Enabled |
| Concurrent agents | 1–2 recommended |

Minimum specs: 8GB RAM, any modern dual-core CPU. The Janitor fires infrequently (500-entry threshold or weekly) so cloud API calls are rare and cheap.

**Profile B — Standard (Developer Workstation)**

Intended for power users running a small local swarm.

| Component | Configuration |
|---|---|
| MCP Server | Runs locally |
| SQLite-VSS | Enabled |
| Janitor LLM | **Local mode** — Ollama with a 7B model (e.g., `llama3`, `mistral`) |
| Active Tail | Per-agent, 10 entries |
| VS Code Extension | Enabled |
| Concurrent agents | 2–4 recommended |

Minimum specs: 16GB RAM, 8-core CPU, **dedicated GPU with 8GB VRAM recommended** for local inference at reasonable speed. Without GPU, Llama 3 8B runs at ~3–5 tokens/sec on CPU — functional but slow for Janitor summarization jobs.

**Profile C — Full (Dedicated Server / CI)**

Intended for team environments or automated pipelines where the Ledger runs as a persistent service.

| Component | Configuration |
|---|---|
| MCP Server | Runs as a system service or container |
| SQLite-VSS | Enabled (or swap to Postgres + pgvector for team scale) |
| Janitor LLM | Local mode — larger model (e.g., `llama3:70b`) or cloud |
| Active Tail | Per-agent, configurable |
| VS Code Extension | Optional (agents connect via CLI) |
| Concurrent agents | 5+ |

Minimum specs: 32GB RAM, 16-core CPU, GPU with 24GB+ VRAM for 70B local inference. Cloud Janitor mode eliminates GPU requirement entirely.

### 5.3 Janitor Scheduling to Reduce Peak Load

On Profile A and B, the Janitor should not run during active development sessions. `janitor_config.json` supports a `run_schedule` field:

```json
{
  "run_schedule": {
    "trigger_on_milestone_events": true,
    "defer_during_active_session": true,
    "idle_threshold_minutes": 15,
    "fallback_cron": "0 0 * * 0"
  }
}
```

`defer_during_active_session: true` means the Janitor will not start a summarization job if any agent has sent a heartbeat in the last `idle_threshold_minutes`. This prevents a Janitor LLM from competing for RAM/GPU with an active coding agent.

---

## 6. Lease Management

### 6.1 Granularity Levels

| Level | Example | Use When |
|---|---|---|
| `file` | `src/auth/login.py` | Whole-file rewrites, structural refactors |
| `symbol` | `src/auth/login.py::generate_token` | Function or class-level edits (resolved via LSP/tree-sitter) |
| `region` | `src/auth/login.py:L45-L78` | Explicit line-range edits |

### 6.2 Lease Escalation

1. Agent calls `escalate_lease(current_lease_id, new_scope)`.
2. Lease Manager checks for conflicting leases from *other* agents on the broader scope.
3. If clear: lease expanded in-place, `lease_id` unchanged, no re-queuing.
4. If blocked: request queued at **P1 priority**, agent retains original narrower lease until granted or cancelled.

Escalation never releases the original lock.

### 6.3 Queue Fairness & Priority Discipline

| Priority | Who | Rule |
|---|---|---|
| P0 | Orchestrator tier (any scope) | Always ahead of Workers |
| P1 | Escalation requests (any tier) | Ahead of new lease requests, FIFO among themselves |
| P2 | Worker new lease requests | FIFO within tier |

**Starvation Prevention:** Any request waiting longer than `queue_timeout` (default: 5 minutes) is automatically promoted to P0 regardless of tier.

Agents receive `wait_and_notify` callbacks — no polling required.

### 6.4 Heartbeat & Expiry

30-second heartbeat required on all active leases. On miss: lease released, queued agents notified, `Correlation_ID` marked `orphaned`.

---

## 7. Unauthorized Action Detection & Resolution

### 7.1 Detection

The VS Code Extension queries the Ledger on every `onDidChangeTextDocument` event. If no active leased `Correlation_ID` covers the changed resource, it logs an `UNAUTHORIZED_EXTERNAL_ACTION`.

### 7.2 Resolution Protocol

1. **Resource Freeze** — Pending lease requests for the affected resource are paused.
2. **Broadcast** — Affected agents receive `SYNC_REQUIRED` with diff snapshot within 5 seconds.
3. **Acknowledge** — Agents call `acknowledge_sync(event_id)` before next tool call on that file. Non-acknowledgment within 2 minutes suspends their leases on the file.
4. **Freeze Lift** — All acknowledgments received → queued leases resume.
5. **Permanent Flag** — Entry flagged `[EXTERNAL]` in audit log. Never compressed by Janitor.

### 7.3 Lease-vs-Unauthorized-Edit Conflict

- **Non-overlapping edit:** Agent's lease stays active. `SYNC_REQUIRED` sent. `acknowledge_sync` required before next tool call.
- **Overlapping edit:** Agent's lease **suspended** (not released) pending human review. `LEASE_SUSPENDED` notification sent with conflicting diff. Lock preserved to prevent further overwrites until human resolves.

---

## 8. Hierarchical Event Trees

### 8.1 Schema

```json
{
  "event_id": "e44-99b",
  "parent_event_id": "e44-99a",
  "correlation_id": "task-882",
  "agent_id": "claude-code-worker-01",
  "agent_token_tier": "worker",
  "type": "RECOVERY_ACTION",
  "resource": "src/main.py::init_db",
  "lease_scope": "symbol",
  "intent": "Reverting migration due to schema failure on staging.",
  "ground_truth": { "action": "git_revert", "exit_code": 0 },
  "tree_depth": 2
}
```

### 8.2 Cycle Detection

On every `report_intent` call with a `parent_event_id`, the MCP Server walks the ancestor chain. If the submitting agent's own `event_id` appears at any depth, the write is rejected with `CYCLE_DETECTED` and the full ancestor chain is returned. The agent may then submit as a new root-level entry.

### 8.3 Depth Limiting

`max_tree_depth: 10` (configurable). Entries exceeding this are written as new root-level entries with `tree_overflow: true` and a `deepest_ancestor_ref` field.

### 8.4 Janitor Traversal

Bottom-up (leaves → root), including `[ABANDONED]` orphan nodes. Produces a single Milestone entry describing the full arc of attempts and outcomes.

---

## 9. Orphaned Intent Handling

An entry becomes `orphaned` when its heartbeat expires without `report_action`, or its `Correlation_ID` stays `pending` beyond `intent_ttl` (default: 10 minutes).

Orphaned entries are never deleted. They are tagged, surfaced as warnings in `get_latest_actions`, included in Event Tree traversal as `[ABANDONED]` nodes, and compressed into Milestone notes by the Janitor.

---

## 10. Storage Architecture: Four-Layer Memory Engine

| Layer | Type | Purpose | Resolution |
|---|---|---|---|
| Active Tail | Per-agent in-memory buffer, round-robin merged | Immediate context | Raw |
| Vector DB | SQLite-VSS with temporal weighting | Semantic retrieval | Semantic |
| Audit Log | Append-only `.agent_log_YYYY-MM.md` | Human review, Git tracking | Structured Text |
| Milestone Map | Summarized entries in Vector DB, event-triggered | Long-range compressed history | Compressed |

### 10.1 Temporal Weighting — Exponential Decay

```
adjusted_score = base_similarity_score * e^(-λ * age_in_days)
```

`λ = 0.05` by default. Milestone entries exempt — permanently boosted at `1.5×`.

| Age | Multiplier |
|---|---|
| 0 days | 1.00× |
| 7 days | 0.70× |
| 30 days | 0.22× |
| 90 days | 0.011× |

### 10.2 Milestone Triggers

- Git commit or PR merge
- Full test suite passes
- `declare_milestone("description")` called
- 500 raw entries since last milestone
- Weekly background run (Sunday midnight)

---

## 11. The BYOLLM Janitor

```json
{
  "active_mode": "local",
  "local": {
    "engine": "ollama",
    "model": "llama3",
    "endpoint": "http://localhost:11434"
  },
  "cloud": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "api_key_env": "ANTHROPIC_API_KEY"
  },
  "milestone_threshold": 500,
  "max_tree_depth_for_summary": 10,
  "run_schedule": {
    "trigger_on_milestone_events": true,
    "defer_during_active_session": true,
    "idle_threshold_minutes": 15,
    "fallback_cron": "0 0 * * 0"
  }
}
```

The Janitor defers execution when any agent has heartbeated within `idle_threshold_minutes` — preventing LLM inference from competing with active agents for RAM and GPU. On Profile A (laptop), cloud mode is recommended to eliminate local inference overhead entirely.

---

## 12. Headless & CI Environments

```bash
ledger-agent exec --intent "Run auth tests post-refactor" "pytest tests/test_auth.py"
ledger-agent read --last 10
ledger-agent milestone "Auth module refactor complete"
```

Authentication via `~/.ledger/token` or `LEDGER_TOKEN` env var. In RS256 mode, remote agents receive the public key at registration and verify tokens locally — no server roundtrip per call.

---

## 13. Sample Ledger Entries

**Normal completed action:**
```markdown
## [2026-03-07 18:15:00] | Agent: claude-code-worker-01 | CID: a3f9b2 | Status: complete
**Type:** FILE_EDIT | **Tree Depth:** 1 (root) | **Symbol Backend:** LSP
**Resource:** `src/auth/login.py::generate_token` [L44–L61] | **Scope:** symbol
**Lease:** granted 18:14:58 → released 18:15:03
**Intent:** "Updating JWT expiration to 24h per security ticket #402."
**Diff:** `-timedelta(hours=1)` → `+timedelta(hours=24)`
```

**Symbol unresolvable — auto-escalated to file scope:**
```markdown
## [2026-03-07 18:30:00] | Agent: autogen-worker-01 | CID: c9d2e1 | Status: leased
**Type:** LEASE_UPGRADE | **Reason:** SYMBOL_UNRESOLVABLE
**Resource:** `src/generated/handlers.py` | **Scope:** file (upgraded from symbol)
**Warning:** "Symbol 'handle_request' could not be resolved by LSP or tree-sitter.
             Lease upgraded to file scope automatically."
```

**Session revocation audit entry:**
```markdown
## [2026-03-07 19:05:00] | System | Event: SESSION_REVOKED
**Session:** sess-b7c2 | **Agent:** claude-code-worker-02
**Reason:** "Suspected loop behavior — 47 lease requests in 90 seconds."
**Swarm Impact:** None — other sessions unaffected.
```

---

## 14. Implementation Roadmap

### Phase 1: Foundation — The Observer (Weeks 1–3)
- Build VS Code Extension: LSP symbol queries, file watcher, terminal monitor, passive SQLite logging.
- Export monthly `agent_log_YYYY-MM.md`.
- Ship as a standalone useful tool independent of later phases.

### Phase 2: The Gateway (Weeks 4–7)
- MCP Server with dual JWT modes (HS256 local / RS256 remote), session blacklist table.
- Correlation ID authority and `get_latest_actions`.
- Basic file-level leasing and 30-second heartbeat expiry.
- Ledger CLI with `revoke-session`, `revoke-agent`, and `rotate-key` commands.

### Phase 3: The Gatekeeper (Weeks 8–11)
- `tree-sitter` integration for headless symbol resolution.
- Symbol/region-level locking with LSP-backed interval overlap detection.
- Lease escalation with in-place expansion and P1 priority queuing.
- Starvation prevention (5-minute timeout → P0 promotion).
- Unauthorized action detection, freeze, broadcast, and `acknowledge_sync` protocol.

### Phase 4: The Librarian (Weeks 12–16)
- SQLite-VSS with exponential decay temporal weighting (λ=0.05).
- Event Tree schema with cycle detection and depth limiting.
- BYOLLM Janitor with idle-aware scheduling and local/cloud modes.
- Milestone Map as distinct Vector DB tier with permanent `1.5×` boost.

---

## 15. Complete Design Decision Summary

| Problem | Solution |
|---|---|
| Symbol range resolution in real time | LSP `documentSymbol` in VS Code; `tree-sitter` AST in headless environments |
| Symbol unresolvable (dynamic/unsupported) | Auto-escalate to `file` scope with agent warning |
| Spatial overlap detection | LSP/tree-sitter provides line ranges; Lease Manager uses interval intersection |
| Signing key breach invalidates whole swarm | Session blacklist table in SQLite — revoke one `session_id` or `agent_id` without restart |
| Local inference competes with active agents | Janitor defers when heartbeat detected within `idle_threshold_minutes` |
| Laptop can't run local LLM | Profile A uses cloud Janitor mode; local inference only on Profile B/C |
| Remote CI agents shouldn't hold private key | RS256 asymmetric mode — private key stays on server, public key distributed to agents |
| HS256 too weak for multi-environment deployments | `ledger upgrade-auth` migrates to RS256, re-issues all tokens, invalidates HS256 sessions |
| Agent identity spoofing | MCP Server is sole token issuer; blacklist checked on every request |
| Agents overwrite each other | Symbol/region leases with spatial overlap detection |
| Copilot makes silent edits | Observer detection + freeze/broadcast/acknowledge_sync protocol |
| Unauthorized edit conflicts active lease | Suspend (not release) overlapping leases pending human review |
| Crash leaves resource locked forever | 30s heartbeat expiry, auto-release, orphan tagging |
| Escalation loses queue position | In-place lease expansion; if blocked, queued at P1 |
| Queue starvation | 5-minute timeout promotes any request to P0 |
| Revert-of-revert infinite cycle | Ancestor walk at write time; `CYCLE_DETECTED` rejection |
| Deep event trees cause traversal blowout | `max_tree_depth: 10`; overflow written as new root with ancestor ref |
| Old logs bury recent context | Exponential decay λ=0.05; Milestones exempt with 1.5× boost |
| Vendor lock-in for summarization | BYOLLM Janitor — Ollama, Claude, GPT-4, or any OpenAI-compatible API |
| CI/terminal agents invisible to VS Code | Ledger CLI with identical MCP protocol, RS256 token via env var |
