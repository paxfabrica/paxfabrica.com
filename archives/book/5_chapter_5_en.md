# Chapter 5: Data Ingestion & Continuous ETL Pipelines

> *"Garbage in, gospel out? Not quite. Garbage in, garbage embedded—and that's worse."*

---

## Introduction: The Data Before the Model

A high-performing Retrieval-Augmented Generation (RAG) system is rarely judged by the large language model (LLM) it calls at the end of the chain. It is judged first and foremost by the quality of the material it is given to read. An LLM, no matter how capable, cannot answer correctly when supplied with a chunk truncated mid-table, a PDF whose extraction interleave multi-column text, or a vector index that still contains documents deleted from production six months ago.

Building a production-grade RAG system rarely fails at the vector database or LLM layer. It almost always fails at the ingestion boundary. If you feed noisy, poorly formatted, or improperly chunked documents into your embedding models, your downstream application will hallucinate or miss critical context. In traditional software engineering, "garbage in, garbage out" applies; in AI engineering, it is amplified exponentially.

This chapter lays the foundation of the ingestion layer. It tackles three distinct yet tightly coupled problems:

1. **Extraction & Parsing:** How to cleanly extract text and structural layout from heterogeneous, often hostile document formats.
2. **Segmentation Strategy:** How to slice that text into semantic units optimized for a vector search engine.
3. **Continuous Synchronization:** How to maintain an active vector index in production over time—without duplicates, stale data, or ghost content—as primary data sources evolve.

An AI Product Engineer is not a data engineer in the traditional Business Intelligence (BI) sense—but they share the same underlying reflexes. The key difference lies in the end goal: every step in an AI data pipeline is optimized not for SQL reporting, but to maximize the probability that a relevant, coherent chunk is retrieved at runtime and unambiguously understood by an LLM.

```
                                  RAW INFORMATION
             (PDFs, Websites, PPTX, Docx, Databases, Confluence, APIs)
                                         │
                                         ▼
                                     DISCOVERY
                           (Tracking updates & changes)
                                         │
                                         ▼
                            EXTRACTION & OCR ENGINES
                      (Layout detection, Bounding boxes)
                                         │
                                         ▼
                           CLEANING & SANITIZATION
                  (Header/Footer stripping, Table-to-MD/HTML)
                                         │
                                         ▼
                            STRUCTURAL RECONSTRUCTION
                      (AST Parsing, Document Hierarchy)
                                         │
                                         ▼
                                CHUNKING STRATEGY
                (Fixed+Overlap, Recursive, Semantic, Parent-Child)
                                         │
                                         ▼
                       METADATA ENRICHMENT & PROVENANCE
                      (Source IDs, Lineage, Contextual Headers)
                                         │
                                         ▼
                              QUALITY VALIDATION
                      (Loss checking, Coherence scoring)
                                         │
                                         ▼
                           STORAGE & INDEXING LAYER
                 (Document Store ──► Vector Database Index)
                                         │
                                         ▼
                               RAG & AI APPLICATION

```

---

## 5.1 Complex Document Extraction, Cleaning & Parsing

### The Myth of "Plain Text"

Unlike classical NLP pipelines that often assume a clean, pre-processed corpus (e.g., `.txt` or `.csv` files), an enterprise AI system must ingest what companies actually produce: multi-column PDFs exported from Word, PowerPoint decks loaded with text scattered across visual canvas shapes, internal Markdown wikis, and dynamic web pages rendered via heavy JavaScript.

Each format contains a logical structure (headings, sections, tables, footnotes) that naive extraction fails to preserve natively. The junior engineer's mistake is treating extraction as a solved problem: running a simple text-reading library, looping through the output, and moving on. In reality, naive extraction is the primary source of silent quality degradation in RAG systems. The LLM never alerts you that it received corrupted input—it simply generates a plausible response using noisy data.

---

### Parsing Heterogeneous Formats

