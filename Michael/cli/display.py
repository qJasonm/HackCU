"""
Rich-based display helpers for agentctl.
All console output goes through this module to keep formatting consistent.
"""

from __future__ import annotations

import io
import sys

from rich import box
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from ledger.models import ChainVerifyResult, LedgerBlock

# Force UTF-8 output so that Unicode symbols (✓ ✗ …) work on Windows terminals
# that default to cp1252.  We write to a UTF-8 wrapper when the system encoding
# wouldn't support those characters.
_stdout = sys.stdout
if hasattr(sys.stdout, "encoding") and (sys.stdout.encoding or "").lower().replace("-", "") not in (
    "utf8",
    "utf16",
):
    _stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

console = Console(file=_stdout, highlight=False)


# ---------------------------------------------------------------------------
# Block table
# ---------------------------------------------------------------------------

_ACTION_STYLES: dict[str, str] = {
    "genesis": "dim",
}


def print_block_table(
    blocks: list[LedgerBlock],
    title: str = "Agent Ledger",
) -> None:
    table = Table(
        title=title,
        box=box.ROUNDED,
        show_lines=True,
        header_style="bold cyan",
        title_style="bold white",
    )
    table.add_column("#", style="dim", width=5, justify="right")
    table.add_column("Agent", style="bold white", min_width=16)
    table.add_column("Action", min_width=20)
    table.add_column("Timestamp", style="dim", min_width=22)
    table.add_column("Hash", style="green", min_width=14)

    for b in blocks:
        action_style = _ACTION_STYLES.get(b.action_type, "yellow")
        table.add_row(
            str(b.block_index),
            b.agent_id,
            Text(b.action_type, style=action_style),
            b.timestamp,
            b.block_hash[:12] + "…",
        )
    console.print(table)


# ---------------------------------------------------------------------------
# Diff output
# ---------------------------------------------------------------------------

def print_diff(diff_str: str) -> None:
    if not diff_str.strip():
        console.print("[dim]Payloads are identical — no diff.[/dim]")
        return

    lines = diff_str.splitlines()
    for line in lines:
        if line.startswith("+++") or line.startswith("---"):
            console.print(f"[bold]{line}[/bold]")
        elif line.startswith("+"):
            console.print(f"[green]{line}[/green]")
        elif line.startswith("-"):
            console.print(f"[red]{line}[/red]")
        elif line.startswith("@@"):
            console.print(f"[cyan]{line}[/cyan]")
        else:
            console.print(line)


# ---------------------------------------------------------------------------
# Verify output
# ---------------------------------------------------------------------------

def print_verify_table(
    blocks: list[LedgerBlock],
    result: ChainVerifyResult,
) -> None:
    table = Table(
        title="Chain Verification",
        box=box.ROUNDED,
        show_lines=True,
        header_style="bold cyan",
        title_style="bold white",
    )
    table.add_column("#", justify="right", width=5)
    table.add_column("Agent", min_width=16)
    table.add_column("Action", min_width=18)
    table.add_column("Hash", style="dim", min_width=14)
    table.add_column("Valid", justify="center", width=7)

    for b in blocks:
        is_ok = (
            result.valid
            or (
                result.tampered_block_index is not None
                and b.block_index < result.tampered_block_index
            )
        )
        status_text = Text("✓", style="bold green") if is_ok else Text("✗", style="bold red")
        table.add_row(
            str(b.block_index),
            b.agent_id,
            b.action_type,
            b.block_hash[:12] + "…",
            status_text,
        )

    console.print(table)

    if result.valid:
        console.print(
            Panel(
                f"[bold green]✓ {result.message}[/bold green]",
                box=box.ROUNDED,
            )
        )
    else:
        console.print(
            Panel(
                f"[bold red]✗ {result.message}[/bold red]",
                box=box.ROUNDED,
            )
        )


# ---------------------------------------------------------------------------
# Single-block detail
# ---------------------------------------------------------------------------

def print_block_detail(block: LedgerBlock) -> None:
    import json

    inner = (
        f"[dim]Index:[/dim]     {block.block_index}\n"
        f"[dim]Agent:[/dim]     [bold]{block.agent_id}[/bold]\n"
        f"[dim]Action:[/dim]    [yellow]{block.action_type}[/yellow]\n"
        f"[dim]Timestamp:[/dim] {block.timestamp}\n"
        f"[dim]Prev hash:[/dim] [dim]{block.previous_hash[:16]}…[/dim]\n"
        f"[dim]Hash:[/dim]      [green]{block.block_hash[:16]}…[/green]\n"
        f"[dim]Payload:[/dim]\n{json.dumps(block.payload, indent=2)}"
    )
    console.print(Panel(inner, title=f"Block #{block.block_index}", box=box.ROUNDED))
