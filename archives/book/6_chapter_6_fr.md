# Chapitre 6 : Vectorisation, recherche sémantique & RAG avancé

> **Partie II — Ingestion de données pour l'IA & Architecture RAG**
> *Prérequis : Chapitre 5 (Ingestion & ETL continu). Ce chapitre suppose que vos documents sont déjà nettoyés, découpés en fragments (chunks) et prêts à être transformés en objets manipulables par des machines.*

---

## Introduction : De la donnée textuelle à la connaissance exploitable

Au chapitre 5, vous avez appris à segmenter un corpus hétérogène en fragments de texte cohérents (`chunks`). Cependant, un fragment de texte brut reste une simple séquence de caractères sans signification explicite pour un ordinateur. Deux phrases peuvent traiter exactement du même sujet tout en utilisant des vocabulaires totalement différents ; à l'inverse, deux phrases peuvent partager de nombreux mots tout en couvrant des sujets sans aucun rapport.

L'objectif de ce chapitre est de combler cet écart : transformer le texte en représentations numériques qui capturent son *sens sémantique*, construire une infrastructure de recherche capable d'interroger des millions de ces représentations en quelques millisecondes, et les combiner intelligemment pour concevoir un système RAG (*Retrieval-Augmented Generation*) prêt pour la production.

---

## 6.1 Comprendre les embeddings

### 6.1.1 Qu'est-ce qu'un embedding ?

Un **embedding** (ou plongement vectoriel) est la projection d'un objet (mot, phrase, paragraphe, image) dans un espace vectoriel à haute dimension (généralement entre 384 et 3072 dimensions, selon le modèle), où la *proximité géométrique* entre deux vecteurs reflète leur *proximité sémantique*.

Concrètement, un modèle d'embedding (tel que `text-embedding-3-large` d'OpenAI, `voyage-3` de Voyage AI, ou des modèles open-source comme `bge-m3`) transforme du texte :

```
"Le chat dort sur le canapé"

```

en un vecteur de nombres à virgule flottante :

```
[0.0123, -0.0456, 0.0789, ..., 0.0234]  # 1536 dimensions

```

Deux phrases sémantiquement similaires — même si elles ne partagent aucun mot en commun — produiront des vecteurs proches dans cet espace latent. Cette propriété permet à une requête portant sur `"félin assoupi"` de retrouver avec succès un document contenant `"Le chat dort sur le canapé"`, là où une recherche par mots-clés traditionnelle échouerait.

---

### 6.1.2 Calculer la similitude sémantique

Une fois les fragments de texte projetés sous forme de vecteurs, leur proximité est mesurée à l'aide de métriques vectorielles. Trois fonctions principales dominent l'industrie :

```
   Similitude cosinus                 Produit scalaire              Distance euclidienne (L2)
 (Axe axé sur l'angle)            (Angle + Magnitude)            (Axe axé sur la distance)

        d_1                             d_1                                  d_1
       /                               /                                    / |
      / θ                             /                                    /  |
     /____ q                         /____ q                              /___| q
    0                               0                                    0     d(q, d_1)

```

#### Similitude cosinus (*Cosine Similarity*)

Mesure le cosinus de l'angle $\theta$ entre deux vecteurs, en ignorant leur magnitude. Elle produit un score normalisé entre -1 et 1 (ou de 0 à 1 pour les vecteurs à valeurs non négatives). Elle est très utilisée en RAG car elle reste robuste face aux variations de longueur des fragments.

$$\text{cosinus}(\mathbf{q}, \mathbf{d}) = \frac{\mathbf{q} \cdot \mathbf{d}}{\Vert{}\mathbf{q}\Vert{} \Vert{}\mathbf{d}\Vert{}} = \frac{\sum_{i=1}^{n} q_i d_i}{\sqrt{\sum_{i=1}^{n} q_i^2} \sqrt{\sum_{i=1}^{n} d_i^2}}$$

#### Produit scalaire (*Dot Product / Inner Product*)

Calcule la somme des produits terme à terme. Il prend en compte à la fois l'angle et la magnitude.

$$\text{produit\_scalaire}(\mathbf{q}, \mathbf{d}) = \mathbf{q} \cdot \mathbf{d} = \sum_{i=1}^{n} q_i d_i$$

