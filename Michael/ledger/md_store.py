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

---

## Pull Requests

### PR a1b2c3d4 — open

```json
{
  "pr_id": "a1b2c3d4",
  ...
}
```

Design notes
------------
- Each block is a level-2 heading + fenced JSON block.
- PRs live after a hard-rule divider in their own level-2 section.
- When a PR is merged, a new `correction_applied` block is appended so the
  chain stays intact and the correction is immutably recorded.
- Parsing is done with a simple line-by-line state machine that is robust
  against extra whitespace and does not depend on regex lookaheads.
"""

from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Literal

from ledger.blockchain import BlockchainEngine
from ledger.models import (
    ActionRecord,
    ChainVerifyResult,
    CorrectionProposal,
    LedgerBlock,
    utc_now_iso,
)

_HEADER = "# Agent Ledger\n"
_PR_DIVIDER = "\n---\n\n## Pull Requests\n"


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
    def _parse_sections(text: str) -> tuple[list[dict], list[dict]]:
        """
        Line-by-line parser that extracts all fenced JSON blocks, identifying
        whether each belongs to a Block or a PR based on the preceding heading.
        """
        blocks_raw: list[dict] = []
        prs_raw: list[dict] = []

        current_type: str | None = None  # "block" | "pr"
        in_fence = False
        fence_buf: list[str] = []

        for line in text.splitlines():
            if line.startswith("## Block "):
                current_type = "block"
                in_fence = False
                fence_buf = []
            elif line.startswith("### PR "):
                current_type = "pr"
                in_fence = False
                fence_buf = []
            elif line == "```json" and current_type and not in_fence:
                in_fence = True
                fence_buf = []
            elif line == "```" and in_fence:
                in_fence = False
                try:
                    data = json.loads("\n".join(fence_buf))
                    if current_type == "block":
                        blocks_raw.append(data)
                    elif current_type == "pr":
                        prs_raw.append(data)
                except json.JSONDecodeError:
                    pass  # malformed fence — skip silently
                current_type = None
            elif in_fence:
                fence_buf.append(line)

        return blocks_raw, prs_raw

    # ------------------------------------------------------------------
    # Private section formatters
    # ------------------------------------------------------------------

    @staticmethod
    def _fmt_block(block: LedgerBlock) -> str:
        j = json.dumps(block.model_dump(), indent=2, ensure_ascii=False)
        return f"\n## Block {block.block_index} — {block.action_type}\n\n```json\n{j}\n```\n"

    @staticmethod
    def _fmt_pr(pr: CorrectionProposal) -> str:
        j = json.dumps(pr.model_dump(), indent=2, ensure_ascii=False)
        return f"\n### PR {pr.pr_id} — {pr.status}\n\n```json\n{j}\n```\n"

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

        The new block section is inserted *before* the PR divider (if present)
        so that blocks always appear above the Pull Requests section.
        """
        self.init_ledger()
        blocks = self.all_blocks()
        new_block = BlockchainEngine.create_block(blocks[-1], action_record)

        text = self._read()
        section = self._fmt_block(new_block)

        if _PR_DIVIDER in text:
            idx = text.index(_PR_DIVIDER)
            text = text[:idx] + section + text[idx:]
        else:
            text = text.rstrip("\n") + "\n" + section

        self._write(text)
        return new_block

    # ------------------------------------------------------------------
    # Read / Query
    # ------------------------------------------------------------------

    def all_blocks(self) -> list[LedgerBlock]:
        blocks_raw, _ = self._parse_sections(self._read())
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

    # ------------------------------------------------------------------
    # Pull Requests
    # ------------------------------------------------------------------

    def open_pr(
        self,
        target_block_index: int,
        proposed_by: str,
        corrected_payload: dict,
        reason: str,
    ) -> CorrectionProposal:
        """Append a new correction proposal to the PR section."""
        self.init_ledger()

        # Validate target block exists
        if self.get_block(target_block_index) is None:
            raise ValueError(f"Block #{target_block_index} does not exist.")

        pr = CorrectionProposal(
            pr_id=uuid.uuid4().hex[:8],
            target_block_index=target_block_index,
            proposed_by=proposed_by,
            corrected_payload=corrected_payload,
            reason=reason,
            status="open",
            created_at=utc_now_iso(),
        )

        text = self._read()
        if _PR_DIVIDER not in text:
            text = text.rstrip("\n") + "\n" + _PR_DIVIDER
        text = text.rstrip("\n") + "\n" + self._fmt_pr(pr)
        self._write(text)
        return pr

    def list_prs(self, status: str | None = None) -> list[CorrectionProposal]:
        _, prs_raw = self._parse_sections(self._read())
        prs = [CorrectionProposal(**p) for p in prs_raw]
        if status:
            prs = [p for p in prs if p.status == status]
        return prs

    def get_pr(self, pr_id: str) -> CorrectionProposal | None:
        return next((p for p in self.list_prs() if p.pr_id == pr_id), None)

    def review_pr(
        self,
        pr_id: str,
        decision: Literal["merge", "reject"],
    ) -> CorrectionProposal:
        """
        Update the PR status in-file.

        If merging, a `correction_applied` block is appended to the chain so
        the correction is recorded immutably without rewriting history.
        """
        pr = self.get_pr(pr_id)
        if pr is None:
            raise ValueError(f"PR '{pr_id}' not found.")
        if pr.status != "open":
            raise ValueError(f"PR '{pr_id}' is already {pr.status!r}.")

        old_section = self._fmt_pr(pr)
        pr.status = "merged" if decision == "merge" else "rejected"
        new_section = self._fmt_pr(pr)

        text = self._read().replace(old_section, new_section, 1)
        self._write(text)

        if decision == "merge":
            self.append_block(
                ActionRecord(
                    agent_id="ledger-system",
                    action_type="correction_applied",
                    payload={
                        "pr_id": pr.pr_id,
                        "target_block_index": pr.target_block_index,
                        "corrected_payload": pr.corrected_payload,
                        "proposed_by": pr.proposed_by,
                        "reason": pr.reason,
                    },
                )
            )

        return pr
