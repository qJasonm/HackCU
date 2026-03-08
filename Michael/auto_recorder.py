#!/usr/bin/env python3
"""
agentctl auto-recorder — watchdog-based file system watcher.

Automatically records file events into ledger.md as they happen.
Useful for non-VS Code environments or for monitoring any directory.

Usage:
    python auto_recorder.py [--watch ./src] [--agent-id antigravity] [--ledger ./ledger.md]
    python auto_recorder.py --watch C:/myproject --agent-id claude-agent
"""

from __future__ import annotations

import argparse
import fnmatch
import logging
import sys
import time
from pathlib import Path

# Requires: pip install watchdog
try:
    from watchdog.events import FileSystemEvent, FileSystemEventHandler
    from watchdog.observers import Observer
except ImportError:
    print("Error: watchdog not installed. Run: pip install watchdog")
    sys.exit(1)

# Add agentctl to path so we can reuse md_store
sys.path.insert(0, str(Path(__file__).parent / "agentctl"))

from ledger.md_store import MarkdownLedgerStore
from ledger.models import ActionRecord

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("agentctl.watcher")

DEFAULT_EXCLUDE = [
    "*.pyc",
    "*/__pycache__/*",
    "*/.git/*",
    "*/node_modules/*",
    "ledger.md",
    "*.tmp",
    "*.lock",
]


def is_excluded(path_str: str, patterns: list[str]) -> bool:
    p = path_str.replace("\\", "/")
    return any(fnmatch.fnmatch(p, pat) or fnmatch.fnmatch(Path(p).name, pat) for pat in patterns)


class LedgerEventHandler(FileSystemEventHandler):
    """
    Watchdog event handler that records file system events as ledger blocks.

    Recorded action types:
        file_saved    — file was modified and closed (IN_CLOSE_WRITE)
        file_created  — new file appeared
        file_deleted  — file was removed
        file_renamed  — file was moved/renamed
    """

    def __init__(
        self,
        store: MarkdownLedgerStore,
        agent_id: str,
        watch_dir: Path,
        exclude_patterns: list[str],
    ) -> None:
        super().__init__()
        self.store = store
        self.agent_id = agent_id
        self.watch_dir = watch_dir
        self.exclude_patterns = exclude_patterns

        # Debounce: avoid recording the same file multiple times within 1s
        self._last_seen: dict[str, float] = {}

    def _rel(self, abs_path: str) -> str:
        try:
            return str(Path(abs_path).relative_to(self.watch_dir)).replace("\\", "/")
        except ValueError:
            return abs_path

    def _debounce(self, key: str, window: float = 1.0) -> bool:
        """Return True if this event should be skipped (duplicate within window)."""
        now = time.monotonic()
        last = self._last_seen.get(key, 0)
        if now - last < window:
            return True
        self._last_seen[key] = now
        return False

    def _record(self, action_type: str, payload: dict) -> None:
        try:
            block = self.store.append_block(
                ActionRecord(
                    agent_id=self.agent_id,
                    action_type=action_type,
                    payload=payload,
                )
            )
            log.info("Block #%d  %s  %s", block.block_index, action_type, payload)
        except Exception as exc:
            log.error("Failed to record block: %s", exc)

    def on_modified(self, event: FileSystemEvent) -> None:
        if event.is_directory:
            return
        src = event.src_path
        if is_excluded(src, self.exclude_patterns):
            return
        rel = self._rel(src)
        if self._debounce(f"modified:{rel}"):
            return
        self._record("file_saved", {"file": rel})

    def on_created(self, event: FileSystemEvent) -> None:
        if event.is_directory:
            return
        src = event.src_path
        if is_excluded(src, self.exclude_patterns):
            return
        rel = self._rel(src)
        self._record("file_created", {"file": rel})

    def on_deleted(self, event: FileSystemEvent) -> None:
        if event.is_directory:
            return
        src = event.src_path
        if is_excluded(src, self.exclude_patterns):
            return
        rel = self._rel(src)
        self._record("file_deleted", {"file": rel})

    def on_moved(self, event: FileSystemEvent) -> None:
        if event.is_directory:
            return
        if is_excluded(event.src_path, self.exclude_patterns):
            return
        self._record(
            "file_renamed",
            {
                "from": self._rel(event.src_path),
                "to": self._rel(event.dest_path),
            },
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="agentctl auto-recorder (watchdog)")
    parser.add_argument(
        "--watch",
        default=".",
        help="Directory to watch (default: current directory).",
    )
    parser.add_argument(
        "--agent-id",
        default="antigravity",
        help="Agent ID to use in ledger blocks (default: antigravity).",
    )
    parser.add_argument(
        "--ledger",
        default="ledger.md",
        help="Path to the ledger Markdown file (default: ./ledger.md).",
    )
    parser.add_argument(
        "--exclude",
        nargs="*",
        default=[],
        help="Additional glob patterns to exclude.",
    )
    args = parser.parse_args()

    watch_dir = Path(args.watch).resolve()
    ledger_path = Path(args.ledger).resolve()
    exclude = DEFAULT_EXCLUDE + args.exclude

    log.info("AgentCtl auto-recorder starting")
    log.info("  Watching:   %s", watch_dir)
    log.info("  Agent ID:   %s", args.agent_id)
    log.info("  Ledger:     %s", ledger_path)

    store = MarkdownLedgerStore(ledger_path)
    store.init_ledger()

    handler = LedgerEventHandler(
        store=store,
        agent_id=args.agent_id,
        watch_dir=watch_dir,
        exclude_patterns=exclude,
    )

    observer = Observer()
    observer.schedule(handler, str(watch_dir), recursive=True)
    observer.start()

    log.info("Recording started. Press Ctrl+C to stop.\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        log.info("Stopping…")
        observer.stop()

    observer.join()
    result = store.verify_chain()
    log.info("Final chain: %s", result.message)


if __name__ == "__main__":
    main()