Si les vecteurs sont pré-normalisés à une norme unitaire ($\Vert{}\mathbf{q}\Vert{} = \Vert{}\mathbf{d}\Vert{} = 1$), le produit scalaire est mathématiquement identique à la similitude cosinus. Calculer le produit scalaire sur des vecteurs pré-normalisés élimine les opérations de racine carrée et de division requises pour calculer les normes vectorielles lors de la requête, ce qui accélère considérablement l'exécution.

#### Distance euclidienne (Distance $L_2$)

Mesure la distance en ligne droite entre deux points dans l'espace vectoriel.

$$d(\mathbf{q}, \mathbf{d}) = \sqrt{\sum_{i=1}^{n} (q_i - d_i)^2}$$

```python
import numpy as np

def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

def dot_product(a: np.ndarray, b: np.ndarray) -> float:
    return np.dot(a, b)

```

> **Anti-patron critique** : Ne mélangez jamais dans un même espace vectoriel des embeddings générés par deux modèles différents (par exemple `text-embedding-ada-002` et `text-embedding-3-small`). Les espaces vectoriels sont incompatibles d'un modèle à l'autre — un score de similitude calculé entre des vecteurs issus de modèles différents n'a aucune valeur mathématique. Migrer vers un nouveau modèle d'embedding nécessite de réindexer l'intégralité de votre corpus.

---

### 6.1.3 Sélectionner un modèle d'embedding

| Critère | Impact |
| --- | --- |
| **Dimensionnalité** | Des dimensions plus élevées capturent des nuances sémantiques plus fines, mais augmentent l'utilisation de la mémoire, les coûts de stockage et la latence de recherche. |
| **Support linguistique** | Les modèles entraînés principalement en anglais se dégradent lorsqu'ils traitent des textes non anglophones. Utilisez des modèles multilingues (`bge-m3`, `text-embedding-3-large`) pour les corpus multilingues. |
| **Fenêtre de contexte** | Détermine la capacité maximale en tokens par fragment (généralement 512, 512 à 8192, ou 32k tokens). |
| **Coût & Latence** | Les coûts des API commerciales évoluent en fonction du nombre de tokens. Les modèles open-source hébergés sur site ou auto-hébergés engendrent des coûts d'infrastructure de calcul à la place. |

---

## 6.2 Les bases de données vectorielles en production

Stocker des millions de vecteurs dans une simple liste Python et calculer la similitude cosinus de manière itérative fonctionne pour des prototypes locaux, mais échoue en production : une recherche linéaire standard évolue en $\mathcal{O}(N \cdot d)$, introduisant une latence inacceptable au fur et à mesure que le jeu de données grandit.

Les bases de données vectorielles résolvent ce problème en utilisant des algorithmes d'indexation par **Plus Proches Voisins Approximatifs (ANN - *Approximate Nearest Neighbor*)**. Les algorithmes ANN concèdent une marginale baisse de précision (rappel) en échange de vitesses de récupération inférieures à 100 millisecondes sur des millions d'enregistrements.

---

### 6.2.1 Mécanismes d'indexation : HNSW vs. IVF

```
        IVF (Inverted File Index)                   HNSW (Hierarchical Navigable Small World)
┌───────────────────────────────────────┐         Couche 2: [Nœud A] ------------------> [Nœud B]
│ Cluster 1   Cluster 2   Cluster 3     │                   |                             |
│  •  •        •   •       •   •        │         Couche 1: [Nœud A] ----> [Nœud C] ----> [Nœud B]
│   c1          c2          c3          │                   |            |            |
│  •  •        •   •       •   •        │         Couche 0: [Nœud A]-[Nœud D]-[Nœud C]-[Nœud E]-[Nœud B]
└───────────────────────────────────────┘                   (Graphe dense connectant tous les vecteurs)
  1. Associer la requête au centroïde le plus proche (c2).
  2. Chercher UNIQUEMENT dans le Cluster 2.

```

* **IVF (Index à fichier inversé)** : Partitionne l'espace vectoriel en clusters en utilisant l'algorithme des k-moyennes (*k-means*). Lors d'une requête, le moteur identifie les centroïdes de clusters les plus proches et ne recherche que les vecteurs assignés à ces clusters.
* **HNSW (Graphe hiérarchique de petits mondes navigables)** : Construit un graphe multicouche dans lequel les couches supérieures contiennent des connexions éparses à longue portée pour un routage rapide, et les couches inférieures contiennent des connexions denses et localisées. HNSW offre une vitesse de recherche et un rappel élevés, au prix d'une consommation de mémoire RAM plus importante lors de la construction de l'index.

---

### 6.2.2 Qdrant

