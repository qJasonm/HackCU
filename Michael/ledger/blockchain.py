"""
Blockchain engine — SHA-256 hashing, block creation, chain verification.
"""

from __future__ import annotations

import hashlib

from ledger.models import ActionRecord, ChainVerifyResult, LedgerBlock, utc_now_iso

GENESIS_PREVIOUS_HASH = "0" * 64


class BlockchainEngine:
    """
    Stateless utility class for creating and verifying ledger blocks.

    Each block's hash is computed over:
        block_index + timestamp + agent_id + action_type + payload + previous_hash

    Any post-hoc modification to any of these fields is detectable via verify_chain().
    """

    @staticmethod
    def compute_hash(block: LedgerBlock) -> str:
        """Compute the SHA-256 hash of a block's canonical JSON representation."""
        canonical = block.to_canonical_json()
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    @classmethod
    def create_genesis_block(cls) -> LedgerBlock:
        """Create the genesis (index 0) block of a new chain."""
        block = LedgerBlock(
            block_index=0,
            timestamp=utc_now_iso(),
            agent_id="ledger-system",
            action_type="genesis",
            payload={"message": "Agent ledger initialised."},
            previous_hash=GENESIS_PREVIOUS_HASH,
            block_hash="",
        )
        block.block_hash = cls.compute_hash(block)
        return block

    @classmethod
    def create_block(
        cls,
        previous_block: LedgerBlock,
        action_record: ActionRecord,
    ) -> LedgerBlock:
        """Create a new block chained to previous_block."""
        block = LedgerBlock(
            block_index=previous_block.block_index + 1,
            timestamp=utc_now_iso(),
            agent_id=action_record.agent_id,
            action_type=action_record.action_type,
            payload=action_record.payload,
            previous_hash=previous_block.block_hash,
            block_hash="",
        )
        block.block_hash = cls.compute_hash(block)
        return block

    @classmethod
    def verify_chain(cls, blocks: list[LedgerBlock]) -> ChainVerifyResult:
        """
        Validate the integrity of the full chain.

        Checks:
          1. Genesis block has the correct previous_hash sentinel.
          2. Each block's previous_hash equals the prior block's block_hash.
          3. Each block's block_hash matches a freshly recomputed hash.
        """
        if not blocks:
            return ChainVerifyResult(
                valid=True,
                block_count=0,
                message="Ledger is empty — nothing to verify.",
            )

        for i, block in enumerate(blocks):
            recomputed = cls.compute_hash(block)
            if recomputed != block.block_hash:
                return ChainVerifyResult(
                    valid=False,
                    block_count=len(blocks),
                    tampered_block_index=block.block_index,
                    message=(
                        f"Block #{block.block_index} has been tampered with. "
                        f"Expected {recomputed[:12]}… but stored {block.block_hash[:12]}…"
                    ),
                )
            if i > 0:
                expected_prev = blocks[i - 1].block_hash
                if block.previous_hash != expected_prev:
                    return ChainVerifyResult(
                        valid=False,
                        block_count=len(blocks),
                        tampered_block_index=block.block_index,
                        message=(
                            f"Block #{block.block_index} is not correctly linked "
                            f"to block #{blocks[i - 1].block_index}. Chain is broken."
                        ),
                    )
            else:
                if block.previous_hash != GENESIS_PREVIOUS_HASH:
                    return ChainVerifyResult(
                        valid=False,
                        block_count=len(blocks),
                        tampered_block_index=0,
                        message="Genesis block has an invalid previous_hash sentinel.",
                    )

        return ChainVerifyResult(
            valid=True,
            block_count=len(blocks),
            message=f"Chain is valid. All {len(blocks)} block(s) verified successfully.",
        )
