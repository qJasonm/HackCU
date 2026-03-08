"""
agentctl pr — manage correction proposals (Pull Requests for agents).

Sub-commands:
    agentctl pr open   --target <idx> --agent-id <id> --new-payload '{}' --reason "..."
    agentctl pr list   [--status open|merged|rejected]
    agentctl pr show   <pr_id>
    agentctl pr review <pr_id> --decision merge|reject
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Annotated

import typer

from cli import display
from ledger.md_store import MarkdownLedgerStore

app = typer.Typer(
    name="pr",
    help="Manage correction proposals (pull requests) for the agent ledger.",
    no_args_is_help=True,
)

_LedgerOpt = Annotated[
    Path,
    typer.Option("--ledger", "-l", help="Path to the ledger Markdown file."),
]


# ---------------------------------------------------------------------------
# agentctl pr open
# ---------------------------------------------------------------------------

@app.command("open")
def pr_open(
    target: int = typer.Option(..., "--target", "-t", help="Block index to correct."),
    agent_id: str = typer.Option(..., "--agent-id", "-a", help="Your agent ID."),
    new_payload: str | None = typer.Option(
        None,
        "--new-payload",
        "-p",
        help='Corrected payload as a JSON string.',
    ),
    payload_file: Path | None = typer.Option(
        None,
        "--file",
        "-f",
        help="Path to a JSON file for the corrected payload.",
        exists=True,
    ),
    reason: str = typer.Option(..., "--reason", "-r", help="Reason for the correction."),
    ledger: _LedgerOpt = Path("ledger.md"),
) -> None:
    """Open a correction proposal (PR) against an existing block."""

    # Resolve payload
    if new_payload is not None:
        try:
            payload_dict = json.loads(new_payload)
        except json.JSONDecodeError as exc:
            display.console.print(f"[red]--new-payload is not valid JSON: {exc}[/red]")
            raise typer.Exit(1)
    elif payload_file is not None:
        try:
            payload_dict = json.loads(payload_file.read_text(encoding="utf-8-sig"))
        except json.JSONDecodeError as exc:
            display.console.print(f"[red]{payload_file} is not valid JSON: {exc}[/red]")
            raise typer.Exit(1)
    elif not sys.stdin.isatty():
        try:
            payload_dict = json.loads(sys.stdin.read())
        except json.JSONDecodeError as exc:
            display.console.print(f"[red]stdin is not valid JSON: {exc}[/red]")
            raise typer.Exit(1)
    else:
        display.console.print(
            "[red]Error: provide a corrected payload via --new-payload, --file, or stdin.[/red]"
        )
        raise typer.Exit(1)

    store = MarkdownLedgerStore(ledger)

    try:
        pr = store.open_pr(
            target_block_index=target,
            proposed_by=agent_id,
            corrected_payload=payload_dict,
            reason=reason,
        )
    except ValueError as exc:
        display.console.print(f"[red]Error: {exc}[/red]")
        raise typer.Exit(1)

    display.console.print(
        f"\n[bold green]✓ PR opened[/bold green]  [bold]{pr.pr_id}[/bold]\n"
        f"  [dim]Target:[/dim]  Block #{pr.target_block_index}\n"
        f"  [dim]By:[/dim]      {pr.proposed_by}\n"
        f"  [dim]Reason:[/dim]  {pr.reason}\n"
        f"  [dim]Status:[/dim]  [yellow]{pr.status}[/yellow]\n"
        f"\n  Review with: [bold]agentctl pr review {pr.pr_id} --decision merge|reject[/bold]\n"
    )


# ---------------------------------------------------------------------------
# agentctl pr list
# ---------------------------------------------------------------------------

@app.command("list")
def pr_list(
    status: str | None = typer.Option(
        None,
        "--status",
        "-s",
        help="Filter by status: open, merged, rejected.",
    ),
    ledger: _LedgerOpt = Path("ledger.md"),
) -> None:
    """List all (or filtered) correction proposals."""

    store = MarkdownLedgerStore(ledger)
    prs = store.list_prs(status=status)

    title = "Pull Requests"
    if status:
        title += f"  [status={status!r}]"

    display.print_pr_table(prs, title=title)
    display.console.print(f"[dim]{len(prs)} PR(s). Ledger: {ledger}[/dim]")


# ---------------------------------------------------------------------------
# agentctl pr show
# ---------------------------------------------------------------------------

@app.command("show")
def pr_show(
    pr_id: str = typer.Argument(..., help="PR ID to inspect."),
    ledger: _LedgerOpt = Path("ledger.md"),
) -> None:
    """Show details and payload diff for a specific PR."""

    store = MarkdownLedgerStore(ledger)
    pr = store.get_pr(pr_id)
    if pr is None:
        display.console.print(f"[red]PR '{pr_id}' not found.[/red]")
        raise typer.Exit(1)

    target_block = store.get_block(pr.target_block_index)
    display.print_pr_detail(pr, target_block)


# ---------------------------------------------------------------------------
# agentctl pr review
# ---------------------------------------------------------------------------

@app.command("review")
def pr_review(
    pr_id: str = typer.Argument(..., help="PR ID to review."),
    decision: str = typer.Option(
        ...,
        "--decision",
        "-d",
        help="Decision: merge or reject.",
    ),
    ledger: _LedgerOpt = Path("ledger.md"),
) -> None:
    """Merge or reject a correction proposal."""

    if decision not in ("merge", "reject"):
        display.console.print(
            "[red]--decision must be [bold]merge[/bold] or [bold]reject[/bold].[/red]"
        )
        raise typer.Exit(1)

    store = MarkdownLedgerStore(ledger)

    try:
        pr = store.review_pr(pr_id, decision=decision)  # type: ignore[arg-type]
    except ValueError as exc:
        display.console.print(f"[red]Error: {exc}[/red]")
        raise typer.Exit(1)

    emoji = "✓" if decision == "merge" else "✗"
    color = "green" if decision == "merge" else "red"
    extra = (
        "\n  [dim]A[/dim] [yellow]correction_applied[/yellow] [dim]block was appended.[/dim]"
        if decision == "merge"
        else ""
    )
    display.console.print(
        f"\n[bold {color}]{emoji} PR {pr.pr_id} {pr.status}[/bold {color}]{extra}\n"
    )