Qdrant est une base de données vectorielle dédiée écrite en Rust, conçue spécifiquement pour les systèmes d'IA en production. Elle expose des points de terminaison gRPC/REST ainsi qu'un SDK Python de haut niveau.

```python
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct

client = QdrantClient(url="http://localhost:6333")

# Création de la collection
client.create_collection(
    collection_name="enterprise_knowledge",
    vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
)

# Insertion d'un fragment vectorisé
client.upsert(
    collection_name="enterprise_knowledge",
    points=[
        PointStruct(
            id=1,
            vector=embedding_vector,  # Liste de 1536 flottants
            payload={
                "text": "Le basculement automatique de la base de données principale se déclenche après 30 secondes.",
                "source": "infrastructure_doc.md",
                "tenant_id": "tenant_9941",
            },
        )
    ],
)

# Requête sémantique avec filtrage par métadonnées
results = client.search(
    collection_name="enterprise_knowledge",
    query_vector=query_embedding,
    limit=5,
    query_filter={
        "must": [
            {"key": "tenant_id", "match": {"value": "tenant_9941"}}
        ]
    },
)

```

Le **filtrage par métadonnées** (*payload filtering*) permet au système de restreindre la recherche vectorielle à des conditions spécifiques sur les métadonnées (ex. contraintes multi-locataires, permissions, dates de création) dès la phase de parcours de l'index, sans dégrader les performances de la requête.

---

### 6.2.3 PGVector (Extension PostgreSQL)

`pgvector` ajoute la capacité de stockage et de recherche vectorielle directement dans PostgreSQL, permettant aux équipes de conserver leurs opérations vectorielles au sein de leur base de données relationnelle existante.

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE document_chunks (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    embedding VECTOR(1536),
    source VARCHAR(255),
    tenant_id VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Construction d'un index HNSW pour accélérer la recherche
CREATE INDEX ON document_chunks
USING hnsw (embedding vector_cosine_ops);

-- Requête de similitude à l'aide de la distance cosinus (opérateur <=>)
SELECT content, source, 1 - (embedding <=> :query_vector) AS similarity
FROM document_chunks
WHERE tenant_id = 'tenant_9941'
ORDER BY embedding <=> :query_vector
LIMIT 5;

```

L'opérateur `<=>` calcule la distance cosinus directement en SQL. Cette approche permet aux développeurs d'écrire des jointures relationnelles entre les utilisateurs, les permissions et les données vectorielles au sein de transactions ACID uniques.

---

### 6.2.4 Choix de l'architecture : BDD vectorielle dédiée vs Extension relationnelle

| Critère | BDD vectorielle dédiée (Qdrant) | Extension relationnelle (PGVector) |
| --- | --- | --- |
| **Performance à grande échelle (>10M de vecteurs)** | Haut débit, gestion de la mémoire optimisée | Nécessite un ajustement fin des ressources et du matériel |
| **Coût opérationnel** | Nécessite la gestion d'un service d'infrastructure distinct | S'appuie sur la configuration PostgreSQL et les procédures de sauvegarde existantes |
| **Intégrité relationnelle** | Non native ; nécessite une synchronisation entre les deux stocks de données | Conformité ACID native et opérations de jointure (`JOIN`) relationnelles |
| **Filtrage par métadonnées** | Indexation native des données associées (*payloads*) dans les graphes vectoriels | Filtrage relationnel (`WHERE`) exécuté avant ou conjointement aux opérateurs vectoriels |

---

## 6.3 Recherche hybride : Combiner recherche lexicale & sémantique

### 6.3.1 Limites de la recherche sémantique pure

La recherche vectorielle dense capture l'intention et le contexte sémantique global, mais peut rencontrer des difficultés avec :

* Les identifiants alphanumériques exacts, les codes d'erreur et les références produits (SKU) (ex. `ERR_504_BAD_GATEWAY`, `PART-8831`).
* Le jargon métier spécifique et les acronymes rares peu représentés dans le jeu d'entraînement du modèle d'embedding.
* Les noms propres rares et les entités nommées très spécifiques.

Pour traiter ces cas limites, les architectures de recherche en production combinent la recherche vectorielle dense avec la recherche textuelle/lexicale éparce (par mots-clés).

---

### 6.3.2 Recherche lexicale avec BM25

**BM25** (*Best Matching 25*) est un algorithme de classement par correspondance de termes qui évalue la pertinence des documents en fonction de la présence des mots de la requête. Il améliore le TF-IDF traditionnel en intégrant une saturation de la fréquence des termes et une normalisation selon la longueur du document :

```python
from rank_bm25 import BM25Okapi

corpus_tokenized = [doc.split() for doc in corpus]
bm25 = BM25Okapi(corpus_tokenized)

query = "ERR_504_BAD_GATEWAY database timeout"
scores = bm25.get_scores(query.split())

```

---

### 6.3.3 Fusion des résultats : Fusion par rang réciproque (RRF)

La recherche éparce (BM25) renvoie des scores non bornés tandis que la recherche dense renvoie des métriques de similitude bornées (ex. de 0.0 à 1.0) ; leurs scores bruts ne peuvent donc pas être additionnés directement.

La **fusion par rang réciproque (RRF - *Reciprocal Rank Fusion*)** combine les listes de candidats en évaluant la position relative (rang) de chaque document dans les différents systèmes de recherche, contournant ainsi le problème de normalisation des scores :

$$\text{Score\_RRF}(d \in D) = \sum_{m \in M} \frac{1}{k + r_m(d)}$$

Où :

* $M$ est l'ensemble des systèmes de recherche (ex. $\{\text{BM25}, \text{Vecteur Dense}\}$).
* $r_m(d)$ est le rang (commençant à 1) du document $d$ dans le système $m$.
* $k$ est une constante de lissage (la valeur standard par défaut est 60).

```python
def reciprocal_rank_fusion(
    vector_results: list[str],
    bm25_results: list[str],
    k: int = 60,
) -> list[str]:
    scores: dict[str, float] = {}

    for rank, doc_id in enumerate(vector_results):
        scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank + 1)

    for rank, doc_id in enumerate(bm25_results):
        scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank + 1)

    return sorted(scores, key=scores.get, reverse=True)

