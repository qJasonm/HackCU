"""
Launcher for the ABC Dashboard.

Usage:
    python dashboard/run.py --ledger ledger.md --port 7070
    python dashboard/run.py --ledger ledger.md --scratchpad-dir C:/Users/Bo_jr/.gemini/antigravity/brain
    python dashboard/run.py --ledger ledger.md --gemini-key AIza...
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

_ROOT = Path(__file__).parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import uvicorn
import dashboard.server as _server


def main() -> None:
    parser = argparse.ArgumentParser(description="ABC Dashboard server")
    parser.add_argument("--ledger",         default="ledger.md",  help="Path to ledger.md")
    parser.add_argument("--host",           default="127.0.0.1",  help="Bind host")
    parser.add_argument("--port", type=int, default=7070,         help="Port")
    parser.add_argument("--reload",         action="store_true",  help="Auto-reload (dev)")
    parser.add_argument(
        "--scratchpad-dir",
        default=None,
        help="Directory of agent scratchpad files (.md, .txt) to expose in the dashboard",
    )
    parser.add_argument(
        "--gemini-key",
        default=None,
        help="Gemini API key for the Overseer Agent (also reads GEMINI_API_KEY env var)",
    )
    args = parser.parse_args()

    ledger_path = Path(args.ledger).resolve()
    if not ledger_path.parent.exists():
        ledger_path.parent.mkdir(parents=True)

    _server.LEDGER_PATH = ledger_path

    if args.scratchpad_dir:
        _server.SCRATCHPAD_DIR = Path(args.scratchpad_dir).resolve()
    else:
        _server.SCRATCHPAD_DIR = (ledger_path.parent / "scratchpad").resolve()
        
    _server.SCRATCHPAD_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[abc-dashboard] Scratchpad: {_server.SCRATCHPAD_DIR}")
    gemini_key = args.gemini_key or os.environ.get("GEMINI_API_KEY")
    if gemini_key:
        _server.GEMINI_API_KEY = gemini_key
        print(f"[abc-dashboard] Gemini API key: configured ✓")
    else:
        print(f"[abc-dashboard] Gemini API key: not set (Overseer will require key from browser)")

    print(f"[abc-dashboard] Ledger:    {ledger_path}")
    print(f"[abc-dashboard] Dashboard: http://{args.host}:{args.port}")

    uvicorn.run(
        "dashboard.server:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="info",
    )


if __name__ == "__main__":
    main()
