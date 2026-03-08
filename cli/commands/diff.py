"""
agentctl diff — show the payload diff between two blocks.

Usage:
    agentctl diff 1 2
    agentctl diff 0 3 --ledger ./path/to/ledger.md
"""

from __future__ import annotations

from pathlib import Path

import typer

from cli import display
from ledger.diff import payload_diff
from ledger.md_store import MarkdownLedgerStore

app = typer.Typer()


@app.callback(invoke_without_command=True)
def diff(
    block_a: int = typer.Argument(..., help="Index of the first (original) block."),
    block_b: int = typer.Argument(..., help="Index of the second (changed) block."),
    ledger: Path = typer.Option(
        Path("ledger.md"), "--ledger", "-l", help="Path to the ledger Markdown file."
    ),
) -> None:
    """Show a unified payload diff between two ledger blocks."""

    store = MarkdownLedgerStore(ledger)

    a = store.get_block(block_a)
    if a is None:
        display.console.print(f"[red]Block #{block_a} not found.[/red]")
        raise typer.Exit(1)

    b = store.get_block(block_b)
    if b is None:
        display.console.print(f"[red]Block #{block_b} not found.[/red]")
        raise typer.Exit(1)

    display.console.print(
        f"\n[bold]diff[/bold]  "
        f"[dim]#{block_a}[/dim] [bold]{a.agent_id}[/bold] [yellow]{a.action_type}[/yellow]  →  "
        f"[dim]#{block_b}[/dim] [bold]{b.agent_id}[/bold] [yellow]{b.action_type}[/yellow]\n"
    )

    diff_str = payload_diff(a.payload, b.payload)
    display.print_diff(diff_str)
    display.console.print()