To extract usable text without destroying its underlying semantic relationships, every format requires a dedicated strategy.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Raw Document                               │
│              (PDF, DOCX, PPTX, HTML, Scanned Images, CSV)               │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  Structural Parsing & Vision OCR Engine                 │
│              (Bounding Box Detection, LayoutLM, Unstructured)           │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Normalization & Sanitization                        │
│             (Header/Footer Removal, Table to Markdown/HTML)             │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   Structured Clean Markdown Output                      │
└─────────────────────────────────────────────────────────────────────────┘

```

#### 1. Multi-Column PDFs: The Deceptive Format

A PDF is not a text document; it is a fixed-layout print specification—a collection of explicit instructions positioning individual characters on a two-dimensional coordinate canvas $(x, y)$. By default, it has no native concept of a "paragraph," "table," or "column."

Naive extractors read text linearly from left to right across the page width. On a two-column layout, this interleaves lines from Column A and Column B:

```
Naive Reading Order (Corrupted):
Column A Line 1 ──► Column B Line 1 ──► Column A Line 2 ──► Column B Line 2

```

This creates a string that is completely incoherent to a reader or an LLM.

To overcome this, production systems rely on two primary paradigms:

* **Geometric Layout Analysis:** Libraries like `pdfplumber` or `PyMuPDF` (`fitz`) extract bounding box coordinates for each text block. They group blocks based on horizontal bounding boundaries to reconstruct columns before stringing them together vertically.
* **Vision-Based Layout Models:** Pipelines incorporating vision transformer architectures or computer vision models (e.g., `Unstructured` in `hi_res` mode, `LayoutParser`, `Marker`, or `Azure Document Intelligence`) analyze the page visually. They identify structural bounding boxes around titles, narrative text, sidebars, and tables, guaranteeing correct reading order even on multi-column or scanned pages.

In modern Python environments, unified parsing toolkits like `unstructured` or `docling` simplify this by abstracting diverse formats behind a clean API that yields strongly typed elements (`Title`, `NarrativeText`, `Table`, `ListItem`):

```python
from unstructured.partition.pdf import partition_pdf

# Advanced visual layout extraction for complex PDFs
elements = partition_pdf(
    filename="annual_report_2026.pdf",
    strategy="hi_res",           # Triggers visual vision/OCR layout analysis
    infer_table_structure=True,  # Reconstructs tables into structured HTML
    extract_images_in_pdf=False,
)

for el in elements:
    print(f"[{type(el).__name__}]: {str(el)[:80]}...")

```

#### 2. Markdown: Deceptive Simplicity

Markdown is structured text, making it an ideal intermediate format for LLMs. However, enterprise exports from platforms like Notion, Confluence, or GitBook often contain raw HTML tags, relative link paths, embedded media, and YAML frontmatter.

Line-by-line parsing breaks code block semantics (interpreting a `#` inside a Python string comment as an $H1$ header) and discards YAML frontmatter. Frontmatter contains critical metadata like authors, modified dates, and access tags.

Best practice dictates using Abstract Syntax Tree (AST) parsers (such as `markdown-it-py` or `mistune`) to isolate frontmatter explicitly into structured metadata attributes, separate from the primary body text.

#### 3. PPTX: Spatial Dispersal

PowerPoint presentations store text inside independent vector shapes positioned on a visual canvas without a rigid reading order. A slide title, bullet list, and chart legend have no native relationship beyond sharing a slide index.

Using tools like `python-pptx`, the extraction logic must establish ordering heuristics (typically sorting shapes top-to-bottom, left-to-right) and bind extracted elements directly to their source slide number. Preserving this provenance is necessary for precise citation generation downstream.

#### 4. Web Pages: Isolating Content from Navigation Noise

Extracting raw HTML via standard DOM parsers (e.g., `BeautifulSoup` fetching `document.body.innerText`) produces corpora polluted by $40\%\text{--}60\%$ non-informative text: navigation bars, footer disclaimers, cookie banners, and inline advertising scripts.

Specialized extractors like `trafilatura` or `readability-lxml` utilize text-density heuristics to compute the ratio of text to HTML tags across DOM subtrees. This strips out site scaffolding and isolates the core article or documentation body.

---

### Sanitization and Normalization

Once structural layout parsing finishes, raw strings require deterministic cleaning before moving down the pipeline:

