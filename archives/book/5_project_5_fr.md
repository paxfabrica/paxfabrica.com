# Projet 4 — Pipeline Automatisé d'Ingestion de Documents & Audit de Perte d'Information

*Spécifications Techniques et Blueprint de Réalisation*

**Rattaché au Chapitre 5 :** Data Ingestion & Continuous ETL Pipelines

**Partie II :** Data Engineering for AI & RAG Architecture

**Livrables :** CLI Production-Ready (`ingest`), Module Python typé, Suite de tests `pytest`, Corpus de test synthétique et Rapport d'audit de qualité (`rapport_ingestion.json`)

**Stack Technique Exigée :** Python 3.11+, Poetry, Pydantic V2 (mode strict), Tiktoken, Rich, Structlog, Pytest, Mypy (`--strict`), Ruff.

---

## 1. Vision Produit & Objectif Pédagogique

Un système RAG (Retrieval-Augmented Generation) échoue rarement au niveau du modèle de langage ou de la base vectorielle : **il échoue à la frontière d'ingestion**. Un pipeline d'ingestion qui tronque silencieusement des tableaux Markdown, découpe des clauses contractuelles au milieu d'une phrase ou élimine $8\%$ du texte source lors d'un nettoyage trop agressif détruit la qualité du système en aval avant même la moindre étape de vectorisation.

Ce projet fait passer l'apprenant d'un "script de découpage de texte" à un **module d'ingestion qualitatif, typé, testé et audité**.

### L'Exigence Clé : Le Monitoring de la Perte d'Information

La contrainte centrale de ce projet est l'implémentation obligatoire d'un **IngestionMonitor** indépendant. Le pipeline ne doit pas seulement générer des chunks : il doit **mesurer, quantifier et journaliser la perte d'information et les ruptures structurelles** pour chaque document traité.

```
                                  CORPUS EN ENTRÉE
                         (Fichiers .txt / .md volumineux)
                                         │
                                         ▼
                                STAGE 1: LOADERS
                 (Extensible: TextLoader / MarkdownLoader / [PDFLoader])
                                         │
                                         ▼
                                STAGE 2: CLEANING
             (Normalisation NFKC, Regex, Stripping Boilerplate répétitif)
                                         │
                                         ▼
                               STAGE 3: CHUNKING
                  (Strategy Pattern: FixedOverlap vs Recursive)
                                         │
                                         ▼
                          STAGE 4: AUDIT & MONITORING
             (Ratios de rétention, Orphelins de tableaux, Dérive de Tokens)
                                         │
                                         ▼
                             STAGE 5: SERIALIZATION
            (Chunks JSONL + Rapport global + Rendu Console Rich)

```

---

## 2. Périmètre Fonctionnel & Spécifications Métier

### 2.1 Ingestion & Discovery (`Loader`)

