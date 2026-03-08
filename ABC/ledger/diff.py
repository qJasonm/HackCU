"""
Payload diff utility — computes a unified text diff between two JSON payloads.
"""

from __future__ import annotations

import difflib
import json
from typing import Any


def payload_diff(old: dict[str, Any], new: dict[str, Any]) -> str:
    """
    Return a unified diff string comparing the pretty-printed JSON of
    `old` and `new`.  The output uses standard +/- notation.
    """
    old_lines = json.dumps(old, indent=2, sort_keys=True).splitlines(keepends=True)
    new_lines = json.dumps(new, indent=2, sort_keys=True).splitlines(keepends=True)

    diff = difflib.unified_diff(
        old_lines,
        new_lines,
        fromfile="block A payload",
        tofile="block B payload",
        lineterm="",
    )
    return "\n".join(diff)
