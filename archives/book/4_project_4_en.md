# Project 3: Low-Latency Real-Time Web Chatbot

> **Module:** Chapter 4 Deliverable | **Type:** Production Web Application  
> **Domain:** Backend Architecture for AI, Asynchronicity & Streaming UI  
> **Stack:** Python 3.11+, FastAPI (ASGI), Uvicorn, AsyncOpenAI / httpx, Server-Sent Events (SSE), React 18+, TypeScript, Vite, Tailwind CSS, Poetry, Ruff, Mypy  

---

## Executive Summary

In Projects 2 and 3, you validated your ability to programmatically interface with Large Language Models (LLMs), implement production retry/backoff mechanisms, and enforce structured outputs via Pydantic schemas. However, those implementations were single-user, synchronous CLI/batch scripts: an input was dispatched, the thread blocked while awaiting a response, and the script terminated.

Real-world AI products do not operate under single-user synchronous constraints. They must serve dozens to thousands of concurrent users simultaneously—where every active connection invokes an LLM whose response generation takes seconds or even tens of seconds.

**Project 3 marks your transition into full-stack AI Product Engineering.**

You will build a production-grade, low-latency web application featuring a non-blocking FastAPI backend (ASGI) connected to an interactive React frontend via Server-Sent Events (SSE). The core mandate is to eliminate thread-starvation bugs, lower Time-To-First-Token (TTFT) to under 100ms, and maintain system throughput regardless of concurrent user load.

This project evaluates your mastery of:

1. End-to-end non-blocking asynchronous Python (`asyncio`, ASGI event loop scheduling).
2. Streaming protocols (SSE vs. WebSockets) and client-side stream consumption using web standards.
3. Defensive backend connection pooling and upstream timeout/retry orchestration.
4. Concurrent request isolation (preventing single-tenant latency spikes from starving multi-tenant workers).

---

## 2. Technical Stack & Architectural Design

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   BROWSER / CLIENT                                     │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              React Frontend (Vite)                               │  │
│  │                                                                                  │  │
│  │   [Optimistic UI] ──► [Fetch + ReadableStream] ──► [Buffer] ──► [Token Render]   │  │
│  └──────────────────────────────┬──────────────────────────▲────────────────────────┘  │
└─────────────────────────────────┼──────────────────────────┼───────────────────────────┘
                                  │                          │
           1. POST /api/chat/stream │                          │ 2. text/event-stream
              (Chat Payload)      │                          │    (Chunks: data: {...}\n\n)
                                  ▼                          │
┌────────────────────────────────────────────────────────────┼───────────────────────────┐
│                               FASTAPI BACKEND (ASGI)       │                           │
│                                                            │                           │
│  ┌─────────────────────────────────────────────────────────┴────────────────────────┐  │
│  │                     Uvicorn ASGI Server (Single-Thread Loop)                     │  │
│  │                                                                                  │  │
│  │  ┌──────────────────────┐   ┌───────────────────────┐   ┌─────────────────────┐  │  │
│  │  │ Chat Route (Async)   │──►│ Event Stream Generator│──►│  StreamingResponse  │  │  │
│  │  └──────────────────────┘   └───────────────────────┘   │ (X-Accel-Buffering) │  │  │
│  │                                                         └─────────────────────┘  │  │
│  └──────────────────────────────────────┬───────────────────────────────────────────┘  │
└─────────────────────────────────────────┼──────────────────────────────────────────────┘
                                          │
                                          │ 3. Async Socket Stream
                                          │    (AsyncOpenAI / httpx.AsyncClient)
                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   UPSTREAM LLM API                                     │
│                               (OpenAI / Anthropic API)                                 │
└────────────────────────────────────────────────────────────────────────────────────────┘

