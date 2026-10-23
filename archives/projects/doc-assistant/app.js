(function () {
  'use strict';

  const KNOWLEDGE_BASE = [
    {
      id: "doc_1_p1",
      title: "Architecture RAG & Hybrid Search Specs v2.4",
      content: "Hybrid Search combines BM25 lexical keyword matching with vector embedding cosine similarity using Reciprocal Rank Fusion (RRF). FlashRank cross-encoder reranking refines top-K candidate chunks before passing to LLM context.",
      bm25Score: 0.89,
      vectorScore: 0.94,
      rerankScore: 0.97
    },
    {
      id: "doc_2_p3",
      title: "FastAPI & Pydantic V2 Security Guidelines",
      content: "Pydantic V2 enforces strict schema validation at API boundaries. Input fields use Field(..., min_length=1, max_length=2000) and regex sanitizers to prevent injection payloads from reaching internal business logic.",
      bm25Score: 0.85,
      vectorScore: 0.91,
      rerankScore: 0.95
    },
    {
      id: "doc_3_p2",
      title: "FinOps Telemetry & Multi-LLM Pricing Specs",
      content: "GPT-4o API costs are calculated at $2.50 / 1M prompt tokens and $10.00 / 1M completion tokens. Post-stream token counters calculate exact USD micro-cents per session.",
      bm25Score: 0.82,
      vectorScore: 0.88,
      rerankScore: 0.93
    },
    {
      id: "doc_4_p1",
      title: "Defensive Prompt Injection & XML Framing Policy",
      content: "Untrusted user text is encapsulated inside <untrusted_user_input> XML tags. The system prompt instructs the model to parse string content strictly as data, neutralizing jailbreak attempts.",
      bm25Score: 0.88,
      vectorScore: 0.93,
      rerankScore: 0.96
    }
  ];

  const PRESET_RESPONSES = {
    fr: {
      hybrid: {
        query: "Comment la recherche hybride combine-t-elle BM25 et les vecteurs ?",
        answer: "La Recherche Hybride fusionne la recherche lexicale par mots-clés (**BM25 Okapi**) et la similarité sémantique dense (**Qdrant / text-embedding-3-small**) via **Reciprocal Rank Fusion (RRF k=60)**. Les candidats fusionnés sont ensuite ré-ordonnés par un cross-encoder local (**FlashRank**) pour injecter uniquement le Top-5 le plus pertinent dans le prompt LLM à température 0.0.",
        citations: [{ label: "Doc 1 : Spécifications RAG & Hybrid Search (Page 1)", chunkId: "doc_1_p1" }],
        chunks: [KNOWLEDGE_BASE[0], KNOWLEDGE_BASE[1]],
        latency: "0.7 ms",
        confidence: "98.4%",
        cost: "$0.00014"
      },
      pydantic: {
        query: "Quelles sont les règles de validation stricte avec Pydantic V2 ?",
        answer: "Pydantic V2 garantit une sécurité absolue aux frontières de l'API avec des schémas immuables et gelés (`frozen=True, extra='forbid'`). Tous les champs de requêtes sont validés (longueur, typage fort, assainissement regex) pour interdire toute injection ou altération d'état interne.",
        citations: [{ label: "Doc 2 : Guide Sécurité & Pydantic V2 (Page 3)", chunkId: "doc_2_p3" }],
        chunks: [KNOWLEDGE_BASE[1]],
        latency: "0.5 ms",
        confidence: "97.8%",
        cost: "$0.00011"
      },
      finops: {
        query: "Quelle est la politique tarifaire FinOps pour GPT-4o ?",
        answer: "Les requêtes sont suivies en temps réel par le collecteur FinOps. La facturation est calculée à **0,00015 $ / 1k tokens d'entrée** et **0,00060 $ / 1k tokens de sortie** (pour gpt-4o-mini). Les réponses servies par le cache persistant SHA-256 sont facturées **0,00 $** à latence sub-milliseconde.",
        citations: [{ label: "Doc 3 : Télémétrie FinOps & Tarification (Page 2)", chunkId: "doc_3_p2" }],
        chunks: [KNOWLEDGE_BASE[2]],
        latency: "0.6 ms",
        confidence: "99.1%",
        cost: "$0.00009"
      },
      injection: {
        query: "Comment le système neutralise-t-il les attaques par prompt injection ?",
        answer: "Le texte non fiable de l'utilisateur est isolé dans des balises XML de confinement strictes `<untrusted_user_input>`. Les consignes système (`T=0.0`) imposent au modèle de traiter le contenu exclusivement comme une donnée inerte, neutralisant les tentatives d'évasion de prompt.",
        citations: [{ label: "Doc 4 : Politique Défense & XML Framing (Page 1)", chunkId: "doc_4_p1" }],
        chunks: [KNOWLEDGE_BASE[3]],
        latency: "0.4 ms",
        confidence: "98.9%",
        cost: "$0.00012"
      },
      unknown: {
        query: "Quel était le cours de clôture de l'action Apple hier ?",
        answer: "⚠️ **Garde-Fou de Confiance Déclenché (S_min < 0.35) :** Je ne peux pas répondre à cette question sur la base de la documentation technique interne disponible. Le corpus d'entreprise est restreint aux spécifications logicielles, RAG, sécurité et FinOps.",
        citations: [],
        chunks: [],
        latency: "0.3 ms",
        confidence: "0.0% (Refus Net)",
        cost: "$0.00000"
      }
    },
    en: {
      hybrid: {
        query: "How does hybrid search combine BM25 and vector embeddings?",
        answer: "Hybrid Search combines lexical term matching (**BM25 Okapi**) with dense semantic embedding similarity (**Qdrant / text-embedding-3-small**) using **Reciprocal Rank Fusion (RRF k=60)**. Candidate hits are subsequently re-ranked by a local cross-encoder (**FlashRank**) to pass only the top-5 most relevant chunks to the LLM prompt at temperature 0.0.",
        citations: [{ label: "Doc 1: Hybrid Search Specs #P1", chunkId: "doc_1_p1" }],
        chunks: [KNOWLEDGE_BASE[0], KNOWLEDGE_BASE[1]],
        latency: "0.7 ms",
        confidence: "98.4%",
        cost: "$0.00014"
      },
      pydantic: {
        query: "What are the rules for strict Pydantic V2 input validation?",
        answer: "Pydantic V2 enforces 100% strict type safety and schema validation at application boundaries (`frozen=True, extra='forbid'`). All incoming payload fields pass through explicit length constraints and regex sanitization to block malformed inputs prior to downstream execution.",
        citations: [{ label: "Doc 2: Pydantic Security #P3", chunkId: "doc_2_p3" }],
        chunks: [KNOWLEDGE_BASE[1]],
        latency: "0.5 ms",
        confidence: "97.8%",
        cost: "$0.00011"
      },
      finops: {
        query: "What is the token cost policy for GPT-4o?",
        answer: "GPT-4o requests are monitored in real-time and billed at **$0.00015 per 1k prompt tokens** and **$0.00060 per 1k completion tokens** (for gpt-4o-mini). Exact-match cache hits served via SHA-256 disk persistence incur **$0.00** cost at sub-millisecond retrieval speeds.",
        citations: [{ label: "Doc 3: FinOps Specs #P2", chunkId: "doc_3_p2" }],
        chunks: [KNOWLEDGE_BASE[2]],
        latency: "0.6 ms",
        confidence: "99.1%",
        cost: "$0.00009"
      },
      injection: {
        query: "What happens if a user prompt contains a prompt injection attack?",
        answer: "User input is isolated inside `<untrusted_user_input>` XML tags and evaluated by defensive regex patterns. The system instructions explicitly separate data instructions from system rules, preventing prompt overrides.",
        citations: [{ label: "Doc 4: Prompt Defense #P1", chunkId: "doc_4_p1" }],
        chunks: [KNOWLEDGE_BASE[3]],
        latency: "0.4 ms",
        confidence: "98.9%",
        cost: "$0.00012"
      },
      unknown: {
        query: "What was the closing stock price of Apple Inc yesterday?",
        answer: "⚠️ **Confidence Gating Triggered (S_min < 0.35):** I cannot answer this question based on the provided document corpus. The knowledge base contains only technical specifications on RAG, Pydantic, FinOps, and Security.",
        citations: [],
        chunks: [],
        latency: "0.3 ms",
        confidence: "0.0% (Rejected)",
        cost: "$0.00000"
      }
    }
  };

  function getLang() {
    return document.documentElement.getAttribute('lang') || 'fr';
  }

  function executeRagQuery(presetKey) {
    const lang = getLang();
    const presets = PRESET_RESPONSES[lang] || PRESET_RESPONSES.fr;
    let data;

    if (presetKey && presets[presetKey]) {
      data = presets[presetKey];
      document.getElementById('ragQueryInput').value = data.query;
    } else {
      const customQuery = document.getElementById('ragQueryInput').value.trim();
      if (!customQuery) return;
      const lower = customQuery.toLowerCase();
      if (lower.includes('hybrid') || lower.includes('bm25') || lower.includes('search') || lower.includes('hybride')) {
        data = presets.hybrid;
      } else if (lower.includes('pydantic') || lower.includes('validation') || lower.includes('securit') || lower.includes('security')) {
        data = presets.pydantic;
      } else if (lower.includes('cost') || lower.includes('gpt-4') || lower.includes('token') || lower.includes('cout') || lower.includes('tarif')) {
        data = presets.finops;
      } else if (lower.includes('injection') || lower.includes('attack') || lower.includes('xml') || lower.includes('attaque')) {
        data = presets.injection;
      } else {
        data = presets.unknown;
      }
    }

    // Render Chunks
    const chunksContainer = document.getElementById('retrievedChunksContainer');
    if (chunksContainer) {
      chunksContainer.innerHTML = '';
      if (data.chunks.length === 0) {
        chunksContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 12px;">${lang === 'fr' ? 'Aucun extrait retenu (Score < Seuil de confiance S_min 0.35).' : 'No chunks retained (Score < Confidence threshold S_min 0.35).'}</div>`;
      } else {
        data.chunks.forEach(c => {
          const div = document.createElement('div');
          div.className = 'retrieved-chunk-item';
          div.id = `chunk_${c.id}`;
          div.innerHTML = `
            <div class="retrieved-chunk-header">
              <span class="chunk-source-tag">${escapeHtml(c.title)}</span>
              <div class="scores-group">
                <span class="score-badge">BM25: ${c.bm25Score}</span>
                <span class="score-badge">Vector: ${c.vectorScore}</span>
                <span class="score-badge highlight">Rerank: ${c.rerankScore}</span>
              </div>
            </div>
            <div style="font-size: 0.84rem; color: var(--text-main); line-height: 1.4;">${escapeHtml(c.content)}</div>
          `;
          chunksContainer.appendChild(div);
        });
      }
    }

    // Render Answer
    const answerEl = document.getElementById('ragAnswerText');
    if (answerEl) {
      let formattedHtml = data.answer.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      if (data.citations.length > 0) {
        const titleLabel = lang === 'fr' ? 'Sources Citées &amp; Ancrage :' : 'Cited Sources &amp; Provenance:';
        formattedHtml += `<div style="margin-top: 12px; font-weight: 600; font-size: 0.85rem; color: var(--text-muted);">${titleLabel}</div><div style="margin-top: 6px;">`;
        data.citations.forEach(cit => {
          formattedHtml += `<span class="citation-chip" data-chunk-target="chunk_${cit.chunkId}" title="Cliquer pour voir l'extrait source">📍 ${escapeHtml(cit.label)}</span>`;
        });
        formattedHtml += '</div>';
      }
      answerEl.innerHTML = formattedHtml;

      // Attach click listeners to citation chips
      answerEl.querySelectorAll('.citation-chip').forEach(chip => {
        chip.addEventListener('click', function () {
          const targetId = this.getAttribute('data-chunk-target');
          const targetEl = document.getElementById(targetId);
          if (targetEl) {
            targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            targetEl.classList.add('chunk-card-highlighted');
            setTimeout(() => targetEl.classList.remove('chunk-card-highlighted'), 2000);
          }
        });
      });
    }

    // Render Telemetry
    document.getElementById('telLatency').textContent = data.latency;
    document.getElementById('telConfidence').textContent = data.confidence;
    document.getElementById('telTopK').textContent = data.chunks.length.toString();
    document.getElementById('telCost').textContent = data.cost;
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
    const btnSubmit = document.getElementById('btnSubmitQuery');
    const inputQuery = document.getElementById('ragQueryInput');

    if (btnSubmit) {
      btnSubmit.addEventListener('click', () => executeRagQuery());
    }

    if (inputQuery) {
      inputQuery.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          executeRagQuery();
        }
      });
    }

    const presetBtns = document.querySelectorAll('.preset-pill-btn');
    presetBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        const key = this.dataset.preset;
        executeRagQuery(key);
      });
    });

    window.addEventListener('portfolioLanguageChanged', () => {
      executeRagQuery();
    });

    executeRagQuery('hybrid');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
