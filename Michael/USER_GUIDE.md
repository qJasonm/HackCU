# AgentCtl User Guide

AgentCtl is the "GitHub for Agents." It provides a persistent, verifiable ledger of actions taken by autonomous AI agents, presented through a clean web dashboard. It allows you to orchestrate agents across different LLM platforms (OpenAI, Anthropic, Gemini, Ollama), record their reasoning in a scratchpad, and extract structured "commits" into a blockchain-style Markdown ledger.

---

## 🚀 Getting Started

### Prerequisites

*   **Python 3.9+**
*   **API Keys** (Optional but recommended):
    *   OpenAI (GPT models)
    *   Anthropic (Claude models)
    *   Google Gemini (Used by the "Overseer" to structure outputs, or as an agent)
    *   Ollama (For running local models like Llama 3)

### Installation & Execution

1.  **Navigate to the project directory:**
    ```powershell
    cd C:\Users\Bo_jr\.gemini\antigravity\scratch\agentctl\Michael
    ```

2.  **Install dependencies (if not already done):**
    ```powershell
    pip install fastapi uvicorn sse-starlette pydantic httpx
    ```

3.  **Start the Server:**
    ```powershell
    python dashboard/run.py
    ```
    This command starts the backend locally on port `7070` and automatically sets up a `scratchpad` folder in your directory.

4.  **Open the Dashboard:** Go to [http://127.0.0.1:7070](http://127.0.0.1:7070) in your web browser.

---

## 🛠️ How it Works: The Architecture

*   **`ledger.md`**: The source of truth. A single markdown file where every structured agent action is appended as a fenced JSON block. Each block has an index, timestamp, and payload.
*   **The Scratchpad (`/scratchpad`)**: When an agent is assigned a task, its stream-of-consciousness, raw responses, and reasoning are saved here as individual timestamped Markdown files organized by agent name.
*   **The Overseer (Ledger Judge)**: An LLM-powered summarizer (defaults to Gemini, but supports others). It reads an agent's raw response from the scratchpad, extracts exactly what the agent accomplished, formats it into a rigid JSON schema, and commits it as a block to the ledger.
*   **The Pipeline**: When you dispatch a task, the dashboard automatically:
    1.  Records a `task_assigned` block.
    2.  Pings the AI Agent via API.
    3.  Saves the Agent's raw output to the scratchpad.
    4.  Passes the scratchpad to the Overseer to parse.
    5.  Commits the final structured JSON block to the ledger.

---

## 🗺️ Step-by-Step Dashboard Usage

### 1. Assigning a Task
1.  Navigate to the **Assign** tab.
2.  Select an existing agent or type a new **Agent Name** (e.g., `research-agent`).
3.  Select a **Task Type** (e.g., `code_written` or `analysis_done`).
4.  Write your **Prompt** detailing what the agent should do.
5.  Select the **Agent Platform** (OpenAI, Anthropic, Gemini, Ollama) and ensure your API key is pasted into the configuration box.
6.  Click **⚡ Dispatch Task**. The pipeline will run automatically and stream updates to the screen. 

### 2. Reviewing Agent Reasoning
1.  Navigate to the **Scratchpad** tab.
2.  Here you will see a list of timestamped markdown files representing every task your agents have processed.
3.  Click on any file to read the raw reasoning, the prompt they received, and the exact response they generated before it was summarized by the Overseer.

### 3. Managing the Ledger
1.  Navigate to the **Registry** tab to view your agents, their last seen activity, and manage them (you can click the `x` on any agent card to hide them from your dashboard).
2.  Use the **Dashboard Filter** on the main view to search through thousands of blocks by Agent Name, Action Type, or specific text/JSON payload matching.
3.  Click **Verify Integrity** on the top header to recalculate the hashes of your `ledger.md` file and ensure no internal data has been tampered with manually.

---

## 🎯 To-Do List (Project Improvements)

Here is a list of features and fixes that should be prioritized for the next iterations of AgentCtl:

- [ ] **Multi-Agent Orchestration**: Add functionality to allow agents to spawn sub-tasks for *other* agents (e.g., a PM agent assigning tasks to a Coder agent), forming a tree of dependencies in the ledger.
- [ ] **Environment Interaction**: Currently, agents only return text. Give the agent platforms native tool-calling capabilities so they can read/write files to the user's filesystem or run shell commands.
- [ ] **Ledger Forking/Branching**: Similar to Git branches, allow the ledger to branch out for hypothetical agent planning ("what if we take this path?"), which can later be merged into the main ledger branch (mainnet).
- [ ] **Persistent API Key Management**: Safely encrypt and store API keys in a `.env` file server-side instead of relying entirely on `localStorage` in the browser, to prevent users from needing to re-enter them if `localStorage` clears.
- [ ] **Pagination/Virtual Scrolling**: As the ledger grows to 10,000+ blocks, the dashboard frontend DOM will slow down. Implement virtual scrolling in `index.html` to only render the visible ledger blocks.
- [ ] **WebSockets for Live Streaming**: Upgrade SSE (Server-Sent Events) to bi-directional WebSockets to allow real-time collaborative viewing and streaming of the agent's generation process live into the Dashboard pipeline view.
- [ ] **Restore Pull Requests (PRs)**: The PR tab was temporarily removed. Re-implement a robust conflict-resolution UI for users to propose manual changes to a ledger block payload.
