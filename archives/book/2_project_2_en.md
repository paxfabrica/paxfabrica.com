# 📋 TECHNICAL & FUNCTIONAL SPECIFICATION DOCUMENT
## Project 1: Automated AI Intelligence CLI Wrapper

*Starting base: Standardized environment from Project 0 Kit (Docker, Poetry, Ruff, Mypy, Pytest)*  
*Level: Beginner to Intermediate (Junior Dev → AI Product Engineer)*

---

## 🧭 1. Context & Product Objectives

### 1.1 Business Context
In a continuously evolving AI ecosystem (new models, benchmarks, pricing grids), a product team spends several hours a day manually sifting through newsletters, tech blogs, news feeds, and RSS feeds to identify trends. This manual task is time-consuming, subject to attention bias, and disconnected from developers' terminal workflows. Furthermore, classic web interfaces (ChatGPT/Claude type) do not allow precise measurement of essential engineering metrics (costs per million tokens, real computational latencies).

### 1.2 Main Objective
Develop an industrial-grade, resilient, typed, and highly configurable command-line tool (CLI) in Python. This tool automates the retrieval, analysis, and summarization of raw text or technology news sources via LLM, while ensuring strict FinOps control (token calculation, USD budget estimation) and full network fault tolerance. The program is designed to be executed on-demand or automated via a scheduled task (cron or CI/CD pipeline).

### 1.3 Key Performance Indicators (Product KPIs)
* **Average generation time:** < 15 seconds per analysis.
* **Structuring reliability:** JSON/Pydantic output compliance rate > 98%.
* **Economic Intelligence:** Average cost per analysis stabilized below $0.05.
* **Input flexibility:** Ability to process 3 different source types (URL, local file, direct text).

---

## 🎯 2. Functional Specifications (MVP)

### SF-01: User Input & Source Management
The CLI must accept multiple information capture modes for its main command:
* **Direct text:** Raw input in quotes via the main argument or the `--text` / `-t` option.
* **Local file:** Reading text or Markdown files (`.txt`, `.md`).
* **URL (Web scraping):** Extraction of textual content from an HTML page (e.g., Hacker News, TechCrunch, arXiv) with a cleaning pipeline (removal of tags and superfluous whitespace).
* **Validation:** If the input is empty, non-existent, or consists only of whitespace, the application must raise an explicit error, return exit code `1`, and stop cleanly without crashing the Python interpreter.

### SF-02: LLM Generation Pipeline (Orchestration)
* **Model instructions:** The system injects the cleaned text into a rigorous system prompt that instructs the LLM to act as a senior analyst specialized in AI.
* **Format constraint:** The final response must be structured according to a strict data schema (executive summary, key impacts, recommendations).
* **Size constraint:** Generation is limited via a `max_tokens` parameter (configurable, default between 300 and 500 tokens for simple summaries, extensible up to 2000 tokens for in-depth impact analyses) to avoid budget waste.

### SF-03: Metrics Tracking & FinOps Observability
After each successful API call, the system extracts consumption metadata and calculates in real-time:
* The exact number of input tokens (Prompt tokens).
* The exact number of output tokens (Completion tokens).
* The overall request execution time (latency in seconds or milliseconds).
* The precise financial cost in USD, dynamically calculated based on the per-million-token pricing of the selected model.

### SF-04: Enriched Console Display & Output Formats
The CLI uses the `Rich` library to provide a high-end user experience:
* **Markdown rendering:** Display of the summary in an elegant panel that properly handles rich syntax (headings, bullets, bold).
* **Summary table:** A table hierarchically summarizes the inference FinOps metrics (duration, tokens, exact cost).
* **Export options:** The user can choose the format via the `--output` / `-o` option:
  * `console`: Interactive Rich display (default).
  * `json`: Raw output usable for downstream software pipelines.
  * `markdown`: Direct save to an external file (e.g., `--output report.md`).

### SF-05: Local Cache System (Performance & FinOps)
To avoid redundant processing of the same content (and save API latency and costs), the application must integrate a local persistence system:
* Analyzed data is stored (by hash or URI) in a local JSON file (e.g., `~/.cache/veille_ia.json`).
* Configurable cache validity TTL (e.g., `--cache-ttl 3600`), bypassable on demand using a `--no-cache` flag.

---

## 🛠️ 3. Technical Specifications & Architecture

### ST-01: Ecosystem Environment Alignment
* **Runtime:** Python 3.11+ with strict static typing.
* **Package Manager:** Poetry configured in strict mode with a reproducible `poetry.lock` file.
* **Secrets:** Absolute isolation of authentication keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc.) via a local `.env` file, loaded using `python-dotenv` or `pydantic-settings`. An anonymized `.env.example` file must be present at the root.

### ST-02: Data Modeling (Pydantic V2)
Information processing relies on strictly typed data structures for request validation and response parsing:

