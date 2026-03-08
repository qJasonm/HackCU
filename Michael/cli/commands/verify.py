"""
abc verify — re-compute the hash chain and report integrity.

Usage:
    abc verify
    abc verify --ledger ./custom/ledger.md
"""

from __future__ import annotations

from pathlib import Path

import typer

from cli import display
from ledger.md_store import MarkdownLedgerStore

app = typer.Typer()


@app.callback(invoke_without_command=True)
def verify(
    ledger: Path = typer.Option(
        Path("ledger.md"), "--ledger", "-l", help="Path to the ledger Markdown file."
    ),
) -> None:
    """Re-compute the SHA-256 hash chain and verify block linkage."""

    if not ledger.exists():
        display.console.print(
            f"[yellow]Ledger not found at {ledger!r}.[/yellow]\n"
            "Run [bold]abc record[/bold] to create it."
        )
        raise typer.Exit()

    store = MarkdownLedgerStore(ledger)
    blocks = store.all_blocks()
    result = store.verify_chain()

    display.print_verify_table(blocks, result)

    if not result.valid:
        raise typer.Exit(1)