1. **Boilerplate Stripping:** Use regex or layout position filters to eliminate recurring running headers, page numbers, and legal disclaimers.
2. **Unicode Normalization:** Standardize character variants using Python's `unicodedata.normalize("NFKC", text)` to ensure consistent character encodings (e.g., converting non-breaking spaces, curly quotes, and ligatures into standard ASCII equivalents).
3. **Preserving Table Structures:** Never flatten a structured table into continuous unformatted text. A table is a dense representation of information. Converting it to a structured Markdown table or explicit HTML `<table>` tags allows an LLM to retain row-column alignment during reasoning.

```python
import re
import unicodedata

def sanitize_extracted_text(raw_text: str) -> str:
    """Standardize unicode characters and strip document boilerplate."""
    # Step 1: NFKC Normalization
    normalized = unicodedata.normalize("NFKC", raw_text)
    
    # Step 2: Strip recurring page disclaimers and page counters
    cleaned = re.sub(r"Page \d+ of \d+", "", normalized)
    cleaned = re.sub(r"COMPANY CONFIDENTIAL - DO NOT DISTRIBUTE", "", cleaned, flags=re.IGNORECASE)
    
    # Step 3: Collapse whitespace while preserving structural double linebreaks
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = re.sub(r"\n\s*\n", "\n\n", cleaned)
    
    return cleaned.strip()

```

> **Core Principle:** Every transformation in the cleaning stage must increase semantic clarity for the LLM without removing factual information.

---

## 5.2 Advanced Text Chunking Strategies

### The Context Window Constraint

Even with models offering context windows spanning hundreds of thousands of tokens, feeding entire long-form documents into every RAG prompt is poor engineering practice. This is due to three factors:

1. **Financial Cost:** Modern LLM APIs charge per input token.
2. **Generation Latency:** High token counts increase Time-To-First-Token (TTFT) and slow inference processing speeds.
3. **Retrieval Precision:** Vector search engines retrieve facts far more effectively when indexing small, tightly focused chunks. Large document chunks dilute semantic signals with uninformative background noise—a problem known as the "lost in the middle" phenomenon.

Chunking is the operation that breaks a document into discrete, semantically self-contained units optimized for vector indexing and LLM prompt context injection.

---

### Strategy 1: Fixed-Size Chunking with Overlap