* **Formats supportés (Périmètre strict) :** Plaintext (`.txt`) et Markdown (`.md`). L'architecture doit toutefois exposer une interface d'extraction abstraite (`DocumentLoader`) permettant de brancher ultérieurement un loader PDF/PPTX sans modifier le pipeline en aval.
* **Gestion des grands volumes :** Le pipeline doit pouvoir traiter des fichiers volumineux (plusieurs dizaines de milliers de tokens) sans surcharger la mémoire (chargement en flux / streaming au-delà d'un seuil configurable, par défaut 10 Mo).
* **Identité déterministe :** Chaque document est identifié par un `document_id` stable basé sur le hash cryptographique `SHA-256` de son contenu source initial combiné à son chemin relatif.

### 2.2 Cleaning & Normalisation (`Cleaner`)

Le module de nettoyage applique une séquence de transformations déterministes :

1. **Normalisation Unicode :** Application stricte du standard `NFKC` via `unicodedata`.
2. **Standardisation des espaces :** Conversion des espaces insécables, tabulations et suppression des sauts de ligne excessifs (plafonné à 2 `\n` consécutifs pour préserver les paragraphes).
3. **Déduplication du Boilerplate Récurrent :** Détection et suppression des lignes (en-têtes, pieds de page) répétés à l'identique sur plus de $N$ occurrences à travers le corpus ($N$ configurable, par défaut $N=3$).
4. **Sanctuaire des Blocs Structurés :** **Règle absolue :** Les tableaux Markdown (lignes commençant par `|`) et les blocs de code (encadrés par `````) ne doivent **jamais** être altérés par la normalisation des espaces ou découpés par la passe de nettoyage.

### 2.3 Segmentation Configurable (`Chunker`)

Implémentation stricte du **Strategy Pattern** via une classe abstraite `ChunkingStrategy`. Les implémentations reçoivent leurs paramètres par **injection au constructeur** (jamais en dur) :

1. **`FixedSizeChunker` :** Découpage par fenêtre glissante basée sur les tokens réels (calculés via `tiktoken`, encodage `cl100k_base` / `gpt-4o`). Supporte un chevauchement (`overlap`) paramétrable en tokens.
2. **`RecursiveStructuralChunker` :** Découpage respectant la hiérarchie sémantique du texte. Il tente successivement de séparer selon la hiérarchie :
* Titres Markdown (`\n# `, `\n## `, `\n### `)
* Paragraphes (`\n\n`)
* Lignes (`\n`)
* Phrases (`. `)
* Mots (` `)
Si un bloc dépasse la taille cible (`chunk_size`), la stratégie descend récursivement au niveau de séparateur inférieur.



### 2.4 Monitoring & Audit de Perte d'Information (`IngestionMonitor`)

C'est le module de contrôle qualité automatisé. Pour chaque document, l'auditeur calcule :

| Métrique | Formule / Définition | Seuil d'Alerte Suggeré |
| --- | --- | --- |
| `char_coverage_ratio` | $\frac{\text{Somme des caractères uniques couverte par au moins un chunk}}{\text{Nombre de caractères du texte nettoyé}}$ | $< 0.98$ $\rightarrow$ **Warning** |
| `duplicate_char_ratio` | Proportion de caractères dupliqués hors overlap configuré | $> \text{overlap} + 5\%$ $\rightarrow$ **Warning** |
| `orphan_blocks` | Nombre de structures (tableaux Markdown, blocs de code) coupées au milieu par une frontière de chunk | $> 0$ $\rightarrow$ **Alerte Bloquante (Error)** |
| `token_count_delta` | $\text{Tokens Source Nettoyés} - (\sum \text{Tokens Chunks} - \text{Tokens Overlap})$ | Doit être proche de $0$ |
| `undersized_chunks_ratio` | Proportion de chunks dont la taille est $< \text{min\_chunk\_size}$ | Informatif |
| `processing_errors` | Exceptions levées durant la lecture/parsing du document | $> 0$ $\rightarrow$ **Alerte Bloquante (Error)** |

---

## 3. Architecture Logicielle & Modèles de Données

### 3.1 Structure du Projet (Conforme Standard Part II)

```text
ingestion_pipeline/
├── src/
│   └── ingestion/
│       ├── __init__.py
│       ├── cli.py              # Entrypoint Typer/Click avec rendu Rich
│       ├── models.py           # Modèles Pydantic V2 (Chunk, Reports, Config)
│       ├── loaders.py          # Interface DocumentLoader & implémentations Text/Markdown
│       ├── cleaner.py          # TextCleaner (NFKC, boilerplate, preservation)
│       ├── chunkers.py         # Strategy Pattern (FixedSize, RecursiveStructural)
│       ├── monitor.py          # IngestionMonitor & calcul d'audit de perte
│       └── pipeline.py         # Orchestrateur global (Pipeline execution)
├── tests/
│   ├── unit/
│   │   ├── test_cleaner.py
│   │   ├── test_chunkers.py
│   │   ├── test_loaders.py
│   │   └── test_monitor.py
│   ├── integration/
│   │   └── test_pipeline.py
│   └── fixtures/               # Corpus synthétique de test (.md, .txt)
├── data/
│   ├── input/
│   └── output/
├── pyproject.toml              # Configuration Poetry, Mypy strict, Ruff
├── README.md                   # Documentation & Analyse comparative des stratégies
└── rapport_ingestion.json      # Exemple de livrable d'audit

```

---

### 3.2 Schemas & Data Models (`src/ingestion/models.py`)

```python
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

class StrategyType(str, Enum):
    FIXED = "fixed"
    RECURSIVE = "recursive"

class ChunkMetadata(BaseModel):
    chunk_index: int
    start_char: int
    end_char: int
    token_count: int
    has_table: bool = False
    has_code_block: bool = False
    section_hierarchy: List[str] = Field(default_factory=list)

class Chunk(BaseModel):
    id: str
    document_id: str
    content: str
    start_char: int
    end_char: int
    token_count: int
    metadata: Dict[str, Any] = Field(default_factory=dict)

class DocumentReport(BaseModel):
    document_id: str
    source_path: str
    char_coverage_ratio: float
    duplicate_char_ratio: float
    orphan_blocks: int
    token_count_delta: int
    undersized_chunks_ratio: float
    chunk_count: int
    status: str  # "ok" | "warning" | "error"
    errors: List[str] = Field(default_factory=list)

class IngestionReport(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)
    
    corpus_path: str
    strategy_used: str
    execution_timestamp: datetime = Field(default_factory=datetime.utcnow)
    documents: List[DocumentReport]
    total_chunks: int
    global_char_coverage_ratio: float
    documents_in_error: int
    has_blocking_alerts: bool

```

---

### 3.3 Abstraction des Loaders (`src/ingestion/loaders.py`)

```python
from abc import ABC, abstractmethod
import hashlib
from pathlib import Path
from pydantic import BaseModel

class LoadedDocument(BaseModel):
    document_id: str
    source_path: Path
    raw_content: str
    file_size_bytes: int

class DocumentLoader(ABC):
    @abstractmethod
    def load(self, file_path: Path) -> LoadedDocument:
        """Charge un fichier et retourne un LoadedDocument typé."""
        pass

class TextMarkdownLoader(DocumentLoader):
    def load(self, file_path: Path) -> LoadedDocument:
        if not file_path.exists():
            raise FileNotFoundError(f"Fichier introuvable : {file_path}")
        
        try:
            content = file_path.read_text(encoding="utf-8")
        except UnicodeDecodeError as e:
            raise ValueError(f"Encodage invalide pour {file_path} : {e}")
            
        doc_id = hashlib.sha256(f"{file_path.name}_{len(content)}".encode()).hexdigest()[:16]
        return LoadedDocument(
            document_id=doc_id,
            source_path=file_path,
            raw_content=content,
            file_size_bytes=file_path.stat().st_size
        )

```

---

### 3.4 Interface du Strategy Pattern (`src/ingestion/chunkers.py`)

```python
from abc import ABC, abstractmethod
import tiktoken
from src.ingestion.models import Chunk

class ChunkingStrategy(ABC):
    def __init__(self, chunk_size: int = 512, overlap: int = 0, min_chunk_size: int = 20, model_name: str = "gpt-4o"):
        self.chunk_size = chunk_size
        self.overlap = overlap
        self.min_chunk_size = min_chunk_size
        self.tokenizer = tiktoken.encoding_for_model(model_name)

    def count_tokens(self, text: str) -> int:
        return len(self.tokenizer.encode(text))

    @abstractmethod
    def chunk(self, text: str, document_id: str) -> list[Chunk]:
        """Découpe un texte en chunks de manière pure et déterministe."""
        pass

```

---

### 3.5 Ingestion Monitor & Loss Audit (`src/ingestion/monitor.py`)

```python
import re
from src.ingestion.models import Chunk, DocumentReport

class IngestionMonitor:
    def __init__(self, min_chunk_size: int = 20, max_overlap_tolerance: float = 0.05):
        self.min_chunk_size = min_chunk_size
        self.max_overlap_tolerance = max_overlap_tolerance

    def _detect_orphan_blocks(self, cleaned_text: str, chunks: list[Chunk]) -> int:
        """Détecte les tableaux Markdown ou blocs de code coupés au milieu par une frontière de chunk."""
        orphan_count = 0
        
        # Regex pour repérer les tableaux Markdown complets (lignes successives avec '|')
        table_pattern = re.compile(r"(\n\|[^\n]+\|\n)+")
        tables = list(table_pattern.finditer(cleaned_text))
        
        for table in tables:
            t_start, t_end = table.span()
            table_str = table.group(0).strip()
            
            # Vérifier si le tableau est scindé entre plusieurs chunks
            containing_chunks = [
                c for c in chunks 
                if not (c.end_char <= t_start or c.start_char >= t_end)
            ]
            
            # Si le tableau apparaît dans plus d'un chunk sans y être intégralement contenu
            if len(containing_chunks) > 1:
                is_fully_preserved = any(table_str in c.content for c in containing_chunks)
                if not is_fully_preserved:
                    orphan_count += 1
                    
        return orphan_count

    def audit_document(
        self, 
        document_id: str, 
        source_path: str, 
        cleaned_text: str, 
        chunks: list[Chunk],
        errors: list[str]
    ) -> DocumentReport:
        if errors:
            return DocumentReport(
                document_id=document_id,
                source_path=source_path,
                char_coverage_ratio=0.0,
                duplicate_char_ratio=0.0,
                orphan_blocks=0,
                token_count_delta=0,
                undersized_chunks_ratio=0.0,
                chunk_count=0,
                status="error",
                errors=errors
            )

        cleaned_char_count = len(cleaned_text)
        if cleaned_char_count == 0:
            return DocumentReport(
                document_id=document_id,
                source_path=source_path,
                char_coverage_ratio=1.0,
                duplicate_char_ratio=0.0,
                orphan_blocks=0,
                token_count_delta=0,
                undersized_chunks_ratio=0.0,
                chunk_count=0,
                status="ok"
            )

        # 1. Calculation Coverage
        covered_chars = set()
        total_chunk_chars = 0
        for c in chunks:
            total_chunk_chars += len(c.content)
            for idx in range(c.start_char, c.end_char):
                covered_chars.add(idx)

        char_coverage_ratio = len(covered_chars) / cleaned_char_count
        
        # 2. Duplicate Ratio (caractères lus plusieurs fois hors overlap théorique)
        duplicate_chars = total_chunk_chars - len(covered_chars)
        duplicate_char_ratio = duplicate_chars / cleaned_char_count

        # 3. Orphan Blocks (Tableaux / Code)
        orphans = self._detect_orphan_blocks(cleaned_text, chunks)

        # 4. Undersized Chunks
        undersized = sum(1 for c in chunks if c.token_count < self.min_chunk_size)
        undersized_ratio = undersized / len(chunks) if chunks else 0.0

        # Statut final
        status = "ok"
        if char_coverage_ratio < 0.98 or duplicate_char_ratio > 0.30:
            status = "warning"
        if orphans > 0:
            status = "error"

        return DocumentReport(
            document_id=document_id,
            source_path=source_path,
            char_coverage_ratio=round(char_coverage_ratio, 4),
            duplicate_char_ratio=round(duplicate_char_ratio, 4),
            orphan_blocks=orphans,
            token_count_delta=0,  # À ajuster selon le delta Tiktoken
            undersized_chunks_ratio=round(undersized_ratio, 4),
            chunk_count=len(chunks),
            status=status,
            errors=errors
        )

```

---

## 4. Spécifications du CLI & Intégration CI/CD

Le projet fournit une commande CLI executable installée via Poetry : `ingest`.

### 4.1 Interface de Commande

```bash
poetry run ingest \
  --input ./corpus/ \
  --output ./chunks/ \
  --strategy recursive \
  --chunk-size 512 \
  --overlap 64 \
  --min-chunk-size 50 \
  --report ./rapport_ingestion.json

```

### 4.2 Tableau d'Arguments

| Argument | Obligatoire | Valeur par défaut | Description |
| --- | --- | --- | --- |
| `--input` | **Oui** | - | Répertoire source contenant les fichiers `.txt`/`.md` |
| `--output` | **Oui** | - | Répertoire de destination pour les fichiers JSONL |
| `--strategy` | Non | `fixed` | Stratégie de chunking : `fixed` ou `recursive` |
| `--chunk-size` | Non | `512` | Taille cible des chunks en tokens |
| `--overlap` | Non | `0` | Chevauchement en tokens (stratégie fixed) |
| `--min-chunk-size` | Non | `20` | Seuil sous lequel un chunk est compté sous-dimensionné |
| `--report` | Non | `./rapport_ingestion.json` | Chemin du fichier de rapport de synthèse |

### 4.3 Rendu Console Rich & Exit Code

À la fin de l'exécution, le CLI doit :

1. Afficher une table formatée via la bibliothèque `Rich` résumant le traitement par document (Source, Chunks, Coverage, Orphans, Status).
2. **Code de sortie (Exit Code) :**
* **`0`** : Traitement réussi sans erreur bloquante.
* **`1`** : Si `documents_in_error > 0` ou si un `orphan_blocks > 0` est détecté (permet l'échec automatique d'un pipeline CI/CD).



---

## 5. Exigences de Test & Corpus de Synthèse

### 5.1 Suite de Tests `pytest` (Couverture $\ge 85\%$)

Les tests automatisés doivent obligatoirement couvrir les scénarios suivants :

1. **Document vide :** Ingestion d'un fichier de 0 octet sans crash, générant 0 chunk et un rapport valide.
2. **Document court :** Fichier contenant moins de tokens que `chunk_size` (doit générer exactement 1 chunk).
3. **Cas Limite Tableau Markdown (Orphan Test) :**
* Injection d'un document synthétique contenant un tableau Markdown sur la frontière théorique d'un chunk.
* **Assertion 1 :** La stratégie `fixed` doit levée `orphan_blocks > 0`.
* **Assertion 2 :** La stratégie `recursive` doit préserver l'intégralité du tableau et produire `orphan_blocks == 0`.


4. **Résilience aux Fichiers Corrompus :** Présence d'un fichier avec un encodage binaire invalide dans le dossier source. Le pipeline doit capturer l'exception, incrémenter `documents_in_error`, et **poursuivre le traitement** des autres fichiers sains.
5. **Non-régression de Couverture :** Vérification sur une fixture fixe que `char_coverage_ratio >= 0.98`.

### 5.2 Corpus Synthétique de Test (`/tests/fixtures/`)

Le dossier `/tests/fixtures/` doit contenir 4 fichiers témoins versionnés :

* `01_clean_doc.md` : Markdown parfaitement structuré.
* `02_noisy_header.txt` : Document texte avec en-têtes et pieds de page répétés 5 fois.
* `03_table_split.md` : Document contenant 2 grands tableaux Markdown et 1 bloc de code Python.
* `04_corrupted_encoding.txt` : Fichier contenant des octets non-UTF8 invalides.

---

## 6. Structure des Livrables Attendus

1. **Code Source Complet :** Implémentation modulaire et typée sous `src/ingestion/`.
2. **Valideurs de Qualité :** Succès des commandes `poetry run mypy --strict src` et `poetry run ruff check src`.
3. **Rapport d'Ingestion Généré :** Fichier `rapport_ingestion.json` produit sur le corpus de test synthétique.
4. **Fichier `README.md` enrichi :**
* Instructions d'installation et d'exécution du CLI.
* **Analyse Comparative (3-4 paragraphes) :** Comparaison explicite des métriques obtenues avec `fixed` vs `recursive` sur le corpus de test (illustration concrète de l'arbitrage coût/qualité).



---

## 7. Extensions Bonus (Facultatives)

1. **Semantic Chunking Strategy :** Ajout d'une 3ᵉ stratégie basée sur la chute de similarité cosinus entre embeddings de phrases consécutives (`sentence-transformers`).
2. **Extraction PDF Minimaliste :** Intégration d'un `PDFLoader` basé sur `pdfplumber` branché sur l'interface `DocumentLoader`.
3. **Dédoublonnage SimHash :** Détection préventive des doublons quasi-exacts entre fichiers sources avant chunking via l'algorithme SimHash.

---

## 8. Critères d'Acceptation (Checklist de Validation)

* [ ] **Strategy Pattern Strict :** Les stratégies `FixedSizeChunker` et `RecursiveStructuralChunker` sont interchangeables dynamiquement via le CLI.
* [ ] **Couverture de Caractères :** `char_coverage_ratio >= 0.98` sur le corpus sain avec la stratégie `recursive`.
* [ ] **Preservation des Tableaux :** `orphan_blocks == 0` avec la stratégie `recursive` sur les fichiers contenant des tableaux Markdown.
* [ ] **Résilience & Isolation :** Un fichier corrompu n'interrompt pas le traitement global de la CLI.
* [ ] **Exit Code CI/CD :** Le CLI retourne un code de sortie non nul (`1`) en cas d'erreur ou de tableau fragmenté.
* [ ] **Qualité du Code :** Zero erreur `mypy --strict` et zero alertes `ruff`.
* [ ] **Tests Automatisés :** La suite `pytest` s'exécute avec succès et affiche une couverture de code $\ge 85\%$.