```python
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class AnalysisReport(BaseModel):
    source: str = Field(description="Analyzed source or URL")
    analyzed_at: datetime = Field(default_factory=datetime.utcnow)
    model_used: str = Field(description="Exact identifier of model executing inference")
    
    title: str = Field(description="Synthetic title of AI news")
    summary: str = Field(description="Condensed summary (max 200 words)")
    key_points: List[str] = Field(description="3 to 5 key points extracted")
    
    impact_technical: str = Field(description="Impact on software architectures and tools")
    impact_business: str = Field(description="Commercial opportunities or threats")
    impact_regulatory: Optional[str] = Field(None, description="Implications for GDPR or AI Act if relevant")
    
    recommendation: str = Field(description="Concrete action recommended for technical team")
    priority: str = Field(description="Priority level: high, medium, low")
    
    # FinOps metrics injected at runtime
    prompt_tokens: int = Field(default=0)
    completion_tokens: int = Field(default=0)
    total_tokens: int = Field(default=0)
    estimated_cost_usd: float = Field(default=0.0)
    execution_time_seconds: float = Field(default=0.0)
```

### ST-03: Modular Folder Architecture
The project structure directly follows Project 0 by granularly isolating software responsibilities:

```bash
cli-ai-watcher/
├── .env.example              # Environment variables template (API key)
├── pyproject.toml            # Poetry configuration file and dev tools
├── README.md                 # Setup and getting started documentation
├── src/
│   └── ai_watcher/
│       ├── __init__.py
│       ├── main.py           # CLI entry point (Typer or Click framework)
│       ├── config.py         # Settings loading and validation via Pydantic
│       ├── exceptions.py     # Soft application exception definitions
│       ├── core/
│       │   ├── __init__.py
│       │   ├── extractor.py  # Extraction logic (HTML scraping / file reading)
│       │   ├── chunker.py    # Intelligent semantic chunking if text is large
│       │   └── analyzer.py   # Pipeline orchestration and analysis
│       ├── clients/
│       │   ├── __init__.py
│       │   └── llm_client.py # Encapsulated API call client with Tenacity (Retry)
│       ├── utils/
│       │   ├── __init__.py
│       │   ├── cache.py      # Local cache persistence and TTL
│       │   └── cost.py       # Pricing grid and FinOps cost calculator
│       └── formatters/
│           ├── __init__.py
│           ├── console.py    # Rich layout and table generation
│           └── markdown.py   # Writing logic and .md file export
└── tests/
    ├── __init__.py
    ├── unit/                 # Mocked unit tests (extractor, chunker, prompt)
    └── integration/          # End-to-end tests (real or mocked client calls)
```

### ST-04: Model Configuration & Network Resilience
* **Increased Determinism:** To guarantee factual fidelity and accuracy of technical summaries, the model temperature must be set low, between `0.0` and `0.3`, combined with a `Top_p` of `0.9`.
* **Robustness Policy (Retry Policy):** Since network calls to third-party servers are subject to micro-outages or overloads, the `llm_client.py` module must intercept transient errors (Rate Limits HTTP 429, Server Errors HTTP 5xx, Timeouts) via the `Tenacity` library.
  * **Strategy:** Exponential backoff enriched with Jitter.
  * **Parameters:** Maximum 4 attempts, progressive interpolated wait (e.g., 2s, 4s, 8s).
  * **Logging:** Systematic emission of a yellow warning log (`logger.warning`) indicating the current attempt number before temporarily suspending the thread.

---

## 📦 4. Mandated Technical Stack

| Component | Chosen Technology | Architectural Role |
| :--- | :--- | :--- |
| **Language** | Python 3.11+ | Main execution runtime and static typing. |
| **Manager** | Poetry | Dependency resolution, isolation, and locking. |
| **CLI Interface** | Typer (or Click) | Console argument and option routing framework. |
| **HTTP Client** | HTTPX / OpenAI SDK | Async/sync client for remote requests. |
| **Resilience** | Tenacity | Automation decorator for retries and exponential backoff. |
| **Validation** | Pydantic V2 | Strict modeling and typing of input/output data structures. |
| **UX Interface** | Rich | Markdown text rendering engine, loading spinners, and tables. |
| **Quality & Style** | Ruff + Mypy | Static analysis and code standard compliance tools. |
| **Tests** | Pytest + Pytest-cov | Automated test execution suite and coverage measurement. |

---

## ✅ 5. Acceptance Criteria (Definition of Done - DoD)

For Project 1 to be declared finalized and ready for use, all of the following boxes must be validated:

* **Engineering Quality & Robustness:**
  - [ ] The code passes Ruff linting and Mypy strict type checking without errors.
  - [ ] Network errors and API exceptions are intercepted without unhandled crashes.
* **Functional Validation:**
  - [ ] All three input modes (URL, local file, direct text) produce a compliant analysis report.
  - [ ] Console output with Rich correctly renders panels, metrics, and tables.
  - [ ] Exporting to Markdown or JSON format creates a valid file on disk.
* **FinOps Transparency:**
  - [ ] Each execution displays token count, cost, and latency in the console output.
* **Cache Efficiency:**
  - [ ] A second execution with the same input returns the cached result without calling the API.