Fixed-size chunking splits text at fixed intervals based on character or token counts (calculated via `tiktoken` or the target model's native tokenizer).

```
[ Token 1 ... Token 500 ]
              [ Token 400 ... Token 900 ]
                            [ Token 800 ... Token 1300 ]

```

```python
import tiktoken

def chunk_fixed_with_overlap(
    text: str, 
    chunk_size: int = 512, 
    overlap: int = 64, 
    encoding_name: str = "cl100k_base"
) -> list[str]:
    """Splits text into fixed token windows with a defined sliding overlap."""
    encoder = tiktoken.get_encoding(encoding_name)
    tokens = encoder.encode(text)
    
    step = chunk_size - overlap
    chunks = []
    
    for i in range(0, len(tokens), step):
        chunk_tokens = tokens[i : i + chunk_size]
        chunks.append(encoder.decode(chunk_tokens))
        
    return chunks

```

* **The Role of Overlap:** Sliding overlap (typically $10\%\text{--}20\%$ of the total chunk size) ensures that concepts falling precisely on a boundary boundary appear intact in at least one chunk.
* **Limitations:** Fixed-size chunking is blind to sentence and structural logic. It frequently splits sentences, code blocks, or tables mid-thought, cutting off key facts from their surrounding context.

---

### Strategy 2: Structural Recursive Character Chunking

Recursive chunking respects natural text breaks using a prioritized hierarchy of delimiters: double line breaks (`\n\n`), single line breaks (`\n`), whitespace, and finally characters.

Popularized by LangChain's `RecursiveCharacterTextSplitter`, this method attempts to keep paragraphs and logical sections whole. If a section exceeds the maximum token limit, it recurses down to the next separator in the hierarchy.

When working with visually partitioned documents (Section 5.1), structural chunking can group typed elements directly by section heading (`Title`), keeping tables whole and in their own dedicated chunks.

```python
# Example of structural grouping using unstructured elements
def chunk_by_document_structure(elements: list, max_tokens: int = 512) -> list[str]:
    chunks = []
    current_chunk = []
    current_token_count = 0
    
    for el in elements:
        text = str(el)
        element_tokens = len(text.split()) # Simple proxy, use tiktoken in production
        
        # Always isolate tables into their own chunk
        if el.category == "Table":
            if current_chunk:
                chunks.append("\n\n".join(current_chunk))
                current_chunk = []
                current_token_count = 0
            chunks.append(text)
            continue
            
        if current_token_count + element_tokens > max_tokens:
            chunks.append("\n\n".join(current_chunk))
            current_chunk = [text]
            current_token_count = element_tokens
        else:
            current_chunk.append(text)
            current_token_count += element_tokens
            
    if current_chunk:
        chunks.append("\n\n".join(current_chunk))
        
    return chunks

```

---

### Strategy 3: Semantic Chunking

Semantic chunking decouples chunk limits from character/token counts. Instead, it uses embedding vectors to detect logical topic transitions in the text.

```
Sentence 1 ──► Embed ──┐
                       ├── Cosine Distance Check ──► Below Threshold? ──► Keep in Chunk
Sentence 2 ──► Embed ──┘                                   │
                                                    Above Threshold?
                                                           │
                                                           ▼
                                                Create New Chunk Boundary

```

#### Mechanism

1. Split the document into individual sentences.
2. Compute embedding vectors for each sentence (or a sliding window of sentences).
3. Calculate the Cosine Distance between consecutive sentence embeddings.
4. Identify statistical spikes in semantic distance (drops in similarity). Split the document at these variance points.

```python
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

def semantic_chunking(text: str, similarity_threshold: float = 0.75) -> list[str]:
    # 1. Naive split into sentences
    sentences = [s.strip() for s in text.split(".") if s.strip()]
    if not sentences:
        return []
        
    model = SentenceTransformer("all-MiniLM-L6-v2")
    embeddings = model.encode(sentences)
    
    chunks = []
    current_chunk = [sentences[0]]
    
    for i in range(len(sentences) - 1):
        sim = cosine_similarity([embeddings[i]], [embeddings[i+1]])[0][0]
        
        if sim < similarity_threshold:
            # Semantic shift detected; finalize chunk
            chunks.append(". ".join(current_chunk) + ".")
            current_chunk = [sentences[i+1]]
        else:
            current_chunk.append(sentences[i+1])
            
    if current_chunk:
        chunks.append(". ".join(current_chunk) + ".")
        
    return chunks

```

* **Pros:** Generates chunks with high internal semantic consistency.
* **Cons:** Compute-intensive during ingestion because it requires embedding every sentence individually to determine boundaries.

---

### Strategy 4: Hierarchical / Parent-Document Chunking

Hierarchical chunking addresses the trade-off between small chunks (ideal for precise vector retrieval) and large context windows (ideal for LLM reasoning).

```
[ Parent Document / Section (1024 Tokens) - Stored in KV Store ]
       │
       ├──► Child Chunk 1 (128 Tokens) ──► Indexed in Vector DB
       ├──► Child Chunk 2 (128 Tokens) ──► Indexed in Vector DB
       └──► Child Chunk 3 (128 Tokens) ──► Indexed in Vector DB

```

#### Mechanism

1. Slice the document into small **Child Chunks** (e.g., 128 tokens) and larger **Parent Chunks** (e.g., 1024 tokens or full sections).
2. Generate embeddings for and index *only* the child chunks in the vector database.
3. Link each child chunk's metadata payload to its corresponding `parent_id` stored in a fast Key-Value store (like Redis or PostgreSQL).
4. **At Query Time:** Search against the child vectors for high semantic precision. Once a hit is found, retrieve and inject the broader *Parent Chunk* into the LLM prompt context window.

---

### Chunking Strategy Decision Matrix

| Strategy | Implementation Complexity | Semantic Coherence | Compute Cost | Primary Production Use-Case |
| --- | --- | --- | --- | --- |
| **Fixed-Size** | Very Low | Low | Very Low | Fast prototyping, simple unstructured text streams |
| **Fixed + Overlap** | Low | Moderate | Low | Robust default baseline for linear text |
| **Recursive Structural** | Moderate | High | Low | Structured documentation, manuals, Markdown wikis |
| **Semantic** | High | Very High | High | Complex domain reports (legal, medical, financial) |
| **Parent-Document** | High | High | Moderate | Deep knowledge bases needing high precision and context |

---

## 5.3 Metadata Enrichment & Contextual Padding

Text chunks should never be stored in isolation. Two identical text strings (e.g., `"The warranty period is two years."`) mean different things if one applies to *Product A (v1.0)* and the other to *Product B (v5.0)*.

Metadata provides essential context that vectors cannot capture on their own.

```json
{
  "chunk_id": "doc_fin_2026_q3_c14",
  "document_id": "doc_fin_2026_q3",
  "content": "The operating margin expanded by 140 basis points to reach 22.4%...",
  "vector": [0.0124, -0.0431, 0.0891, "..."],
  "metadata": {
    "source_url": "s3://finance-vault/2026/q3_report.pdf",
    "document_name": "q3_report.pdf",
    "file_type": "pdf",
    "page_number": 14,
    "section_title": "Financial Results > Operating Metrics",
    "created_at": "2026-08-01T10:00:00Z",
    "content_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "access_control_roles": ["finance_admin", "executive"],
    "is_active": true
  }
}

```

### Contextual Padding (Pre-pending Metadata to Chunks)

Embedding models weigh words based on their relative positioning. To prevent a chunk from losing its high-level context, you can prepend document metadata directly into the chunk text before embedding:

```python
def apply_contextual_padding(chunk_text: str, document_title: str, section_path: str) -> str:
    """Prepends structural context directly into the text prior to embedding."""
    context_header = f"Document: {document_title}\nSection: {section_path}\n---\n"
    return context_header + chunk_text

```

This ensures that even if a chunk never explicitly mentions the product name, its vector embedding reflects the overall document context.

---

## 5.4 Continuous ETL Pipelines & Deletion Management

### The Reality of Stateful Knowledge Bases

Static ingestion scripts work fine for one-off demos. However, production enterprise applications must stay synchronized with live, evolving external sources (S3 buckets, PostgreSQL databases, Notion workspaces, or Jira systems).

If a document is modified at the source, re-ingesting it naively creates duplicate chunks in your vector store. If a file is deleted at the source, leaving its vector embeddings intact creates serious security risks and causes the AI to retrieve stale or revoked information.

```
                               ┌──────────────────────────────┐
                               │   Source Data (PostgreSQL)   │
                               └──────────────┬───────────────┘
                                              │
                                     CDC / Event Triggers
                                              │
                                              ▼
                               ┌──────────────────────────────┐
                               │    ETL Ingestion Engine      │
                               │  (Calculates Hashes/Chunks)  │
                               └──────────────┬───────────────┘
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    │                                                   │
             [Upsert / Update]                                   [Delete Event]
                    │                                                   │
                    ▼                                                   ▼
          ┌──────────────────┐                                ┌──────────────────┐
          │  Vector Storage  │                                │ Target Vectors:  │
          │ (Embeddings & MD)│                                │ doc_id == Target │
          └──────────────────┘                                └──────────────────┘

```

A production ETL pipeline must be **idempotent** and **differential**: running the pipeline repeatedly on an unchanged source should produce no side effects, and only modified data should be reprocessed.

---

### Change Detection via Cryptographic Content Hashing

The most reliable strategy for tracking updates across source files is calculating a cryptographic hash (e.g., `SHA-256`) of the raw document content before transformation.

```python
import hashlib

def calculate_content_hash(content: str | bytes) -> str:
    """Generate a SHA-256 hash of raw document content."""
    if isinstance(content, str):
        content = content.encode("utf-8")
    return hashlib.sha256(content).hexdigest()

```

#### Sync Lifecycle Algorithm

Maintain a persistent state table (often called a Lineage or Sync State table) tracking: `document_id`, `last_content_hash`, and `last_synced_at`.

During an ingestion run, for every document found at the source:

1. Compute the current `SHA-256` content hash.
2. Compare it against the stored hash in the state table.
* **Hashes Match:** The document is unchanged. Skip processing.
* **Hashes Differ:** The document has been modified. Purge all existing chunks associated with `document_id` from the vector index. Re-extract, clean, chunk, embed, and upsert the updated data. Update the stored hash.


3. **Document Missing from Source:** The document was deleted. Purge its chunks from the vector store and remove its entry from the state table.

```python
async def synchronize_document_corpus(
    source_documents: list[SourceDoc], 
    sync_table: SyncStateDatabase,
    vector_store: VectorDatabase
):
    source_ids = {doc.id for doc in source_documents}
    known_ids = await sync_table.get_all_document_ids()

    # 1. Process Deletions (In sync table, but missing from source)
    deleted_ids = known_ids - source_ids
    for doc_id in deleted_ids:
        await vector_store.delete_by_document_id(doc_id)
        await sync_table.remove_entry(doc_id)

    # 2. Process Additions & Updates
    for doc in source_documents:
        current_hash = calculate_content_hash(doc.raw_bytes)
        known_hash = await sync_table.get_hash(doc.id)

        if current_hash == known_hash:
            continue  # No changes; skip expensive processing

        # If modifying an existing document, clear out old vectors first
        if known_hash is not None:
            await vector_store.delete_by_document_id(doc.id)

        # Process updated or new content
        cleaned_text = sanitize_extracted_text(doc.text_content)
        chunks = chunk_fixed_with_overlap(cleaned_text)
        
        await vector_store.upsert_chunks(document_id=doc.id, chunks=chunks)
        await sync_table.upsert_entry(doc.id, current_hash)

```

---

### Deletion Management Strategies

When handling deletions in production, you can choose between two main paradigms:

#### Paradigm A: Hard Deletes

Directly delete vector payloads from the vector engine using payload filtering:

```json
{
  "delete": {
    "filter": {
      "must": [
        { "key": "document_id", "match": { "value": "doc_usr_10492" } }
      ]
    }
  }
}

```

#### Paradigm B: Soft Deletes & Active Filtering

In high-compliance environments requiring audit trails, mark document vectors as inactive instead of purging them immediately:

1. Update the metadata payload to set `is_active: false` upon source deletion.
2. Append a mandatory filter to all incoming RAG queries:

```json
{
  "filter": {
    "must": [
      { "key": "is_active", "match": { "value": true } },
      { "key": "tenant_id", "match": { "value": "org_481" } }
    ]
  }
}

```

This guarantees that stale or deleted documents are filtered out at query runtime while keeping historical data available for compliance audits.

---

### Ingestion Triggers & Event Architectures

Depending on your product requirements, choose an appropriate trigger model:

```
[ Scheduled Batch Cron ]  ──► Low complexity, periodic updates (e.g., Nightly)
[ Webhook Integration ]  ──► Event-driven, low latency (e.g., Notion/S3 File Upload)
[ Change Data Capture ]   ──► Real-time stream processing via DB Transaction Logs (Debezium/Kafka)

```

1. **Scheduled Batch:** Runs on a fixed schedule (e.g., via Celery Beat or Airflow). Ideal when a sync latency of a few hours is acceptable.
2. **Event-Driven Webhooks:** Source systems notify your API endpoint whenever a file is created, updated, or deleted (e.g., S3 Event Notifications or GitHub Webhooks). This offers low-latency synchronization for time-sensitive applications.
3. **Change Data Capture (CDC):** Uses streaming tools like Debezium or PostgreSQL `LISTEN/NOTIFY` to capture row updates directly from transaction logs. This is the most scalable, real-time approach for large-scale enterprise databases.

---

## 5.5 Quality Control, Observability & Error Handling

### Pipeline Observability

An ingestion pipeline that fails silently is worse than one that crashes explicitly—it gives users a false sense that their knowledge base is up to date.

A production-grade pipeline must track and log the following key metrics:

```python
class PipelineObservabilityTracker:
    def __init__(self):
        self.metrics = {
            "docs_scanned": 0,
            "docs_added": 0,
            "docs_modified": 0,
            "docs_deleted": 0,
            "docs_failed": 0,
            "total_chunks_generated": 0,
            "extraction_errors": [],
        }

    def log_failure(self, doc_id: str, error: Exception):
        self.metrics["docs_failed"] += 1
        self.metrics["extraction_errors"].append({
            "document_id": doc_id,
            "error_type": type(error).__name__,
            "message": str(error)
        })

```

#### Key Metrics to Monitor

* **Ingestion Throughput:** Number of documents and chunks processed per minute.
* **Extraction Quality & Character Loss:** Flag anomalies where extraction produces zero characters or suffers an unexpected drop in byte size compared to the source file.
* **Chunk Coherence Scores:** Monitor average token counts and sentence completeness across generated chunks.
* **Sync Latency:** The time elapsed between a document modification at the source and its vector index update.

---

### Robust Retry Strategies and Dead-Letter Queues (DLQ)

When ingesting thousands of documents, file corruption, network timeouts, and API rate limits are inevitable. The ingestion pipeline should isolate failed documents without crashing the entire batch.

```python
import asyncio
import logging

logger = logging.getLogger("ETLPipeline")

async def process_event_with_exponential_backoff(
    event: dict, 
    pipeline_worker: callable, 
    max_retries: int = 3
):
    """Processes an event with exponential backoff, routing persistent failures to a DLQ."""
    attempt = 0
    base_delay = 2  # Seconds
    
    while attempt < max_retries:
        try:
            await pipeline_worker(event)
            return  # Success
        except Exception as err:
            attempt += 1
            if attempt >= max_retries:
                logger.error(f"Fatal ingestion error for event {event['doc_id']}. Routing to DLQ. Error: {err}")
                await route_to_dead_letter_queue(event, err)
                return
            
            sleep_duration = base_delay ** attempt
            logger.warning(f"Transient error on {event['doc_id']}. Retrying in {sleep_duration}s... (Attempt {attempt}/{max_retries})")
            await asyncio.sleep(sleep_duration)

async def route_to_dead_letter_queue(event: dict, error: Exception):
    # Write failed payload and error trace to a persistent DLQ for inspection
    pass

```

---

## 5.6 Key Engineering Principles to Remember

1. **Garbage In, Garbage Embedded:** High-performing RAG systems depend on clean, accurate data ingestion. No retrieval architecture can compensate for broken PDF parsing or mangled tables.
2. **Structure Over Plain Text:** Preserve document layouts. Use visual parsing tools for multi-column PDFs, structure tables into Markdown or HTML, and strip headers and footers before chunking.
3. **Select the Right Chunking Strategy:** Choose chunking techniques based on content type:
* Fixed + Overlap for baseline linear text
* Recursive Structural for structured documentation
* Semantic for complex domain reports
* Parent-Child for high-precision retrieval with broad context requirements


4. **Metadata Is Essential:** Always attach rich context (source IDs, section titles, page numbers, access control tags) to chunks.
5. **Design for Continuous Sync:** Build idempotent pipelines using SHA-256 content hashing to handle creation, modification, and deletion smoothly.
6. **Handle Deletions Explicitly:** Treat document deletion as a core synchronization step to prevent stale data and privacy violations.
7. **Build in Resilience and Observability:** Isolate document-level failures using retries and Dead-Letter Queues, and monitor key metrics like extraction loss and processing latency.

---

## Summary

In this chapter, we moved from the idea of "feeding documents to an AI" to building a production-grade data engineering pipeline.

We explored how heterogeneous formats—multi-column PDFs, Markdown, PPTX decks, and web pages—require specialized parsing strategies to preserve logical document structure. We analyzed four primary chunking strategies (Fixed+Overlap, Recursive Structural, Semantic, and Parent-Child), showing how segment quality directly impacts downstream retrieval performance.

Finally, we covered continuous ETL design, demonstrating how cryptographic hashing, differential sync, explicit deletion handling, and observability keep vector stores aligned with live enterprise data sources.

With your data cleaned, structured, and chunked into retrievable units, the next step is converting these text chunks into searchable mathematical representations.

*In the next chapter, we'll cover vector embeddings, dense vs. sparse indexing, hybrid search, and advanced retrieval architectures.*