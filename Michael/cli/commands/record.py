"""
abc record — append a new block to the ledger.

Usage:
    abc record --agent-id alice --action task_assigned --payload '{"task":"foo"}'
    abc record --agent-id alice --action ping -f payload.json
    echo '{"task":"bar"}' | abc record --agent-id alice --action task_started
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import typer

from cli import display
from ledger.md_store import MarkdownLedgerStore
from ledger.models import ActionRecord

app = typer.Typer()


@app.callback(invoke_without_command=True)
def record(
    agent_id: str = typer.Option(..., "--agent-id", "-a", help="Agent recording this action."),
    action: str = typer.Option(..., "--action", "-t", help="Action type label."),
    payload: str | None = typer.Option(
        None,
        "--payload",
        "-p",
        help='JSON payload string, e.g. \'{"key":"value"}\'. Omit to use stdin or -f.',
    ),
    payload_file: Path | None = typer.Option(
        None,
        "--file",
        "-f",
        help="Path to a JSON file to use as the payload.",
        exists=True,
        file_okay=True,
    ),
    ledger: Path = typer.Option(
        Path("ledger.md"),
        "--ledger",
        "-l",
        help="Path to the ledger Markdown file.",
    ),
) -> None:
    """Record a new action block in the agent ledger."""

    # Resolve payload source: --payload > --file > stdin
    if payload is not None:
        try:
            payload_dict = json.loads(payload)
        except json.JSONDecodeError as exc:
            display.console.print(f"[red]Error: --payload is not valid JSON: {exc}[/red]")
            raise typer.Exit(1)
    elif payload_file is not None:
        try:
            payload_dict = json.loads(payload_file.read_text(encoding="utf-8-sig"))
        except json.JSONDecodeError as exc:
            display.console.print(f"[red]Error: {payload_file} is not valid JSON: {exc}[/red]")
            raise typer.Exit(1)
    elif not sys.stdin.isatty():
        try:
            payload_dict = json.loads(sys.stdin.read())
        except json.JSONDecodeError as exc:
            display.console.print(f"[red]Error: stdin is not valid JSON: {exc}[/red]")
            raise typer.Exit(1)
    else:
        payload_dict = {}

    store = MarkdownLedgerStore(ledger)
    action_record = ActionRecord(agent_id=agent_id, action_type=action, payload=payload_dict)

    try:
        block = store.append_block(action_record)
    except Exception as exc:
        display.console.print(f"[red]Error recording block: {exc}[/red]")
        raise typer.Exit(1)

    display.console.print(
        f"\n[bold green]✓ Block #{block.block_index} recorded[/bold green]\n"
        f"  [dim]Agent:[/dim]   [bold]{block.agent_id}[/bold]\n"
        f"  [dim]Action:[/dim]  [yellow]{block.action_type}[/yellow]\n"
        f"  [dim]Hash:[/dim]    [green]{block.block_hash[:16]}…[/green]\n"
        f"  [dim]Time:[/dim]    {block.timestamp}\n"
        f"  [dim]Ledger:[/dim]  {ledger}\n"
    )
