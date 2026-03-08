"""
AgentCtl Dashboard — FastAPI backend

Serves the HTML dashboard and exposes REST + SSE APIs backed by ledger.md.

Usage:
    python dashboard/run.py --ledger ledger.md --port 7070
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import AsyncGenerator, Literal, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

# ---------------------------------------------------------------------------
# Make sure the agentctl package root is on sys.path
# ---------------------------------------------------------------------------
_DASHBOARD_DIR = Path(__file__).parent
_ROOT = _DASHBOARD_DIR.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from ledger.md_store import MarkdownLedgerStore
from ledger.models import ActionRecord

# ---------------------------------------------------------------------------
# Global configuration — set by run.py before uvicorn starts
# ---------------------------------------------------------------------------
LEDGER_PATH:    Path        = _ROOT / "ledger.md"
SCRATCHPAD_DIR: Path | None = None   # optional dir of agent .md / .txt files
GEMINI_API_KEY: str | None  = None   # set via --gemini-key or GEMINI_API_KEY env


def get_store() -> MarkdownLedgerStore:
    return MarkdownLedgerStore(LEDGER_PATH)


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="AgentCtl Dashboard", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Serve the frontend
# ---------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def serve_dashboard():
    html_path = _DASHBOARD_DIR / "index.html"
    return FileResponse(html_path, media_type="text/html")


# ---------------------------------------------------------------------------
# REST — blocks  (oldest → newest, i.e. genesis first)
# ---------------------------------------------------------------------------

@app.get("/api/blocks")
async def list_blocks(agent: Optional[str] = None, action: Optional[str] = None):
    store = get_store()
    blocks = store.all_blocks()          # already in index order (oldest first)
    if agent:
        blocks = [b for b in blocks if b.agent_id == agent]
    if action:
        blocks = [b for b in blocks if b.action_type == action]
    return [b.model_dump() for b in blocks]


@app.get("/api/blocks/{index}")
async def get_block(index: int):
    store = get_store()
    block = store.get_block(index)
    if block is None:
        raise HTTPException(status_code=404, detail=f"Block #{index} not found.")
    return block.model_dump()


# ---------------------------------------------------------------------------
# Agent registry — persistent JSON file stored beside ledger.md
# ---------------------------------------------------------------------------

def _registry_path() -> Path:
    return LEDGER_PATH.parent / "agents.json"

def _load_registry() -> list[dict]:
    p = _registry_path()
    if p.exists():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            return []
    return []

def _save_registry(reg: list[dict]) -> None:
    _registry_path().write_text(json.dumps(reg, indent=2), encoding="utf-8")


# ---------------------------------------------------------------------------
# REST — agents (ledger stats + registry merged)
# ---------------------------------------------------------------------------

@app.get("/api/agents")
async def list_agents():
    store = get_store()
    blocks = store.all_blocks()

    ledger_agents: dict[str, dict] = {}
    for block in blocks:
        aid = block.agent_id
        if aid not in ledger_agents:
            ledger_agents[aid] = {
                "agent_id": aid, "block_count": 0,
                "last_seen": block.timestamp, "last_action": block.action_type,
                "registered": False, "description": "", "endpoint": "",
            }
        ledger_agents[aid]["block_count"] += 1
        if block.timestamp >= ledger_agents[aid]["last_seen"]:
            ledger_agents[aid]["last_seen"]   = block.timestamp
            ledger_agents[aid]["last_action"] = block.action_type

    for r in _load_registry():
        aid = r["agent_id"]
        if aid in ledger_agents:
            ledger_agents[aid]["registered"]  = True
            ledger_agents[aid]["description"] = r.get("description", "")
            ledger_agents[aid]["endpoint"]    = r.get("endpoint", "")
        else:
            ledger_agents[aid] = {
                "agent_id": aid, "block_count": 0,
                "last_seen": None, "last_action": None,
                "registered": True,
                "description": r.get("description", ""),
                "endpoint":    r.get("endpoint", ""),
            }

    return list(ledger_agents.values())


class RegisterAgentBody(BaseModel):
    agent_id: str
    description: str = ""
    endpoint: str = ""


@app.post("/api/agents/registry")
async def register_agent(body: RegisterAgentBody):
    reg = _load_registry()
    existing = next((r for r in reg if r["agent_id"] == body.agent_id), None)
    if existing:
        existing["description"] = body.description
        existing["endpoint"]    = body.endpoint
    else:
        reg.append({"agent_id": body.agent_id, "description": body.description, "endpoint": body.endpoint})
    _save_registry(reg)
    return {"ok": True, "agent_id": body.agent_id}


@app.delete("/api/agents/registry/{agent_id}")
async def unregister_agent(agent_id: str):
    reg = [r for r in _load_registry() if r["agent_id"] != agent_id]
    _save_registry(reg)
    return {"ok": True}


# ---------------------------------------------------------------------------
# REST — pull requests
# ---------------------------------------------------------------------------

@app.get("/api/prs")
async def list_prs(status: Optional[str] = None):
    store = get_store()
    prs = store.list_prs(status=status)
    return [p.model_dump() for p in prs]


class PRReviewBody(BaseModel):
    decision: Literal["merge", "reject"]


@app.post("/api/prs/{pr_id}/review")
async def review_pr(pr_id: str, body: PRReviewBody):
    store = get_store()
    try:
        pr = store.review_pr(pr_id, body.decision)
        return pr.model_dump()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# REST — record a new block
# ---------------------------------------------------------------------------

class RecordBody(BaseModel):
    agent_id: str
    action_type: str
    payload: dict = {}


@app.post("/api/record")
async def record_block(body: RecordBody):
    store = get_store()
    try:
        block = store.append_block(
            ActionRecord(
                agent_id=body.agent_id,
                action_type=body.action_type,
                payload=body.payload,
            )
        )
        return block.model_dump()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# REST — open a PR
# ---------------------------------------------------------------------------

class OpenPRBody(BaseModel):
    target_block_index: int
    proposed_by: str
    corrected_payload: dict
    reason: str


@app.post("/api/prs")
async def open_pr(body: OpenPRBody):
    store = get_store()
    try:
        pr = store.open_pr(
            target_block_index=body.target_block_index,
            proposed_by=body.proposed_by,
            corrected_payload=body.corrected_payload,
            reason=body.reason,
        )
        return pr.model_dump()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# REST — agent task polling
# ---------------------------------------------------------------------------

@app.get("/api/tasks/{agent_id}")
async def get_tasks_for_agent(agent_id: str, status: Optional[str] = None):
    store = get_store()
    blocks = store.all_blocks()

    task_assigned = {
        b.payload.get("task"): b
        for b in blocks
        if b.action_type == "task_assigned" and b.agent_id == agent_id
    }
    acknowledged_tasks = {
        b.payload.get("task")
        for b in blocks
        if b.action_type == "task_acknowledged" and b.agent_id == agent_id
    }
    completed_tasks = {
        b.payload.get("task")
        for b in blocks
        if b.action_type == "task_completed" and b.agent_id == agent_id
    }

    results = []
    for task_name, block in task_assigned.items():
        if task_name in completed_tasks:
            task_status = "completed"
        elif task_name in acknowledged_tasks:
            task_status = "acknowledged"
        else:
            task_status = "pending"

        if status and task_status != status:
            continue

        results.append({
            "task": task_name,
            "status": task_status,
            "assigned_block": block.model_dump(),
        })

    return results


# ---------------------------------------------------------------------------
# REST — verify chain
# ---------------------------------------------------------------------------

@app.get("/api/verify")
async def verify_chain():
    store = get_store()
    result = store.verify_chain()
    return result.model_dump()


# ---------------------------------------------------------------------------
# REST — scratchpad (agent reasoning / task lists)
# ---------------------------------------------------------------------------

ALLOWED_EXTS = {".md", ".txt", ".json", ".yaml", ".yml"}


SKIP_DIRS = {".git", ".system_generated", "__pycache__", "node_modules", ".vscode"}


def _scratchpad_files() -> list[Path]:
    """Return all readable files under SCRATCHPAD_DIR (recursive, safe exts)."""
    if not SCRATCHPAD_DIR or not SCRATCHPAD_DIR.exists():
        return []
    files = []
    for f in sorted(SCRATCHPAD_DIR.rglob("*")):
        if not f.is_file() or f.suffix.lower() not in ALLOWED_EXTS:
            continue
        # Skip only specific system directories, not all hidden dirs
        rel_parts = set(f.relative_to(SCRATCHPAD_DIR).parts)
        if rel_parts & SKIP_DIRS:
            continue
        files.append(f)
    return files



@app.get("/api/scratchpad")
async def list_scratchpad():
    """List all scratchpad files available for inspection."""
    files = _scratchpad_files()
    result = []
    for f in files:
        try:
            rel = f.relative_to(SCRATCHPAD_DIR)
        except ValueError:
            rel = f.name
        stat = f.stat()
        result.append({
            "name": str(rel).replace("\\", "/"),
            "path": str(f),
            "size_bytes": stat.st_size,
            "modified": stat.st_mtime,
        })
    return result


@app.get("/api/scratchpad/file")
async def read_scratchpad_file(path: str):
    """
    Read a specific scratchpad file by its path.
    Only files within SCRATCHPAD_DIR are accessible.

    Usage: GET /api/scratchpad/file?path=task.md
    """
    if not SCRATCHPAD_DIR:
        raise HTTPException(status_code=503, detail="No scratchpad directory configured. Start the server with --scratchpad-dir.")

    target = (SCRATCHPAD_DIR / path).resolve()

    # Security: must stay within the configured scratchpad root
    try:
        target.relative_to(SCRATCHPAD_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Path traversal denied.")

    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail=f"File not found: {path}")

    if target.suffix.lower() not in ALLOWED_EXTS:
        raise HTTPException(status_code=403, detail="File type not allowed.")

    content = target.read_text(encoding="utf-8", errors="replace")
    return {
        "name": target.name,
        "path": path,
        "content": content,
        "size_bytes": len(content.encode()),
    }


@app.get("/api/scratchpad/status")
async def scratchpad_status():
    return {
        "configured": SCRATCHPAD_DIR is not None,
        "directory": str(SCRATCHPAD_DIR) if SCRATCHPAD_DIR else None,
        "exists": SCRATCHPAD_DIR.exists() if SCRATCHPAD_DIR else False,
        "file_count": len(_scratchpad_files()),
    }


class ScratchpadWriteBody(BaseModel):
    path: str          # relative path within SCRATCHPAD_DIR, e.g. "antigravity/2026-03-07_reasoning.md"
    content: str


@app.post("/api/scratchpad/write")
async def write_scratchpad_file(body: ScratchpadWriteBody):
    """
    Write content to a file within SCRATCHPAD_DIR.
    Creates parent directories as needed.
    Used by the frontend to persist agent reasoning before passing it to the Judge.
    """
    if not SCRATCHPAD_DIR:
        raise HTTPException(status_code=503, detail="No scratchpad directory configured.")

    target = (SCRATCHPAD_DIR / body.path).resolve()
    try:
        target.relative_to(SCRATCHPAD_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Path traversal denied.")

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(body.content, encoding="utf-8")
    return {"ok": True, "path": body.path, "bytes": len(body.content.encode())}


# ---------------------------------------------------------------------------
# REST — Ollama proxy  (avoids browser CORS when Ollama is on localhost)
# ---------------------------------------------------------------------------

class OllamaProxyBody(BaseModel):
    base_url: str = "http://localhost:11434"
    model: str
    messages: list[dict]     # [{role, content}, ...]
    stream: bool = False


@app.post("/api/proxy/ollama")
async def proxy_ollama(body: OllamaProxyBody):
    """
    Forward a chat request to a local Ollama instance.
    The browser cannot call Ollama directly due to CORS; this endpoint acts
    as a same-origin proxy so the browser never touches Ollama directly.
    """
    import httpx
    url = body.base_url.rstrip("/") + "/api/chat"
    payload = {
        "model":    body.model,
        "stream":   False,
        "messages": body.messages,
    }
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(url, json=payload)
        r.raise_for_status()
        data = r.json()
        # Ollama returns {"message": {"role": "assistant", "content": "..."}}
        content = data.get("message", {}).get("content", "")
        return {"content": content, "raw": data}
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail=f"Cannot reach Ollama at {body.base_url}. "
                   "Make sure Ollama is running: 'ollama serve'"
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code,
                            detail=f"Ollama error: {e.response.text}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=504, detail=f"Ollama communication error (e.g. timeout): {str(e)}")


# ---------------------------------------------------------------------------
# REST — Overseer Agent (Gemini)
#
# Uses the Gemini REST API directly (no extra SDK needed).
# The "Overseer" reads agent scratchpad content and formats it into a
# structured ledger block, acting like a GitHub commit summariser but for
# agent actions.
# ---------------------------------------------------------------------------

GEMINI_REST_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models"
    "/gemini-2.0-flash:generateContent"
)

OVERSEER_SYSTEM_PROMPT = """You are the Ledger Judge — an impartial AI whose ONLY job is "GitHub for Agents".

