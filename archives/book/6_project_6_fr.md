# Spécification du Projet 5 : Assistant documentaire d'entreprise ("Chat with Your Doc")

> **Lien avec le module** : Chapitre 6 — Vectorisation, recherche sémantique & RAG avancé
> **Partie II** : Ingestion de données pour l'IA & Architecture RAG
> **Prérequis** : Projet 4 (Pipeline ETL d'ingestion continue) — ce projet étend et consomme le moteur d'ingestion développé précédemment.

---

## 1. Résumé exécutif & Contexte pédagogique

Une entité d'entreprise, **Helvetia Consulting**, maintient un dépôt documentaire interne contenant environ **5 000 pages** (politiques RH, contrats juridiques standards, spécifications techniques et comptes rendus de réunions) réparties sous forme de fichiers PDF, DOCX et Markdown. Les collaborateurs perdent aujourd'hui un temps facturable considérable à rechercher manuellement des clauses spécifiques, des codes d'erreur et des procédures opérationnelles au sein de ce jeu de données non indexé.

L'objectif du Projet 5 est de livrer une **plateforme RAG (Retrieval-Augmented Generation) prête pour la production**, capable d'exécuter des requêtes en langage naturel sur ce corpus à grande échelle avec une précision déterministe. Le système doit respecter deux contraintes architecturales non négociables :

1. **La précision avant l'échelle** : La précision de la recherche et la pertinence du contexte doivent rester stables sur un jeu de données de 5 000 pages (~2,5 millions de tokens). Les recherches vectorielles pures, sans hybridation lexicale ni réordonnancement par *cross-encoder*, sont strictement interdites.
2. **Attribution obligatoire des sources** : Chaque affirmation factuelle générée par le système doit contenir une citation explicite et traçable pointant vers le nom exact du document et le numéro de page. Les réponses non vérifiées ou non citées sont classées comme des défaillances critiques du système, quelle que soit leur plausibilité apparente.

L'évaluation de ce projet se concentre principalement sur la **fiabilité du système, le rappel de la recherche et les garde-fous anti-hallucination**, plutôt que sur la finition de l'interface visuelle.

---

## 2. Périmètre fonctionnel

### 2.1 Exigences obligatoires (Indispensables / *Must-Have*)

| ID Exigence | Module | Description technique |
| --- | --- | --- |
| **FR-01** | Ingestion du corpus | Consommer les fichiers PDF, DOCX et Markdown via le pipeline du Projet 4 en utilisant un découpage structurel récursif (512 tokens max, 10 % de chevauchement) avec gestion des mises à jour différentielles. |
| **FR-02** | Indexation hybride | Persister une double représentation pour chaque fragment (*chunk*) : des embeddings vectoriels denses (via Qdrant ou `pgvector`) et des index lexicaux éparses (via BM25). |
| **FR-03** | Recherche hybride & Fusion | Exécuter en parallèle les recherches denses et éparces, puis fusionner les 50 meilleurs candidats de chaque voie à l'aide de la fusion par rang réciproque (RRF, $k=60$). |
| **FR-04** | Réordonnancement par *Cross-Encoder* | Acheminer les 30 candidats fusionnés retenus à travers un modèle *cross-encoder* (API Cohere Rerank ou FlashRank local ONNX) pour sélectionner les 5 meilleurs fragments destinés à l'injection de contexte. |
| **FR-05** | Génération ancrée | Transmettre les 5 fragments de contexte retenus au LLM aux côtés d'un prompt d'isolation strict qui restreint les réponses au contexte fourni. |
| **FR-06** | Moteur de citation obligatoire | Formater chaque affirmation factuelle avec une référence intégrée correspondant aux métadonnées de la source : `[Doc: <nom_fichier> | Page: <numéro_page>]`. |
| **FR-07** | Filtre de confiance & d'honnêteté | Intercepter les candidats récupérés avant la génération par le LLM. Si le score de réordonnancement le plus élevé tombe sous un seuil de confiance calibré ($S_{\text{min}} < 0{,}35$), ignorer la génération et renvoyer une réponse de refus standardisée : *"Je ne peux pas répondre à cette question sur la base de la documentation disponible."* |
| **FR-08** | Interface client interactive | Fournir une interface React + Vite gérant la saisie des requêtes, la génération de réponses en streaming et des tiroirs de citation cliquables affichant l'extrait de contexte original. |
| **FR-09** | Observabilité de la recherche | Exposer un point de terminaison `/api/v1/debug/retrieval` offrant une inspection complète des scores denses bruts, des scores BM25, des rangs RRF fusionnés et des poids du réordonnanceur pour n'importe quelle requête. |

### 2.2 Éléments hors périmètre

* Authentification unique (SSO) multi-locataire et contrôle d'accès basé sur les rôles (RBAC) — une autorisation basique par clé d'API est suffisante.
* Édition collaborative de documents en temps réel ou gestion de versions de documents WYSIWYG.
* Pipelines de traitement de la parole en texte (transcription audio/vidéo).
* Ajustement fin (*fine-tuning*) de modèles propriétaires (traité au chapitre 13).

---

## 3. Pile technologique

En alignement avec les exigences du programme principal :

| Composant | Choix standard de l'industrie |
| --- | --- |
| **Langage Backend** | Python 3.11+ |
| **Framework API** | FastAPI (ASGI, points de terminaison asynchrones) |
| **Gestion des dépendances** | Poetry |
| **Analyse de types** | Mypy en mode strict (`0` erreur autorisée) |
| **Linter & Formateur** | Ruff |
| **Tests & Couverture** | pytest avec `pytest-asyncio` ($\ge 80\%$ de couverture de code) |
| **Validation des données** | Pydantic V2 (`model_config = ConfigDict(frozen=True)` sur tous les DTO) |
| **Moteur vectoriel** | Qdrant **ou** PostgreSQL + `pgvector` (le choix doit être justifié dans le `README.md`) |
| **Moteur lexical** | `rank-bm25` ou vecteurs éparces natifs de Qdrant |
| **Moteur de réordonnancement** | FlashRank (*cross-encoder* local sur CPU) avec secours sur l'API Cohere Rerank |
| **Framework Frontend** | React 18+ avec Vite et TypeScript |
| **Conteneurisation** | Docker & `docker-compose` (orchestrant l'API, le stockage vectoriel et le client web) |

---

## 4. Architecture cible du système

```
┌─────────────────┐      ┌────────────────────┐      ┌───────────────────┐
│   Client Web    │─────>│     Cœur FastAPI   │─────>│ Stockage vectoriel│
│  (React / Vite) │<─────│    /api/v1/chat    │<─────│ (Qdrant/PGVector) │
└─────────────────┘      └────────────────────┘      └───────────────────┘
                                   │  ▲
                                   ▼  │
                         ┌────────────────────┐
                         │ Recherche hybride  │
                         │ Dense + BM25       │
                         │ + Fusion RRF       │
                         └────────────────────┘
                                   │
                                   ▼
                         ┌────────────────────┐
                         │   Réordonnanceur   │
                         │   Cross-Encoder    │
                         │ (FlashRank/Cohere) │
                         └────────────────────┘
                                   │
                                   ▼
                         ┌────────────────────┐
                         │Garde-fou confiance │
                         │ (Filtre S_min>=0.35)│
                         └────────────────────┘
                                   │
                                   ▼
                         ┌────────────────────┐
                         │    LLM Ancré       │
                         │+ Moteur de citation│
                         └────────────────────┘

```

### 4.1 Structure du code source (`/src`)

```text
src/
├── ingestion/           # Étendu à partir du Projet 4 (parseurs, découpeurs récursifs)
├── retrieval/
│   ├── vector_store.py  # Couche d'abstraction Qdrant / PGVector
│   ├── bm25_engine.py   # Indexeur et calculateur de score éparce (tokens)
│   ├── rrf_fusion.py    # Implémentation de la fusion par rang réciproque (RRF)
│   └── reranker.py      # Service d'inférence par cross-encoder
├── generation/
│   ├── grounding.py     # Évaluateur de score de confiance et garde-fou de refus
│   ├── prompts.py       # Modèles de prompts système isolés
│   └── citations.py     # Logique d'extraction et de validation des citations
├── api/
│   ├── routes/
│   │   ├── chat.py      # Points de terminaison principaux (requêtes et streaming SSE)
│   │   └── debug.py     # Routes d'inspection du pipeline (FR-09)
│   └── dependencies.py  # Authentification par clé d'API et injection de services
├── models/              # Schémas Pydantic V2 immuables (frozen=True)
└── core/
    ├── config.py        # Gestion de la configuration via pydantic-settings
    └── telemetry.py     # Instrumentation des métriques de latence et de recherche

```

---

## 5. Contrats d'API & Protocoles de données

### 5.1 Point de terminaison principal de requête : `POST /api/v1/chat`

#### Corps de la requête

```json
{
  "query": "Quel est le préavis obligatoire pour la résiliation d'un contrat selon les SLA standards ?",
  "conversation_id": "8f3c2a11-4e9b-4b2a-9e11-0a2b3c4d5e6f",
  "top_k": 5
}

```

#### Corps de la réponse

```json
{
  "answer": "Le SLA standard exige un préavis écrit de 30 jours calendaires avant la résiliation [Doc: enterprise_sla_2025.pdf | Page: 14]. En cas de violation urgente de la sécurité, la résiliation peut être exécutée immédiatement [Doc: security_policy_v2.pdf | Page: 3].",
  "citations": [
    {
      "file_name": "enterprise_sla_2025.pdf",
      "page_number": 14,
      "chunk_id": "c7a2b1d3-9e8f-4a5b-8c1d-2e3f4a5b6c7d",
      "excerpt": "Chacune des parties peut résilier le présent contrat en notifiant un préavis écrit d'au moins 30 jours calendaires...",
      "relevance_score": 0.892
    },
    {
      "file_name": "security_policy_v2.pdf",
      "page_number": 3,
      "chunk_id": "f1e2d3c4-b5a6-9788-7654-3210fedcba98",
      "excerpt": "En cas d'incident de sécurité critique avéré, une résiliation d'urgence du contrat peut être exécutée immédiatement...",
      "relevance_score": 0.814
    }
  ],
  "confidence_score": 0.892,
  "grounded": true,
  "latency_ms": 1180
}

```

*Note : Si `grounded` est évalué à `false`, le champ `answer` contient le message de refus standardisé, `citations` renvoie un tableau vide `[]`, et aucun appel n'est effectué au LLM génératif.*

---

### 5.2 Point de terminaison de diagnostic de recherche : `GET /api/v1/debug/retrieval`

#### Paramètres de la requête

`GET /api/v1/debug/retrieval?query=delai+de+preavis+resiliation&limit=10`

#### Corps de la réponse

```json
{
  "query": "delai de preavis resiliation",
  "dense_hits": [
    {"chunk_id": "c7a2b1d3", "score": 0.812, "rank": 1},
    {"chunk_id": "a9b8c7d6", "score": 0.745, "rank": 2}
  ],
  "sparse_hits": [
    {"chunk_id": "c7a2b1d3", "score": 14.82, "rank": 1},
    {"chunk_id": "e5f6g7h8", "score": 11.21, "rank": 2}
  ],
  "rrf_fused": [
    {"chunk_id": "c7a2b1d3", "rrf_score": 0.0327, "rank": 1}
  ],
  "final_reranked": [
    {"chunk_id": "c7a2b1d3", "cross_encoder_score": 0.892, "selected": true}
  ]
}

```

---

## 6. Implémentation du système

### 6.1 Moteur de recherche principal (`src/retrieval/engine.py`)

```python
import uuid
from typing import Any, Dict, List
from flashrank import Ranker, RerankRequest
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams
from rank_bm25 import BM25Okapi


class ProductionHybridEngine:
    def __init__(
        self,
        qdrant_host: str = "localhost",
        qdrant_port: int = 6333,
        confidence_threshold: float = 0.35,
    ) -> None:
        self.qdrant = QdrantClient(host=qdrant_host, port=qdrant_port)
        self.collection_name = "helvetia_docs"
        self.confidence_threshold = confidence_threshold
        self.bm25_corpus: List[Dict[str, Any]] = []
        self.bm25_model: BM25Okapi | None = None
        self.reranker = Ranker(model_name="ms-marco-MiniLM-L-6-v2")

        if not self.qdrant.collection_exists(self.collection_name):
            self.qdrant.create_collection(
                collection_name=self.collection_name,
                vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
            )

    def index_corpus(
        self, chunks: List[Dict[str, Any]], embeddings: List[List[float]]
    ) -> None:
        points: List[PointStruct] = []
        tokenized_corpus: List[List[str]] = []

        for chunk, vector in zip(chunks, embeddings, strict=True):
            point_id = str(uuid.uuid4())
            chunk["chunk_id"] = point_id

            points.append(
                PointStruct(id=point_id, vector=vector, payload=chunk)
            )
            self.bm25_corpus.append(chunk)
            tokenized_corpus.append(chunk["text"].lower().split())

        self.qdrant.upsert(collection_name=self.collection_name, points=points)
        self.bm25_model = BM25Okapi(tokenized_corpus)

    def _reciprocal_rank_fusion(
        self,
        dense_hits: List[Dict[str, Any]],
        sparse_hits: List[Dict[str, Any]],
        k: int = 60,
    ) -> List[Dict[str, Any]]:
        rrf_scores: Dict[str, float] = {}
        doc_map: Dict[str, Dict[str, Any]] = {}

        for rank, item in enumerate(dense_hits):
            doc_id = str(item["chunk_id"])
            doc_map[doc_id] = item
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + (1.0 / (k + rank + 1))

        for rank, item in enumerate(sparse_hits):
            doc_id = str(item["chunk_id"])
            doc_map[doc_id] = item
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + (1.0 / (k + rank + 1))

        sorted_ids = sorted(
            rrf_scores.keys(), key=lambda x: rrf_scores[x], reverse=True
        )
        return [doc_map[doc_id] for doc_id in sorted_ids]

    def search(
        self, query: str, query_vector: List[float], top_k: int = 5
    ) -> List[Dict[str, Any]]:
        # 1. Recherche vectorielle
        qdrant_res = self.qdrant.search(
            collection_name=self.collection_name,
            query_vector=query_vector,
            limit=50,
        )
        dense_hits = [hit.payload for hit in qdrant_res if hit.payload is not None]

        # 2. Recherche éparce
        sparse_hits: List[Dict[str, Any]] = []
        if self.bm25_model:
            tokens = query.lower().split()
            scores = self.bm25_model.get_scores(tokens)
            top_indices = sorted(
                range(len(scores)), key=lambda i: scores[i], reverse=True
            )[:50]
            sparse_hits = [
                self.bm25_corpus[i] for i in top_indices if scores[i] > 0
            ]

        # 3. Fusion RRF
        fused = self._reciprocal_rank_fusion(dense_hits, sparse_hits)
        if not fused:
            return []

        # 4. Réordonnancement par Cross-Encoder
        passages = [
            {"id": c["chunk_id"], "text": c["text"], "meta": c}
            for c in fused[:30]
        ]
        request = RerankRequest(query=query, passages=passages)
        reranked = self.reranker.rerank(request)

        # 5. Filtrage par seuil de confiance
        final_results: List[Dict[str, Any]] = []
        for item in reranked[:top_k]:
            if item["score"] >= self.confidence_threshold:
                meta = dict(item["meta"])
                meta["relevance_score"] = float(item["score"])
                final_results.append(meta)

        return final_results

```

---

### 6.2 Service de génération ancrée (`src/generation/engine.py`)

```python
from collections.abc import AsyncGenerator
from typing import Any, Dict, List
from openai import AsyncOpenAI

SYSTEM_PROMPT = """Vous êtes un assistant d'entreprise précis pour Helvetia Consulting.
Votre tâche est de répondre à la question de l'utilisateur STRICTEMENT en utilisant les blocs de contexte fournis ci-dessous.

RÈGLES STRICTES :
1. Basez votre réponse UNIQUEMENT sur des faits clairs directement mentionnés dans le contexte. N'utilisez PAS de connaissances externes ni de suppositions.
2. Si la réponse ne peut pas être entièrement déduite du contexte fourni, indiquez clairement : "Je ne peux pas répondre à cette question sur la base de la documentation disponible."
3. Pour CHAQUE affirmation factuelle dans votre réponse, ajoutez une citation intégrée faisant référence au fichier source et à la page en utilisant exactement ce format : [Doc: <nom_fichier> | Page: <numéro_page>].
"""

class GroundedGenerator:
    def __init__(self, api_key: str) -> None:
        self.client = AsyncOpenAI(api_key=api_key)

    def _format_context(self, contexts: List[Dict[str, Any]]) -> str:
        blocks = []
        for ctx in contexts:
            block = (
                f"Fichier Source : {ctx['file_name']}\n"
                f"Numéro de Page : {ctx['page_number']}\n"
                f"Contenu : {ctx['text']}\n"
                "---"
            )
            blocks.append(block)
        return "\n".join(blocks)

    async def generate_stream(
        self, query: str, contexts: List[Dict[str, Any]]
    ) -> AsyncGenerator[str, None]:
        if not contexts:
            yield "Je ne peux pas répondre à cette question sur la base de la documentation disponible."
            return

        context_str = self._format_context(contexts)
        prompt = f"INFORMATIONS DE CONTEXTE :\n{context_str}\n\nQUESTION UTILISATEUR : {query}"

        stream = await self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.0,
            stream=True,
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta

```

---

## 7. Métriques de qualité & Protocole de banc d'essai (*Benchmarking*)

Le projet étend le module `IngestionMonitor` du Projet 4 en introduisant un exécuteur **`RetrievalMonitor`**. Ce module évalue les performances de recherche par rapport à un jeu de données de référence versionné (`eval_dataset.jsonl`, contenant au minimum 50 paires question/réponse annotées, dont 10 requêtes hors corpus).

```
                     EXÉCUTEUR DE LA SUITE D'ÉVALUATION
                                       │
         ┌─────────────────────────────┴─────────────────────────────┐
         ▼                                                           ▼
[Tests d'intégration & Unitaires]                       [Banc d'essai hors ligne]
 ├── Limites de découpage (<=512 tokens)                 ├── Assertions métrique Precision@5
 ├── Vérification d'upsert vectoriel Qdrant              ├── Pipeline de fidélité RAGAS
 └── Réponses de refus du filtre de confiance            └── Matrice d'attribution des citations

```

### 7.1 Cibles quantitatives du banc d'essai

| Métrique | Calcul / Méthodologie | Seuil minimum |
| --- | --- | --- |
| `retrieval_precision_at_5` | Proportion de fragments pertinents parmi les 5 premiers récupérés | $\ge 0{,}75$ |
| `citation_accuracy` | Pourcentage de citations générées pointant vers des métadonnées de fragments valides | $= 1{,}00$ (Tolérance zéro) |
| `hallucination_rate` | Affirmations générées sans contexte d'appui (LLM-as-a-Judge) | $\le 0{,}05$ |
| `faithfulness_score` | Métrique d'alignement contexte-réponse du framework RAGAS | $\ge 0{,}85$ |
| `honesty_filter_precision` | Taux de refus correct sur les cas de test hors corpus | $\ge 0{,}90$ |
| `p95_latency_ms` | Temps d'exécution du pipeline de traitement de bout en bout | $\le 3000\text{ ms}$ |

---

## 8. Critères de rejet non négociables

Toute soumission déclenchant l'un des anti-patrons suivants sera automatiquement rejetée :

* ❌ **Citations de sources manquantes** : Générer des réponses factuelles sans balises de citation intégrées.
* ❌ **Citations fabriquées** : Générer des balises de citation pointant vers des noms de documents inexistants ou des numéros de page incorrects.
* ❌ **Filtre de confiance contourné** : Appeler le LLM génératif lorsque le score de pertinence de recherche est inférieur à $S_{\text{min}} = 0{,}35$.
* ❌ **Recherche à voie unique** : Implémenter des recherches vectorielles pures sans recherche lexicale éparce BM25.
* ❌ **Étape de réordonnancement manquante** : Transmettre directement les premiers résultats vectoriels dans le contexte du prompt sans réordonnancement par *cross-encoder*.
* ❌ **Modèles DTO mutables** : Modèles Pydantic définis sans `model_config = ConfigDict(frozen=True)`.
* ❌ **Couverture de tests insuffisante** : Couverture de code en ligne inférieure à $80\%$.
* ❌ **Erreurs de type non résolues** : Toute erreur de type statique détectée sous `mypy --strict`.

---

## 9. Livrables & Liste de contrôle pour la soumission

1. **Code source** : Codebases backend (`/src`) et frontend (`/frontend`) complètes passant les vérifications strictes de linter et de typage.
2. **Conteneurisation** : Fichier `docker-compose.yml` fonctionnel déployant les services FastAPI, Qdrant et React.
3. **Jeu de données d'évaluation** : Fichier `eval_dataset.jsonl` contenant $\ge 50$ triplets de requêtes annotés manuellement.
4. **Rapport de banc d'essai** : Rapport de métriques automatisé (`retrieval_report.md`) généré par `RetrievalMonitor`.
5. **Documentation architecturale** : Fichier `README.md` contenant les justifications du choix de la base vectorielle (Qdrant vs. `pgvector`), la méthodologie de calibration du score de confiance et les instructions de déploiement local.
6. **Suite de tests automatisés** : Suite `pytest` complète ($\ge 80\%$ de couverture de code) incluant des tests unitaires pour la fusion RRF, le filtre de confiance, ainsi qu'une exécution simulée (*mock*) de bout en bout de `/api/v1/chat`.