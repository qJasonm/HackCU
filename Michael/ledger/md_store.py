"""
MarkdownLedgerStore — reads and writes the ledger.md file directly.

File format
-----------
# Agent Ledger

## Block 0 — genesis

```json
{
  "block_index": 0,
  ...
}
```

## Block 1 — task_assigned

```json
{ ... }
```

Design notes
------------
- Each block is a level-2 heading + fenced JSON block.
- The ledger is append-only and immutable — blocks cannot be edited or removed.
- Parsing is done with a simple line-by-line state machine that is robust
  against extra whitespace and does not depend on regex lookaheads.
"""

from __future__ import annotations

import json
from pathlib import Path

from ledger.blockchain import BlockchainEngine
from ledger.models import (
    ActionRecord,
    ChainVerifyResult,
    LedgerBlock,
)

_HEADER = "# Agent Ledger\n"


class MarkdownLedgerStore:
    """
    File-based ledger store whose backing store is a single Markdown file.

    All operations are synchronous and atomic at the Python level
    (read → mutate string → write).  For multi-process safety, callers
    should use their own locking mechanism.

    Args:
        path: Path to ledger.md (created automatically on first use).
    """

    def __init__(self, path: Path | str = "ledger.md") -> None:
        self.path = Path(path)

    # ------------------------------------------------------------------
    # Private I/O helpers
    # ------------------------------------------------------------------

    def _read(self) -> str:
        if not self.path.exists():
            return ""
        # utf-8-sig silently strips the BOM that some Windows tools write
        return self.path.read_text(encoding="utf-8-sig")

    def _write(self, text: str) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(text, encoding="utf-8")

    # ------------------------------------------------------------------
    # Private parsing helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_blocks(text: str) -> list[dict]:
        """
        Line-by-line parser that extracts all fenced JSON blocks from Block sections.
        """
        blocks_raw: list[dict] = []
        in_block_section = False
        in_fence = False
        fence_buf: list[str] = []

        for line in text.splitlines():
            if line.startswith("## Block "):
                in_block_section = True
                in_fence = False
                fence_buf = []
            elif line == "```json" and in_block_section and not in_fence:
                in_fence = True
                fence_buf = []
            elif line == "```" and in_fence:
                in_fence = False
                try:
                    data = json.loads("\n".join(fence_buf))
                    blocks_raw.append(data)
                except json.JSONDecodeError:
                    pass  # malformed fence — skip silently
                in_block_section = False
            elif in_fence:
                fence_buf.append(line)

        return blocks_raw

    # ------------------------------------------------------------------
    # Private section formatters
    # ------------------------------------------------------------------

    @staticmethod
    def _fmt_block(block: LedgerBlock) -> str:
        j = json.dumps(block.model_dump(), indent=2, ensure_ascii=False)
        return f"\n## Block {block.block_index} — {block.action_type}\n\n```json\n{j}\n```\n"

    # ------------------------------------------------------------------
    # Ledger initialisation
    # ------------------------------------------------------------------

    def init_ledger(self) -> LedgerBlock:
        """
        Ensure ledger.md exists with a genesis block.
        Returns the genesis block (existing or newly created).
        """
        if self.path.exists():
            blocks = self.all_blocks()
            if blocks:
                return blocks[0]

        genesis = BlockchainEngine.create_genesis_block()
        self._write(_HEADER + self._fmt_block(genesis))
        return genesis

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    def append_block(self, action_record: ActionRecord) -> LedgerBlock:
        """
        Compute and append a new block to the chain.
        """
        self.init_ledger()
        blocks = self.all_blocks()
        new_block = BlockchainEngine.create_block(blocks[-1], action_record)

        text = self._read()
        section = self._fmt_block(new_block)
        text = text.rstrip("\n") + "\n" + section

        self._write(text)
        return new_block

    # ------------------------------------------------------------------
    # Read / Query
    # ------------------------------------------------------------------

    def all_blocks(self) -> list[LedgerBlock]:
        blocks_raw = self._parse_blocks(self._read())
        return [LedgerBlock(**b) for b in blocks_raw]

    def get_block(self, index: int) -> LedgerBlock | None:
        return next((b for b in self.all_blocks() if b.block_index == index), None)

    def get_by_agent(self, agent_id: str) -> list[LedgerBlock]:
        return [b for b in self.all_blocks() if b.agent_id == agent_id]

    def get_by_action(self, action_type: str) -> list[LedgerBlock]:
        return [b for b in self.all_blocks() if b.action_type == action_type]

    def get_since(self, block_index: int) -> list[LedgerBlock]:
        return [b for b in self.all_blocks() if b.block_index > block_index]

    def block_count(self) -> int:
        return len(self.all_blocks())

    # ------------------------------------------------------------------
    # Chain verification
    # ------------------------------------------------------------------

    def verify_chain(self) -> ChainVerifyResult:
        return BlockchainEngine.verify_chain(self.all_blocks())