You receive a scratchpad document that begins with a TASK CONTEXT section (the task that was assigned
to the agent) followed by the agent's raw response, reasoning notes, stated changes, and any other output.

Your job is to read ALL of it and produce exactly ONE structured JSON ledger block that captures what
the agent actually did or reasoned — not what was asked of it, but what it produced.

Output rules (violating any = failure):
1. Return ONLY a valid JSON object — no markdown fences, no prose, no explanation.
2. The object MUST match this exact schema:
   {
     "agent_id":    "<string>",
     "action_type": "<snake_case verb, e.g. task_completed, code_written, analysis_done, plan_created, review_completed, error_encountered>",
     "payload": {
       "summary":        "<one crisp sentence: what the agent did or concluded>",
       "reasoning":      "<extract key reasoning steps or decisions the agent made>",
       "outputs":        "<concrete outputs produced: code snippets, plans, answers, recommendations — be specific>",
       "tasks_done":     ["<completed item>", ...],
       "tasks_pending":  ["<still-open item>", ...],
       "files_mentioned":["<any file paths or module names referenced>"],
       "confidence":     "<high|medium|low — how confident the agent seemed in its response>"
     }
   }
3. Do NOT fabricate. Only extract from what is present in the input.
4. Do NOT include block_index, timestamp, previous_hash, or block_hash.
5. If the agent's response is an error or refusal, set action_type = "error_encountered" and describe it in summary.
"""


class LLMAnalyzeBody(BaseModel):
    scratchpad: str            # raw text from the agent's task.md / notes
    agent_id: Optional[str] = None   # hint; LLM may override if it detects it
    api_key: Optional[str] = None    # client can supply key directly


class LLMRecordBody(LLMAnalyzeBody):
    """Same as analyze but also commits the result to the ledger."""
    pass


async def _call_gemini(scratchpad: str, api_key: str) -> dict:
    """Call Gemini REST API and return the parsed block dict."""
    import urllib.request
    import urllib.error

    url = f"{GEMINI_REST_URL}?key={api_key}"
    request_body = {
        "system_instruction": {"parts": [{"text": OVERSEER_SYSTEM_PROMPT}]},
        "contents": [{"parts": [{"text": scratchpad}]}],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
        },
    }
    data = json.dumps(request_body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise HTTPException(status_code=502, detail=f"Gemini API error {e.code}: {body}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemini request failed: {e}")

    # Extract text from Gemini response
    try:
        text = raw["candidates"][0]["content"]["parts"][0]["text"]
        block = json.loads(text)
    except (KeyError, IndexError, json.JSONDecodeError) as e:
        raise HTTPException(status_code=502, detail=f"Could not parse Gemini response: {e}\nRaw: {json.dumps(raw)[:500]}")

    return block


@app.get("/api/llm/status")
async def llm_status():
    """Check whether a Gemini API key is available server-side."""
    key = GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
    return {
        "server_key_configured": bool(key),
        "model": "gemini-2.0-flash",
        "endpoint": GEMINI_REST_URL,
    }


@app.post("/api/llm/analyze")
async def llm_analyze(body: LLMAnalyzeBody):
    """
    Analyze scratchpad content with the Gemini Overseer.
    Returns a suggested block payload WITHOUT committing it.

    The client may supply an API key in the body; otherwise the server's
    configured key is used.
    """
    api_key = body.api_key or GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="No Gemini API key available. Provide one in the request body or start the server with --gemini-key.",
        )

    block = await asyncio.get_event_loop().run_in_executor(
        None, lambda: asyncio.run(_call_gemini(body.scratchpad, api_key))
    )

    # Override agent_id hint if the client supplied one and the LLM left it generic
    if body.agent_id and block.get("agent_id") in ("", "unknown", None):
        block["agent_id"] = body.agent_id

    return {"suggested_block": block}


@app.post("/api/llm/record")
async def llm_record(body: LLMRecordBody):
    """
    Analyze scratchpad content AND commit the result directly to the ledger.
    Returns the newly appended LedgerBlock.
    """
    api_key = body.api_key or GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="No Gemini API key configured.")

    block_dict = await asyncio.get_event_loop().run_in_executor(
        None, lambda: asyncio.run(_call_gemini(body.scratchpad, api_key))
    )

    if body.agent_id and block_dict.get("agent_id") in ("", "unknown", None):
        block_dict["agent_id"] = body.agent_id

    agent_id   = block_dict.get("agent_id", body.agent_id or "overseer")
    action_type = block_dict.get("action_type", "overseer_summary")
    payload     = block_dict.get("payload", {})

    store = get_store()
    committed = store.append_block(
        ActionRecord(agent_id=agent_id, action_type=action_type, payload=payload)
    )
    return {"suggested_block": block_dict, "committed_block": committed.model_dump()}


# ---------------------------------------------------------------------------
# SSE — live block stream
# ---------------------------------------------------------------------------

@app.get("/api/stream")
async def block_stream(request: Request):
    async def event_generator() -> AsyncGenerator[dict, None]:
        store = get_store()
        last_count = store.block_count()
        yield {"event": "connected", "data": json.dumps({"block_count": last_count})}

        while True:
            if await request.is_disconnected():
                break
            await asyncio.sleep(1)
            try:
                current_blocks = store.all_blocks()
                current_count = len(current_blocks)
                if current_count > last_count:
                    new_blocks = current_blocks[last_count:]
                    for block in new_blocks:
                        yield {"event": "block", "data": json.dumps(block.model_dump())}
                    last_count = current_count
            except Exception:
                pass

    return EventSourceResponse(event_generator())


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@app.get("/api/stats")
async def get_stats():
    store = get_store()
    blocks = store.all_blocks()
    agents = {b.agent_id for b in blocks}
    action_counts: dict[str, int] = {}
    for b in blocks:
        action_counts[b.action_type] = action_counts.get(b.action_type, 0) + 1
    prs = store.list_prs()
    return {
        "block_count": len(blocks),
        "agent_count": len(agents),
        "action_counts": action_counts,
        "open_prs": sum(1 for p in prs if p.status == "open"),
    }
