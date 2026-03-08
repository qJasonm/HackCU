"""
agentctl — GitHub for Agents CLI

Entry point for the Typer application. All sub-commands are registered here.
"""

from __future__ import annotations

import typer

from cli.commands import diff, log, record, verify

app = typer.Typer(
    name="agentctl",
    help=(
        "[bold cyan]agentctl[/bold cyan] — GitHub for Agents.\n\n"
        "Manage an append-only, immutable agent action ledger stored in a "
        "human-readable [bold]ledger.md[/bold] file. Record actions, inspect "
        "the log, diff payloads, and verify chain integrity."
    ),
    rich_markup_mode="rich",
    no_args_is_help=True,
)

# Register commands
app.command("record", help="Append a new action block to the ledger.")(record.record)
app.command("log", help="Show ledger blocks in a git log-style table.")(log.log)
app.command("diff", help="Show payload diff between two blocks.")(diff.diff)
app.command("verify", help="Re-compute hash chain and verify integrity.")(verify.verify)


if __name__ == "__main__":
    app()
