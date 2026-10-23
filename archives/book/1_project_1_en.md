# Project 0: The Perfect Kit

### ⚡ Impact Assessment & Framing Note
This document formalizes the absolute functional and technical specifications for creating the standardized software factory that will serve as the foundation for all engineering projects in this manual. In accordance with Part 0 requirements, this deliverable defines what to build and why, excluding any immediate implementation. It is about structuring the environment of the AI Product Engineer: a hybrid role born from the convergence of web development, data engineering, and product vision.

---

## 1. Context & Strategic Objectives

### 1.1 The Problem
80% of artificial intelligence projects fail or remain at the prototype stage due to misconfigured environments. Dependency conflicts ("*it works on my machine*"), lack of strict typing on unstructured data, and absence of environment isolation destroy team velocity and make industrialization impossible.

### 1.2 The Solution: "The Perfect Kit"
This project consists of designing a highly professional, modular, and 100% reproducible boilerplate repository template. It must allow any developer (from junior to senior engineer) to clone the repository and get a production-ready local infrastructure in under 5 minutes.

### 1.3 Alignment with Manifesto Pillars
* **Velocity:** Reduce the time between idea and prototype. The environment must automate all redundant boilerplate tasks to free up design time.
* **User-in-the-Loop:** Lay the groundwork for capturing user feedback and tracing probabilistic flows.
* **Ethics & Security by Default:** Natively prevent secret leaks (API keys) and isolate execution environments.

---

## 2. Functional Scope (The "What")

The kit must imperatively cover five fundamental needs:

1. Total environment isolation: Guarantee identical execution regardless of the host operating system (macOS, Linux, Windows).
2. Deterministic dependency management: Declare, resolve, and lock library versions strictly, separating the production environment from the development environment (tests, linters).
3. **AI-First code assistance and editing:** Integrate shared configuration files to align the editor with team standards (completion and engineering rules).
4. **Automated quality control (Gatekeeping):** Block the introduction of poorly formatted, untyped, or insecure code at the source before each Git commit.
5. **Minimum proof of concept:** A bootstrap script (`main.py` or a `/health` endpoint) capable of validating network connectivity and the import structure without loading business logic.

---

## 3. Required Folder Architecture (Modular Structure)

The repository must strictly conform to the following structure to guarantee separation of privileges and prevent experimental code leaks into production:

``` bash
ai-product-engineer-kit/
├── .github/                  # Continuous Integration/Deployment workflows (CI/CD)
│   └── workflows/
│       └── ci.yml
├── .vscode/                  # Shared IDE configuration (Cursor / VS Code)
│   ├── extensions.json       # Recommended team extensions
│   └── settings.json         # Formatting rules and Python paths
├── src/                      # Single application source code intended for deployment
│   ├── __init__.py
│   ├── api/                  # Endpoints and routers (e.g., FastAPI)
│   ├── core/                 # Core logic, configuration, and security
│   │   ├── llm/              # Model client abstraction
│   │   └── prompts/          # System prompt managers
│   ├── models/               # Data schemas and interface contracts (Pydantic)
│   └── main.py               # Application entry point
├── tests/                    # Automated tests (Unit, Integration, LLM-as-a-Judge)
│   ├── __init__.py
│   ├── conftest.py           # Test fixtures and configurations
│   └── test_main.py          # Environment validation
├── notebooks/                # Free exploration, prompt prototyping (Excluded from prod)
├── scripts/                  # Utility tools (ingestion, hooks, maintenance)
├── docs/                     # Technical documentation and architecture diagrams
├── .dockerignore             # Exclusion of heavy or sensitive local files
├── .gitignore                # Strict exclusion of runtimes and secret files
├── .pre-commit-config.yaml   # Automated hook execution chain
├── Makefile                  # Unified command interface for project lifecycle
├── pyproject.toml            # Central configuration and dependency manifest
└── Dockerfile                # Multi-stage containerization recipe
```

---

## 4. Technical Specifications & Tooling Choices

| Component             | Chosen Solution        | Version Constraint | Technological Justification                                                                                                                          |
| :-------------------- | :---------------------- | :----------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Language**           | Python                  | `3.11+`               | Native support for advanced typing features (`typing.Self`), async optimization, and broad ecosystem compatibility.                                 |
| **Package Manager**   | Poetry                  | `1.7+`                | Strict isolation via lockfile (`poetry.lock`), eliminating non-determinism of 3rd party packages in production.                                       |
| **Containerization**  | Docker & Docker Compose | `24+`                 | Execution environment isolation from host OS. Multi-stage build requirement for lightweight images.                                                  |
| **Quality & Linting** | Ruff                    | `0.3+`                | Advantageously replaces Flake8 and Black with ultra-fast C++ execution, preserving velocity on commits.                                               |
| **Static Typing**     | Mypy                    | `1.8+`                | Rigorous static analysis without exceptions. Essential for validating highly variable JSON payloads returned by LLMs.                                |
| **Formatting**        | Black                   | `24+`                 | Absolute code style standardization to eliminate noise during Git code reviews.                                                                      |
| **Test Framework**    | Pytest                  | `8+`                  | Proven flexibility and native async test management via `pytest-asyncio`.                                                                             |
| **Security**          | Detect-Secrets          | N/A                | Mandatory pre-commit hook blocking the push process if a string matching a private or API key pattern is detected.                                    |

---

## 5. Success Criteria & Project Boundaries

### 5.1 Definition of Done (DoD) — Acceptance Criteria

For Project 0 to be validated, it must meet the following measurable criteria:

- [ ] **Zero Complex Manual Setup:** Complete installation executes via a single command (`make install` or `poetry install`).
- [ ] **Hermetic Quality Control:** A `make lint` command or a `git commit` attempt with a poorly formatted file or type error must raise an explicit error and abort the workflow.
- [ ] **Git Sanitization:** The `.env` file containing access tokens must never be indexed. Only an anonymized `.env.example` file is accepted on the remote repository.
- [ ] **Validated Isolation:** The Docker container must build and run via `docker-compose up --build` on a clean third-party machine in under 5 minutes.