```

### Technology Matrix

| Layer | Component | Selection Standard | Justification / Non-Negotiable Rules |
| --- | --- | --- | --- |
| **Backend Framework** | Python 3.11+ / FastAPI | `FastAPI` (v0.110+) | Native Starlette ASGI stack; strict integration with Pydantic V2 schemas. |
| **ASGI Server** | Uvicorn | `uvicorn` | High-performance event-loop runner built on `uvloop` and `httptools`. |
| **LLM Client** | Async SDK / `httpx` | `AsyncOpenAI` or `httpx.AsyncClient` | **Strict Non-Negotiable:** Any use of synchronous clients (`requests`, sync `OpenAI()`) inside `async def` routes results in immediate project rejection. |
| **Streaming Protocol** | HTTP SSE | Server-Sent Events (`text/event-stream`) | Unidirectional server-to-client token transport; lightweight over standard HTTP without WebSocket handshake/state overhead. |
| **Frontend Framework** | React 18+ | TypeScript + Vite | Explicit typing for chat payloads, SSE line buffers, and connection states. |
| **Styling** | Tailwind CSS | Utility-first CSS | Enables smooth typography layout, streaming indicators, and message bubble positioning. |
| **Dependency Mgmt.** | Poetry | `pyproject.toml` | Lockfile-enforced deterministic builds for reproducible environments. |
| **Quality Enforcement** | Ruff + Mypy | Strict Mode (`--strict`) | Zero warning tolerance on type annotations and non-blocking linting rules. |

---

## 3. Functional & Technical Requirements

### 3.1 Functional Requirements

1. **Interactive Conversational UI:**
* Textarea with multi-line input (Shift+Enter for newline, Enter to submit).
* Conversational thread history maintained during the user session.
* Auto-scrolling to the latest token frame, automatically pausing if the user scrolls up manually.


2. **Immediate Visual Feedback (TTFT Mitigation):**
* Upon submitting a message, the user prompt instantly attaches to the UI (Optimistic UI update).
* A "thinking" animation activates immediately until the first token chunk arrives.
* Response text streams incrementally (typewriter effect) without clearing or re-rendering the full block on every chunk.


3. **In-Flight Stream Cancellation:**
* A "Stop Generation" button displays while streaming is active.
* Clicking "Stop Generation" aborts the client's `Fetch` request via `AbortController`, signals the backend socket, and closes connection resources immediately.


4. **Multi-Turn Context Support:**
* The client maintains local chat history array `[{role: 'user'|'assistant', content: string}]` and passes the full window payload back to the server on every iteration.



---

### 3.2 Technical Requirements & Architecture Rules

1. **Non-Blocking Execution Path:**
* All API handlers must be implemented with `async def`.
* Under no circumstances may synchronous I/O (`time.sleep()`, `requests.post()`, synchronous DB drivers) be called within the event loop.
* CPU-bound operations (e.g., token parsing or local payload transformations) must be offloaded to thread executors via `asyncio.to_thread()` or `loop.run_in_executor()`.


2. **Connection Reuse & Lifespan Management:**
* The backend must maintain a single, pooled instance of the asynchronous LLM client (`httpx.AsyncClient` or `AsyncOpenAI`) initialized inside FastAPI's `lifespan` context manager.
* Client connections must be recycled gracefully on application shutdown.


3. **Upstream Resilience & Error Handling:**
* The backend generator must handle upstream timeouts, rate-limit responses (HTTP 429), and missing credentials cleanly.
* Errors encountered mid-stream must yield a structured SSE error event (`event: error\ndata: {"error": "..."}\n\n`) rather than crashing the socket connection unexpectedly.


4. **Disable Proxy Buffering:**
* The backend must issue `X-Accel-Buffering: no` and `Cache-Control: no-cache` headers on all `StreamingResponse` objects to prevent reverse proxies (e.g., Nginx) from batching tokens into large, latent bursts.



---

## 4. Step-by-Step Implementation Guide

### Step 1: Directory Structure Blueprint

Enforce a modular project layout that separates domain models, service wrappers, API routes, and frontend components:

```text
project-3-streaming-chatbot/
├── .env.example
├── .pre-commit-config.yaml
├── README.md
├── pyproject.toml
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── logging.py
│   │   ├── schemas/
│   │   │   └── chat.py
│   │   └── services/
│   │       └── llm.py
│   └── tests/
│       ├── conftest.py
│       └── test_chat_stream.py
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx
        ├── main.tsx
        ├── components/
        │   ├── ChatContainer.tsx
        │   ├── MessageInput.tsx
        │   └── MessageList.tsx
        └── types/
            └── chat.ts

```

---

### Step 2: Backend Implementation

#### `backend/app/schemas/chat.py`

Define strict Pydantic structures for incoming and outgoing data frames.

```python
from typing import List, Literal, Optional
from pydantic import BaseModel, Field

class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(..., min_length=1, description="Message text content.")

class ChatPayload(BaseModel):
    messages: List[ChatMessage] = Field(..., min_items=1)
    model: str = Field(default="gpt-4o-mini")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)

class StreamChunk(BaseModel):
    content: Optional[str] = None
    error: Optional[str] = None

```

#### `backend/app/services/llm.py`

Implement the non-blocking service abstraction capable of interacting with the real OpenAI Async API or gracefully falling back to an offline asynchronous stream generator when credentials are absent.

```python
import asyncio
import json
import os
from typing import AsyncGenerator, List
from openai import AsyncOpenAI
from app.schemas.chat import ChatMessage, StreamChunk

