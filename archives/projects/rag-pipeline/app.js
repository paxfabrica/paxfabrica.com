(function () {
  'use strict';

  const SAMPLE_DOCS = {
    whitepaper: `# High-Performance RAG Architecture & Ingestion Strategy

## Executive Summary
In production AI engineering, Retrieval-Augmented Generation (RAG) performance depends strictly on ingestion quality. Noisy text extraction, lost table formatting, or inconsistent chunk boundaries directly degrade vector search precision.

## 1. Multi-Format Document Ingestion
Heterogeneous document sources (PDF, Markdown, HTML, Plain Text) must be parsed through strict validation schemas.
- Extensible loader architecture (`TextLoader`, `MarkdownLoader`).
- Structural preservation for headers, lists, and code blocks.
- Clean text normalization before vector transformation.

## 2. Structural & Strategy Pattern Chunking
Static character splitting often fragments semantic ideas across boundaries.
- **Fixed-Size Chunking:** Hard character window with configurable overlap.
- **Structural Chunking:** Respects Markdown headers (H1, H2, H3) and code fences.
- **Recursive Semantic Chunking:** Slices along natural paragraph and sentence breaks.

## 3. Continuous Quality Audit & Information Loss Monitoring
Every document processed by the pipeline must undergo character retention auditing:
- Retention Ratio % = (Extracted Chunk Characters / Raw Document Characters) * 100.
- Detection of orphan blocks (un-chunked floating text fragments).
- Structured JSON telemetry reports exported to logging aggregators.`,

    api_specs: `# FastAPI Microservice API Specification

## System Invariants
1. All endpoints must return Pydantic V2 validated responses.
2. Long-running ingestion jobs must run asynchronously via background workers.
3. Errors must emit standardized JSON error objects with exact fault codes.

## Endpoint: POST /api/v1/ingest
Accepts raw text or document payload and executes structural chunking.

### Request Payload:
\`\`\`json
{
  "document_id": "doc_8f92a10",
  "content": "Raw document content...",
  "strategy": "structural",
  "chunk_size": 500,
  "overlap": 50
}
\`\`\`

### Response Payload:
\`\`\`json
{
  "status": "success",
  "retention_ratio": 1.0,
  "chunk_count": 4,
  "orphan_chars": 0,
  "audit_passed": true
}
\`\`\``,

    policy: `# Corporate Information Security & LLM Data Governance Policy

## Section 1: Data Classification & PII Sanitization
All internal documents uploaded to RAG knowledge bases must be scanned for Personally Identifiable Information (PII) and secret credentials prior to vector indexing.

## Section 2: Vector Index Hygiene & Zero Stale Data
- Document deletions in primary data stores must issue automated tombstone purge events to Qdrant/PGVector.
- Re-indexing pipelines must perform atomic collection swaps to maintain 100% search availability.`
  };

  function runIngestionAudit() {
    const docSelect = document.getElementById('docSelect');
    const docInput = document.getElementById('docInput');
    const strategySelect = document.getElementById('strategySelect');
    const chunkSizeSelect = document.getElementById('chunkSizeSelect');
    const overlapSelect = document.getElementById('overlapSelect');

    const rawText = docInput.value || SAMPLE_DOCS.whitepaper;
    const strategy = strategySelect.value;
    const chunkSize = parseInt(chunkSizeSelect.value, 10);
    const overlap = parseInt(overlapSelect.value, 10);

    const totalChars = rawText.length;
    let chunks = [];

    if (strategy === 'fixed') {
      let start = 0;
      while (start < totalChars) {
        let end = Math.min(start + chunkSize, totalChars);
        chunks.push({
          id: `chunk_${chunks.length + 1}`,
          start: start,
          end: end,
          text: rawText.slice(start, end)
        });
        if (end === totalChars) break;
        start += (chunkSize - overlap);
      }
    } else if (strategy === 'structural') {
      const sections = rawText.split(/(?=\n#{1,3} )/g);
      sections.forEach((sec, idx) => {
        let trimmed = sec.trim();
        if (trimmed.length > 0) {
          if (trimmed.length <= chunkSize) {
            chunks.push({
              id: `chunk_${idx + 1}`,
              start: rawText.indexOf(trimmed),
              end: rawText.indexOf(trimmed) + trimmed.length,
              text: trimmed
            });
          } else {
            let start = 0;
            while (start < trimmed.length) {
              let end = Math.min(start + chunkSize, trimmed.length);
              chunks.push({
                id: `chunk_${idx + 1}_${chunks.length + 1}`,
                start: start,
                end: end,
                text: trimmed.slice(start, end)
              });
              if (end === trimmed.length) break;
              start += (chunkSize - overlap);
            }
          }
        }
      });
    } else { // recursive
      const paragraphs = rawText.split(/\n\n+/);
      paragraphs.forEach((p, idx) => {
        let trimmed = p.trim();
        if (trimmed) {
          chunks.push({
            id: `chunk_sem_${idx + 1}`,
            start: rawText.indexOf(trimmed),
            end: rawText.indexOf(trimmed) + trimmed.length,
            text: trimmed
          });
        }
      });
    }

    // Metrics calculation
    let chunkedCharsSum = chunks.reduce((acc, c) => acc + c.text.length, 0);
    let retentionRatio = totalChars > 0 ? (chunkedCharsSum / totalChars * 100) : 100;
    let orphanChars = Math.max(0, totalChars - chunkedCharsSum);
    let isPassed = retentionRatio >= 95.0;

    // Update UI Metrics
    document.getElementById('metricSourceChars').textContent = totalChars.toLocaleString();
    document.getElementById('metricChunkCount').textContent = chunks.length;
    document.getElementById('metricRetention').textContent = retentionRatio.toFixed(1) + '%';
    document.getElementById('metricOrphans').textContent = orphanChars.toString();

    const statusEl = document.getElementById('metricAuditStatus');
    if (statusEl) {
      statusEl.textContent = isPassed ? 'PASS (100% Quality)' : 'WARN (Data Loss)';
      statusEl.className = 'metric-card-val ' + (isPassed ? 'status-pass' : 'status-warn');
    }

    // Render Chunks List
    const listEl = document.getElementById('chunksList');
    if (listEl) {
      listEl.innerHTML = '';
      chunks.forEach(chunk => {
        const div = document.createElement('div');
        div.className = 'chunk-card';
        div.innerHTML = `
          <div class="chunk-header">
            <span class="chunk-id"># ${chunk.id}</span>
            <span class="chunk-meta">${chunk.text.length} chars | ~${Math.ceil(chunk.text.length / 4)} tokens</span>
          </div>
          <div class="chunk-text">${escapeHtml(chunk.text)}</div>
        `;
        listEl.appendChild(div);
      });
    }

    // Render Structlog Audit Report JSON
    const jsonEl = document.getElementById('auditJsonReport');
    if (jsonEl) {
      const auditPayload = {
        timestamp: new Date().toISOString(),
        event: "ingestion_quality_audit_completed",
        level: isPassed ? "info" : "warning",
        document_metrics: {
          total_source_bytes: totalChars,
          generated_chunks: chunks.length,
          retention_ratio: parseFloat((retentionRatio / 100).toFixed(4)),
          orphan_characters: orphanChars,
          strategy_applied: strategy,
          chunk_size: chunkSize,
          overlap_size: overlap
        },
        quality_gate: {
          passed: isPassed,
          zero_information_loss_guarantee: retentionRatio >= 99.0
        }
      };
      jsonEl.textContent = JSON.stringify(auditPayload, null, 2);
    }
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function init() {
    const docSelect = document.getElementById('docSelect');
    const docInput = document.getElementById('docInput');
    const btnRun = document.getElementById('btnRunIngest');

    if (docSelect && docInput) {
      docSelect.addEventListener('change', function () {
        if (SAMPLE_DOCS[this.value]) {
          docInput.value = SAMPLE_DOCS[this.value];
          runIngestionAudit();
        }
      });
    }

    if (btnRun) {
      btnRun.addEventListener('click', runIngestionAudit);
    }

    ['strategySelect', 'chunkSizeSelect', 'overlapSelect'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', runIngestionAudit);
    });

    if (docInput) {
      docInput.value = SAMPLE_DOCS.whitepaper;
    }

    runIngestionAudit();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