```

---

### 6.3.4 Filtrage de second niveau : Le réordonnancement (*Re-Ranking*)

Les calculs de similitude vectorielle utilisent des **bi-encodeurs**, qui traitent les vecteurs de requête et de document indépendamment afin de permettre des recherches indexées rapides. Cependant, ce calcul indépendant passe à côté des relations fines de token à token entre la requête et le passage de texte.

Un **réordonnanceur** (*re-ranker* ou *cross-encoder*) traite la requête et le passage de texte simultanément à travers un modèle transformeur, évaluant l'attention conjointe entre les tokens de la paire pour produire un score de pertinence affiné.

```
Requête utilisateur : "Corriger ERR_502_BAD_GATEWAY en production"
   │
   ├───> Recherche éparce (BM25 par mots-clés) ──> Top 50 Docs ──┐
   │                                                             │
   └───> Recherche dense (Cosinus vectoriel)   ──> Top 50 Docs ──┴─> Résultats fusionnés (100)
                                                                           │
                                                                           ▼
                                                              [ Fusion par rang réciproque ]
                                                                           │
                                                                           ▼
                                                              Top 20 candidats classés
                                                                           │
                                                                           ▼
                                                              [ Réordonnanceur Cross-Encoder ]
                                                                (Cohere / FlashRank / BGE)
                                                                           │
                                                                           ▼
                                                              Top 5 contextes précis
                                                                           │
                                                                           ▼
                                                                 Injection dans le prompt

```

Les stratégies de réordonnancement incluent :

* **Cohere Rerank** : Une API gérée fournissant des modèles *cross-encoder* entraînés pour l'évaluation de documents multilingues.
* **FlashRank** : Une bibliothèque locale légère exécutant des modèles *cross-encoder* optimisés au format ONNX directement sur CPU, évitant ainsi la latence réseau externe.

```python
from flashrank import Ranker, RerankRequest

ranker = Ranker(model_name="ms-marco-MiniLM-L-12-v2")

rerank_request = RerankRequest(
    query="Comment configurer le délai d'expiration (timeout) du pipeline d'ingestion ?",
    passages=[{"text": doc} for doc in top_k_candidates],
)

reranked_results = ranker.rerank(rerank_request)
final_context = reranked_results[:5]