class LLMService:
    def __init__(self) -> None:
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key and api_key != "mock-key":
            self.client: Optional[AsyncOpenAI] = AsyncOpenAI(api_key=api_key)
        else:
            self.client = None

    async def _mock_generator(self) -> AsyncGenerator[str, None]:
        """Fallback asynchronous generator for offline execution and local tests."""
        mock_text = (
            "Hello! I am a low-latency AI assistant built with FastAPI and React. "
            "I am streaming this response token-by-token across an asynchronous "
            "Server-Sent Events (SSE) channel without blocking the backend worker thread."
        )
        for word in mock_text.split(" "):
            await asyncio.sleep(0.04)  # Simulate non-blocking network delta latency
            yield word + " "

    async def stream_chat_response(
        self, messages: List[ChatMessage], model: str, temperature: float
    ) -> AsyncGenerator[str, None]:
        """Consumes upstream model response and yields formatted SSE strings."""
        try:
            if not self.client:
                async for chunk in self._mock_generator():
                    payload = StreamChunk(content=chunk).model_dump_json()
                    yield f"event: message\ndata: {payload}\n\n"
            else:
                formatted_messages = [m.model_dump() for m in messages]
                stream = await self.client.chat.completions.create(
                    model=model,
                    messages=formatted_messages,  # type: ignore
                    temperature=temperature,
                    stream=True,
                )
                async for chunk in stream:
                    delta = chunk.choices[0].delta.content or ""
                    if delta:
                        payload = StreamChunk(content=delta).model_dump_json()
                        yield f"event: message\ndata: {payload}\n\n"

            # Signal stream completion
            yield "event: end\ndata: [DONE]\n\n"

        except Exception as exc:
            error_payload = StreamChunk(error=str(exc)).model_dump_json()
            yield f"event: error\ndata: {error_payload}\n\n"

```

#### `backend/app/main.py`

Configure the ASGI entrypoint, CORS policies, lifespan connection setup, and streaming route.

```python
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.schemas.chat import ChatPayload
from app.services.llm import LLMService

llm_service: LLMService

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    global llm_service
    # Startup: Initialize the non-blocking service instance
    llm_service = LLMService()
    yield
    # Shutdown: Cleanup operations if required

app = FastAPI(
    title="Low-Latency Real-Time AI Chatbot",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for local cross-origin React development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/chat/stream", response_class=StreamingResponse)
async def chat_stream_endpoint(payload: ChatPayload) -> StreamingResponse:
    """Asynchronous endpoint streaming LLM tokens via Server-Sent Events."""
    return StreamingResponse(
        llm_service.stream_chat_response(
            messages=payload.messages,
            model=payload.model,
            temperature=payload.temperature,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disables proxy buffering (e.g. Nginx)
        },
    )

@app.get("/healthz", status_code=status.HTTP_200_OK)
async def health_check() -> dict[str, str]:
    return {"status": "ok"}

```

---

### Step 3: Frontend Implementation

#### `frontend/src/types/chat.ts`

```typescript
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface StreamPayload {
  content?: string;
  error?: string;
}

```

#### `frontend/src/App.tsx`

Build the full-featured streaming user interface using standard React hooks and the Web Streams API (`ReadableStream`).

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { Message, StreamPayload } from './types/chat';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom as new tokens arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    const userMessage: Message = { role: 'user', content: input };
    const updatedHistory = [...messages, userMessage];

    // Optimistic UI updates
    setMessages(updatedHistory);
    setInput('');
    setIsGenerating(true);

    // Append empty placeholder for incoming assistant message
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    // Initialize AbortController for stream cancellation
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('http://localhost:8000/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedHistory }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP Error Status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        
        // Preserve incomplete tailing block in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          const dataMatch = line.match(/^data:\s*(.+)$/m);
          if (!dataMatch) continue;

          const rawData = dataMatch[1];
          if (rawData === '[DONE]') break;

          try {
            const parsed: StreamPayload = JSON.parse(rawData);
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.content) {
              setMessages((prev) => {
                const copy = [...prev];
                const lastMsg = copy[copy.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                  lastMsg.content += parsed.content;
                }
                return copy;
              });
            }
          } catch (err) {
            console.error('Failed to parse SSE payload line:', line, err);
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: '\n[Generation cancelled by user.]' },
        ]);
      } else {
        console.error('Streaming failure:', err);
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: '⚠️ Streaming error encountered. Please try again.' },
        ]);
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4 font-sans">
      <header className="border-b pb-3 mb-4">
        <h1 className="text-2xl font-bold">FastAPI + React SSE AI Assistant</h1>
        <p className="text-sm text-gray-500">Non-Blocking Asynchronous Streaming UI</p>
      </header>

      <main className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-3 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              }`}
            >
              {msg.content || (isGenerating && idx === messages.length - 1 ? 'Thinking...' : '')}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </main>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your prompt..."
          disabled={isGenerating}
          className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        {isGenerating ? (
          <button
            type="button"
            onClick={handleCancel}
            className="bg-red-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-red-700 transition"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium disabled:opacity-50 hover:bg-blue-700 transition"
          >
            Send
          </button>
        )}
      </form>
    </div>
  );
}

