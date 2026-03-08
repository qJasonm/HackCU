"""
agentctl log — display the ledger as a git log-style Rich table.

Usage:
    agentctl log
    agentctl log --agent alice --limit 10
    agentctl log --action task_assigned --since 5
"""

from __future__ import annotations

from pathlib import Path

import typer

from cli import display
from ledger.md_store import MarkdownLedgerStore

app = typer.Typer()


@app.callback(invoke_without_command=True)
def log(
    ledger: Path = typer.Option(
        Path("ledger.md"), "--ledger", "-l", help="Path to the ledger Markdown file."
    ),
    agent: str | None = typer.Option(None, "--agent", "-a", help="Filter by agent ID."),
    action: str | None = typer.Option(None, "--action", "-t", help="Filter by action type."),
    since: int | None = typer.Option(
        None, "--since", "-s", help="Only show blocks after this index."
    ),
    limit: int = typer.Option(50, "--limit", "-n", help="Maximum number of blocks to show."),
) -> None:
    """Show ledger blocks in a git log-style table."""

    if not ledger.exists():
        display.console.print(
            f"[yellow]Ledger not found at {ledger!r}.[/yellow]\n"
            "Run [bold]agentctl record[/bold] to create it."
        )
        raise typer.Exit()

    store = MarkdownLedgerStore(ledger)
    blocks = store.all_blocks()

    if since is not None:
        blocks = [b for b in blocks if b.block_index > since]
    if agent:
        blocks = [b for b in blocks if b.agent_id == agent]
    if action:
        blocks = [b for b in blocks if b.action_type == action]

    blocks = blocks[-limit:]

    if not blocks:
        display.console.print("[dim]No blocks match the given filters.[/dim]")
        raise typer.Exit()

    filter_parts = []
    if agent:
        filter_parts.append(f"agent={agent!r}")
    if action:
        filter_parts.append(f"action={action!r}")
    if since is not None:
        filter_parts.append(f"since=#{since}")

    title = "Agent Ledger"
    if filter_parts:
        title += f"  [{', '.join(filter_parts)}]"

    display.print_block_table(blocks, title=title)
    display.console.print(
        f"[dim]Showing {len(blocks)} block(s). "
        f"Ledger: {ledger}[/dim]"
    )