```

**Architecture en entonnoir à deux niveaux** : Récupérer d'abord un ensemble élargi de fragments candidats (ex. Top 30–50) à l'aide d'une recherche hybride peu coûteuse, puis passer ces candidats dans un *cross-encoder* pour sélectionner les fragments finaux (ex. Top 3–5) qui seront injectés dans le prompt.

---

## 6.4 Atténuer les hallucinations : L'ancrage strict (*Strict Grounding*)

### 6.4.1 Mécanismes des hallucinations liées au contexte

Les pipelines RAG injectent le contexte récupéré dans le prompt du modèle afin de réduire les générations incorrectes. Cependant, des réponses hallucinées peuvent toujours survenir en raison de :

* **Lacunes de récupération** : La phase de recherche ne parvient pas à faire remonter les passages de contexte nécessaires.
* **Sur-reliance à la mémoire paramétrique** : Le LLM s'appuie sur ses poids internes pré-entraînés au lieu de limiter sa réponse aux blocs de contexte fournis.
* **Ambiguïté des consignes** : Les prompts système manquent de règles strictes imposant l'isolation du contexte.

---

### 6.4.2 Conception de prompts système pour un RAG ancré

Pour conserver des réponses strictement ancrées dans les documents, utilisez des prompts système qui isolent explicitement l'espace de connaissances du modèle :

```
Vous êtes un assistant technique précis. Votre tâche est de répondre à la question de 
l'utilisateur STRICTEMENT en utilisant les blocs de contexte fournis ci-dessous.

RÈGLES :
1. Fondez-vous UNIQUEMENT sur les faits clairs directement mentionnés dans le contexte. 
   N'utilisez PAS de connaissances externes, n'extrapolez pas et ne faites aucune supposition.
2. Si la réponse ne peut pas être entièrement déduite du contexte fourni, indiquez : 
   "Je ne dispose pas d'informations suffisantes dans la documentation fournie pour répondre à cette question."
3. Pour chaque affirmation factuelle dans votre réponse, ajoutez une citation entre crochets 
   faisant référence à l'ID de la source correspondante, ex. [Doc-123].

[BLOCS DE CONTEXTE]
---
ID Source : Doc-881
Contenu : Le basculement automatique du cluster de base de données principale se déclenche lorsque les signaux de vie (heartbeats) des nœuds échouent pendant plus de 30 secondes consécutives.
---
ID Source : Doc-904
Contenu : Les basculements manuels peuvent être initiés via la CLI interne en utilisant la commande `db-admin failover --force`.

[QUESTION UTILISATEUR]
Quel est le délai d'expiration par défaut pour le basculement automatique de la base de données, et comment le configurer dans l'interface Web ?

```

---

### 6.4.3 Évaluation de la confiance & filtres d'honnêteté

En plus des contraintes imposées au niveau du prompt, les systèmes en production appliquent des contrôles de seuil programmatiques avant d'appeler le LLM génératif. Si le score du document le mieux classé lors de la recherche ou du réordonnancement tombe en dessous d'un seuil de pertinence calibré, le flux d'exécution court-circuites la génération et renvoie directement une réponse par défaut.

```python
CONFIDENCE_THRESHOLD = 0.75

def validate_retrieval_confidence(top_score: float) -> bool:
    return top_score >= CONFIDENCE_THRESHOLD

if not validate_retrieval_confidence(reranked_results[0]["score"]):
    return "Je ne dispose pas d'informations suffisantes dans la documentation vérifiée pour répondre à cette question."

```

*Note : Les seuils de pertinence doivent être calibrés empiriquement sur des jeux de données de test spécifiques au domaine métier, en analysant la distribution des scores sur des paires requête-document connues comme de vrais ou faux positifs.*

---

## Résumé du chapitre

| Composant | Rôle dans le pipeline RAG |
| --- | --- |
| **Modèle d'embedding** | Convertit les fragments de texte brut en vecteurs denses continus capturant leur sens sémantique. |
| **Cosinus / Produit scalaire** | Fonctions de distance mathématiques utilisées pour scorer la similitude entre vecteurs. |
| **Qdrant / PGVector** | Systèmes de bases de données conçus pour stocker, indexer (via HNSW/IVF) et filtrer des vecteurs à haute dimension à grande échelle. |
| **Recherche BM25** | Stratégie de recherche lexicale éparce qui fait correspondre les mots-clés exacts, codes produits et termes rares. |
| **Fusion par rang réciproque (RRF)** | Combine les listes de résultats classées issues de la recherche éparce et dense sans nécessiter de normaliser leurs scores bruts. |
| **Réordonnancement (*Cross-Encoders*)** | Évalue l'attention conjointe sur les passages candidats afin d'affiner la liste de recherche pour ne conserver que les contextes les plus pertinents. |
| **Ancrage strict & Seuils** | Prompts et vérifications programmatiques de score visant à empêcher les générations hors contexte et à imposer la citation des sources. |