```

---

## 5. Verification & Testing Framework

### 5.1 Automated Concurrency Integration Test

To verify that your backend does not block the event loop under heavy load, construct an asynchronous integration test using `httpx` and `pytest-asyncio`. This test fires multiple simultaneous requests to the streaming endpoint and ensures all complete concurrently rather than executing sequentially.

#### `backend/tests/test_chat_stream.py`

```python
import time
import asyncio
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_concurrent_streaming_non_blocking() -> None:
    """Verifies that 5 parallel streaming requests do not block each other."""
    transport = ASGITransport(app=app)
    payload = {
        "messages": [{"role": "user", "content": "Tell me a story"}]
    }

    async def fetch_stream(client: AsyncClient) -> float:
        start = time.perf_counter()
        response = await client.post("/api/chat/stream", json=payload)
        assert response.status_code == 200
        
        # Read full stream content
        async for _ in response.aiter_bytes():
            pass
        return time.perf_counter() - start

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        start_all = time.perf_counter()
        
        # Execute 5 concurrent streaming requests
        durations = await asyncio.gather(*[fetch_stream(client) for _ in range(5)])
        total_wall_clock_time = time.perf_counter() - start_all

        # Individual requests take ~1.0 second (mocked sleep).
        # If blocking, total time would be >= 5.0s.
        # Asynchronous execution completes all 5 requests in < 1.5 seconds.
        assert total_wall_clock_time < 2.0, (
            f"Event loop blocked! 5 parallel streams took {total_wall_clock_time:.2f}s."
        )

```

---

## 6. Evaluation Criteria & Grading Rubric

Your submitted project will be evaluated against six primary capabilities:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          PROJECT EVALUATION WEIGHTS                             │
│                                                                                 │
│   [Non-Blocking Concurrency] ── 25%   [Real-Time SSE Performance] ── 20%        │
│   [Code Architecture]        ── 20%   [Error & Cancellation UX]   ── 15%        │
│   [Static Type Strictness]   ── 10%   [Testing & Documentation]   ── 10%        │
└─────────────────────────────────────────────────────────────────────────────────┘

```

| Evaluation Dimension | Weight | Target Specification & Criteria |
| --- | --- | --- |
| **Non-Blocking Backend Architecture** | **25%** | Complete absence of blocking calls (`requests`, `time.sleep`) in `async def` functions. The backend passes concurrent multi-request load tests without queuing or event-loop starvation. |
| **Real-Time SSE Performance** | **20%** | Time-To-First-Token (TTFT) stays under 100ms. Tokens stream incrementally without batching, buffering delays, or state resets. |
| **Clean Code Architecture** | **20%** | Explicit separation of concerns (FastAPI handlers, service classes, schema definitions, React presentation components). Connection pooling implemented via app lifespan. |
| **Error Handling & Cancellation UX** | **15%** | Abort signals instantly terminate HTTP stream sockets on both client and server. Mid-stream errors render inline gracefully without breaking the React UI. |
| **Static Type Strictness & Linting** | **10%** | Zero errors returned under `mypy --strict` and `ruff check`. Full TypeScript interface coverage on frontend data flows. |
| **Testing & Documentation** | **10%** | Comprehensive `README.md` containing run commands, architectural rationale, and an automated concurrency test suite. |

---

## 7. Submission Deliverables

To complete Project 3, submit a clean repository containing:

1. **Fully Executable Source Code:** Complete backend (FastAPI) and frontend (React/TypeScript) codebases matching the architecture specified.
2. **Deterministic Configuration:** Valid `pyproject.toml` (Poetry) and `package.json` lockfiles.
3. **`README.md` Documentation:**
* Step-by-step local setup instructions for running the app using both real API keys and offline mock mode.
* Architectural justification explaining why **SSE** was chosen over WebSockets for unidirectional AI streaming.
* Screenshot or terminal logs demonstrating the passed concurrent `pytest` execution.


4. **Automated Test Suite:** Passing `pytest` integration test suite verifying non-blocking event-loop performance under load.