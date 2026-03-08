"""
Pydantic models for the agentctl ledger.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field


class ActionRecord(BaseModel):
    """Input: what an agent submits to record an action."""

    agent_id: str = Field(..., description="Unique identifier for the agent.")
    action_type: str = Field(..., description="Category of the action.")
    payload: dict[str, Any] = Field(
        default_factory=dict,
        description="Arbitrary JSON payload describing the action.",
    )


class LedgerBlock(BaseModel):
    """A single immutable block stored in the ledger chain."""

    block_index: int
    timestamp: str
    agent_id: str
    action_type: str
    payload: dict[str, Any]
    previous_hash: str
    block_hash: str

    def to_canonical_json(self) -> str:
        """Deterministic JSON string used for hashing (excludes block_hash)."""
        data = {
            "block_index": self.block_index,
            "timestamp": self.timestamp,
            "agent_id": self.agent_id,
            "action_type": self.action_type,
            "payload": self.payload,
            "previous_hash": self.previous_hash,
        }
        return json.dumps(data, sort_keys=True, separators=(",", ":"))


class ChainVerifyResult(BaseModel):
    """Result of verifying the entire chain's integrity."""

    valid: bool
    block_count: int
    message: str
    tampered_block_index: int | None = None


def utc_now_iso() -> str:
    """Return current UTC time as a compact ISO 8601 string."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
