# Chapitre 5 : Ingestion des données et pipelines ETL continus

> *"Garbage in, gospel out ? Pas tout à fait. Garbage in, garbage embedded — et c'est bien pire."*

---

## Introduction : La donnée avant le modèle

Un système de Génération Augmentée par Récupération (RAG) performant est rarement jugé sur le modèle de langage (LLM) qu'il appelle en fin de chaîne. Il est d'abord et avant tout évalué sur la qualité du matériel qu'il doit lire. Un LLM, aussi puissant soit-il, ne peut pas répondre correctement lorsqu'on lui fournit un fragment tronqué au milieu d'un tableau, un PDF dont l'extraction entremêle le texte de plusieurs colonnes, ou un index vectoriel qui contient encore des documents supprimés de la production il y a six mois.

La conception d'un système RAG de qualité production échoue rarement au niveau de la base de données vectorielle ou du LLM. Elle échoue presque toujours à la frontière de l'ingestion. Si vous alimentez vos modèles d'intégration (*embeddings*) avec des documents bruyants, mal formatés ou mal découpés, votre application aval générera des hallucinations ou ratera des éléments de contexte critiques. En ingénierie logicielle traditionnelle, le principe « garbage in, garbage out » s'applique ; en ingénierie de l'IA, il est amplifié de manière exponentielle.

Ce chapitre pose les fondations de la couche d'ingestion. Il s'attaque à trois problèmes distincts mais étroitement liés :

1. **Extraction & Parsing :** Comment extraire proprement le texte et la structure à partir de formats de documents hétérogènes et souvent complexes.
2. **Stratégie de segmentation (*Chunking*) :** Comment découper ce texte en unités sémantiques optimisées pour un moteur de recherche vectoriel.
3. **Synchronisation continue :** Comment maintenir un index vectoriel actif en production au fil du temps — sans doublons, données obsolètes ou contenus fantômes — à mesure que les sources de données primaires évoluent.

Un ingénieur produit IA (*AI Product Engineer*) n'est pas un ingénieur de données (*data engineer*) au sens traditionnel de la Business Intelligence (BI) — mais il partage les mêmes réflexes fondamentaux. La différence clé réside dans l'objectif final : chaque étape d'un pipeline de données pour l'IA est optimisée non pas pour des rapports SQL, mais pour maximiser la probabilité qu'un fragment cohérent et pertinent soit récupéré au moment de l'exécution et compris sans ambiguïté par un LLM.

```
                              INFORMATION BRUTE
          (PDFs, Sites Web, PPTX, Docx, Bases de données, Confluence, APIs)
                                      │
                                      ▼
                                DECOUVERTE
                       (Suivi des mises à jour & changements)
                                      │
                                      ▼
                          MOTEURS D'EXTRACTION & OCR
                     (Détection de mise en page, Bounding boxes)
                                      │
                                      ▼
                            NETTOYAGE & SANITISATION
              (Suppression entêtes/pieds de page, Tableaux vers MD/HTML)
                                      │
                                      ▼
                      RECONSTRUCTION STRUCTURELLE
                   (Parsing AST, Hiérarchie du document)
                                      │
                                      ▼
                           STRATEGIE DE DECOUPAGE
            (Fixe+Chevauchement, Récursif, Sémantique, Parent-Enfant)
                                      │
                                      ▼
                    ENRICHISSEMENT METADONNEES & PROVENANCE
                  (IDs de source, Traçabilité, Entêtes contextuels)
                                      │
                                      ▼
                             VALIDATION QUALITE
                     (Vérification des pertes, Score de cohérence)
                                      │
                                      ▼
                       STOCKAGE & COUCHE D'INDEXATION
              (Base de documents ──► Index de base de données vectorielle)
                                      │
                                      ▼
                             RAG & APPLICATION IA

```

---

## 5.1 Extraction, nettoyage et parsing de documents complexes

### Le mythe du « texte brut »

Contrairement aux pipelines de TALN (NLP) classiques qui supposent souvent un corpus propre et prétraité (par exemple des fichiers `.txt` ou `.csv`), un système d'IA d'entreprise doit ingérer ce que les entreprises produisent réellement : des PDF multi-colonnes exportés depuis Word, des présentations PowerPoint remplies de texte dispersé sur des canevas visuels, des wikis Markdown internes et des pages web dynamiques générées par des scripts JavaScript lourds.

Chaque format contient une structure logique (titres, sections, tableaux, notes de bas de page) que l'extraction naïve ne parvient pas à préserver nativement. L'erreur de l'ingénieur débutant est de traiter l'extraction comme un problème résolu : exécuter une simple bibliothèque de lecture de texte, parcourir le résultat en boucle et passer à la suite. En réalité, l'extraction naïve est la principale source de dégradation silencieuse de la qualité dans les systèmes RAG. Le LLM ne vous alertera jamais qu'il a reçu une entrée corrompue — il générera simplement une réponse plausible à partir de données bruyantes.

---

### Parsing de formats hétérogènes

Pour extraire du texte exploitable sans détruire ses relations sémantiques sous-jacentes, chaque format nécessite une stratégie dédiée.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                             Document Brut                               │
│              (PDF, DOCX, PPTX, HTML, Images scannées, CSV)              │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│               Parsing Structurel & Moteur d'OCR Vision                  │
│              (Détection Bounding Box, LayoutLM, Unstructured)           │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Normalisation & Sanitisation                       │
│        (Suppression entêtes/pieds de page, Tableaux vers Markdown/HTML) │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  Sortie Markdown Propre et Structurée                   │
└─────────────────────────────────────────────────────────────────────────┘

```

#### 1. PDFs multi-colonnes : Le format trompeur

Un PDF n'est pas un document texte ; c'est une spécification d'impression à mise en page fixe — un ensemble d'instructions explicites positionnant des caractères individuels sur un canevas de coordonnées à deux dimensions $(x, y)$. Par défaut, il n'a aucune notion native de « paragraphe », de « tableau » ou de « colonne ».

Les extracteurs naïfs lisent le texte de manière linéaire, de gauche à droite sur toute la largeur de la page. Sur une mise en page à deux colonnes, cela entremêle les lignes de la colonne A et de la colonne B :

```
Ordre de lecture naïf (Corrompu) :
Colonne A Ligne 1 ──► Colonne B Ligne 1 ──► Colonne A Ligne 2 ──► Colonne B Ligne 2

```

Cela crée une chaîne de caractères totalement incohérente pour un lecteur ou un LLM.

Pour surmonter cela, les systèmes en production reposent sur deux paradigmes principaux :

* **Analyse Géométrique de la Mise en Page :** Des bibliothèques comme `pdfplumber` ou `PyMuPDF` (`fitz`) extraient les coordonnées des boîtes englobantes (*bounding boxes*) de chaque bloc de texte. Elles regroupent les blocs en fonction de leurs limites horizontales pour reconstituer les colonnes avant de les assembler verticalement.
* **Modèles de Mise en Page basés sur la Vision :** Les pipelines intégrant des architectures de transformeurs vision ou des modèles de vision par ordinateur (par ex. `Unstructured` en mode `hi_res`, `LayoutParser`, `Marker` ou `Azure Document Intelligence`) analysent la page visuellement. Ils identifient les boîtes englobantes structurelles autour des titres, du texte narratif, des barres latérales et des tableaux, garantissant un ordre de lecture correct même sur des pages multi-colonnes ou scannées.

Dans les environnements Python modernes, des boîtes d'outils de parsing unifiées comme `unstructured` ou `docling` simplifient cela en faisant l'abstraction des divers formats derrière une API propre qui renvoie des éléments fortement typés (`Title`, `NarrativeText`, `Table`, `ListItem`) :

```python
from unstructured.partition.pdf import partition_pdf

# Extraction avancée de la mise en page visuelle pour PDFs complexes
elements = partition_pdf(
    filename="rapport_annuel_2026.pdf",
    strategy="hi_res",           # Déclenche l'analyse de mise en page par vision/OCR
    infer_table_structure=True,  # Reconstruit les tableaux en HTML structuré
    extract_images_in_pdf=False,
)

for el in elements:
    print(f"[{type(el).__name__}]: {str(el)[:80]}...")

```

#### 2. Markdown : Une simplicité trompeuse

Le Markdown est un texte structuré, ce qui en fait un format intermédiaire idéal pour les LLMs. Cependant, les exports d'entreprise provenant de plateformes comme Notion, Confluence ou GitBook contiennent souvent des balises HTML brutes, des chemins de liens relatifs, des médias intégrés et des en-têtes YAML (*frontmatter*).

Le parsing ligne par ligne brise la sémantique des blocs de code (en interprétant par exemple un `#` dans un commentaire Python comme un titre $H1$) et rejette le frontmatter YAML. Le frontmatter contient pourtant des métadonnées critiques comme les auteurs, les dates de modification et les balises d'accès.

Les bonnes pratiques imposent d'utiliser des parseurs d'Arbre de Syntaxe Abstraite (AST) (tels que `markdown-it-py` ou `mistune`) pour isoler explicitement le frontmatter sous forme d'attributs de métadonnées structurés, séparés du corps de texte principal.

#### 3. PPTX : Dispersal Spatial

Les présentations PowerPoint stockent le texte dans des formes vectorielles indépendantes positionnées sur un canevas visuel, sans ordre de lecture rigide. Un titre de diapositive, une liste à puces et la légende d'un graphique n'ont pas de relation native au-delà du fait de partager le même index de diapositive.

En utilisant des outils comme `python-pptx`, la logique d'extraction doit établir des heuristiques d'ordonnancement (généralement en triant les formes de haut en bas et de gauche à droite) et lier directement les éléments extraits au numéro de leur diapositive source. Préserver cette provenance est nécessaire pour la génération précise de citations en aval.

#### 4. Pages Web : Isoler le contenu du bruit de navigation

L'extraction du HTML brut via des parseurs DOM standard (par exemple `BeautifulSoup` récupérant `document.body.innerText`) produit des corpus pollués par $40\%\text{ à }60\%$ de texte non informatif : barres de navigation, avis de non-responsabilité en pied de page, bannières de cookies et scripts publicitaires intégrés.

Des extracteurs spécialisés comme `trafilatura` ou `readability-lxml` utilisent des heuristiques de densité textuelle pour calculer le ratio entre le texte et les balises HTML à travers les sous-arbres du DOM. Cela permet de supprimer la structure générique du site pour ne conserver que le corps de l'article ou de la documentation.

---

### Sanitisation et Normalisation

Une fois le parsing de la structure et de la mise en page terminé, les chaînes de caractères brutes nécessitent un nettoyage déterministe avant de passer à l'étape suivante du pipeline :

1. **Suppression du texte répétitif (*Boilerplate*) :** Utilisez des expressions régulières (regex) ou des filtres de position pour éliminer les en-têtes récurrents, les numéros de page et les mentions légales.
2. **Normalisation Unicode :** Standardisez les variantes de caractères en utilisant la fonction Python `unicodedata.normalize("NFKC", text)` afin de garantir des encodages de caractères cohérents (par exemple, convertir les espaces insécables, les guillemets typographiques et les ligatures en leurs équivalents ASCII standard).
3. **Préservation de la structure des tableaux :** Ne扁平 (n'aplanissez) jamais un tableau structuré en un texte continu non formaté. Un tableau est une représentation dense d'informations. Le convertir en un tableau Markdown structuré ou en balises HTML `<table>` explicites permet au LLM de conserver l'alignement lignes-colonnes pendant son raisonnement.

```python
import re
import unicodedata

def sanitize_extracted_text(raw_text: str) -> str:
    """Standardise les caractères unicode et supprime le boilerplate du document."""
    # Étape 1 : Normalisation NFKC
    normalized = unicodedata.normalize("NFKC", raw_text)
    
    # Étape 2 : Suppression des mentions légales récurrentes et des compteurs de pages
    cleaned = re.sub(r"Page \d+ sur \d+", "", normalized)
    cleaned = re.sub(r"CONFIDENTIEL ENTREPRISE - NE PAS DISTRIBUER", "", cleaned, flags=re.IGNORECASE)
    
    # Étape 3 : Réduction des espaces blancs tout en préservant les sauts de ligne structurels
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    cleaned = re.sub(r"\n\s*\n", "\n\n", cleaned)
    
    return cleaned.strip()

```

> **Principe fondamental :** Chaque transformation lors de l'étape de nettoyage doit augmenter la clarté sémantique pour le LLM sans supprimer d'informations factuelles.

---

## 5.2 Stratégies avancées de découpage du texte (*Chunking*)

### La contrainte de la fenêtre de contexte

Même avec des modèles offrant des fenêtres de contexte couvrant des centaines de milliers de tokens, injecter des documents entiers dans chaque prompt RAG est une mauvaise pratique d'ingénierie. Cela s'explique par trois facteurs :

1. **Coût financier :** Les APIs LLM modernes facturent au token d'entrée.
2. **Luminescence/Lenteur de génération :** Un nombre élevé de tokens augmente le temps avant le premier token (*Time-To-First-Token* ou TTFT) et ralentit la vitesse de traitement de l'inférence.
3. **Précision de récupération :** Les moteurs de recherche vectoriels récupèrent les faits bien plus efficacement lorsqu'ils indexent de petits fragments très ciblés. Les fragments de grande taille diluent le signal sémantique dans du bruit de fond non informatif — un problème connu sous le nom de phénomène « perdu au milieu » (*lost in the middle*).

Le *chunking* est l'opération qui divise un document en unités discrètes et sémantiquement autonomes, optimisées pour l'indexation vectorielle et l'injection dans le contexte des prompts du LLM.

---

### Stratégie 1 : Découpage à taille fixe avec chevauchement

Le découpage à taille fixe divise le texte à des intervalles définis basés sur le nombre de caractères ou de tokens (calculés via `tiktoken` ou le tokenizer natif du modèle cible).

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
    """Découpe le texte en fenêtres de tokens fixes avec un chevauchement glissant défini."""
    encoder = tiktoken.get_encoding(encoding_name)
    tokens = encoder.encode(text)
    
    step = chunk_size - overlap
    chunks = []
    
    for i in range(0, len(tokens), step):
        chunk_tokens = tokens[i : i + chunk_size]
        chunks.append(encoder.decode(chunk_tokens))
        
    return chunks

```

* **Le rôle du chevauchement :** Le chevauchement glissant (généralement $10\%\text{ à }20\%$ de la taille totale du fragment) garantit que les concepts se trouvant précisément sur une frontière de découpe restent intacts dans au moins un des fragments.
* **Limites :** Le découpage à taille fixe ne tient pas compte des phrases ni de la structure logique. Il coupe fréquemment des phrases, des blocs de code ou des tableaux en plein milieu, isolant des faits clés de leur contexte environnant.

---

### Stratégie 2 : Découpage récursif et structurel par caractères

Le découpage récursif respecte les ruptures naturelles du texte en utilisant une hiérarchie priorisée de séparateurs : double saut de ligne (`\n\n`), simple saut de ligne (`\n`), espace, et enfin caractère unique.

Popularisée par le `RecursiveCharacterTextSplitter` de LangChain, cette méthode tente de conserver les paragraphes et les sections logiques intacts. Si une section dépasse la limite maximale de tokens, elle descend récursivement au séparateur suivant dans la hiérarchie.

Lorsqu'on travaille avec des documents partitionnés visuellement (Section 5.1), le découpage structurel peut regrouper les éléments typés directement par titre de section (`Title`), conservant ainsi les tableaux entiers dans leurs propres fragments dédiés.

```python
# Exemple de regroupement structurel utilisant des éléments unstructured
def chunk_by_document_structure(elements: list, max_tokens: int = 512) -> list[str]:
    chunks = []
    current_chunk = []
    current_token_count = 0
    
    for el in elements:
        text = str(el)
        element_tokens = len(text.split()) # Approximation simple, utiliser tiktoken en production
        
        # Toujours isoler les tableaux dans leur propre fragment
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

### Stratégie 3 : Découpage sémantique (*Semantic Chunking*)

Le découpage sémantique affranchit les limites de fragments du simple décompte de caractères ou de tokens. À la place, il utilise des vecteurs d'intégration pour détecter les transitions logiques de sujets dans le texte.

```
Phrase 1 ──► Intégration ──┐
                           ├── Vérification Distance Cosinus ──► Sous le seuil ? ──► Garder dans le fragment
Phrase 2 ──► Intégration ──┘                                           │
                                                                 Au-dessus du seuil ?
                                                                       │
                                                                       ▼
                                                          Créer une nouvelle frontière

```

#### Mécanisme

1. Diviser le document en phrases individuelles.
2. Calculer les vecteurs d'intégration (*embeddings*) pour chaque phrase (ou pour une fenêtre glissante de phrases).
3. Calculer la distance cosinus entre les intégrations de phrases consécutives.
4. Identifier les pics statistiques de distance sémantique (chutes de similarité). Découper le document à ces points de variance.

```python
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

def semantic_chunking(text: str, similarity_threshold: float = 0.75) -> list[str]:
    # 1. Séparation naïve en phrases
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
            # Rupture sémantique détectée ; finalisation du fragment
            chunks.append(". ".join(current_chunk) + ".")
            current_chunk = [sentences[i+1]]
        else:
            current_chunk.append(sentences[i+1])
            
    if current_chunk:
        chunks.append(". ".join(current_chunk) + ".")
        
    return chunks

```

* **Avantages :** Génère des fragments ayant une très forte cohérence sémantique interne.
* **Inconvénients :** Gourmand en calculs lors de l'ingestion, car il nécessite de générer une intégration vectorielle pour chaque phrase afin de déterminer les limites.

---

### Stratégie 4 : Découpage hiérarchique / Parent-Enfant (*Parent-Document*)

Le découpage hiérarchique résout le compromis entre les petits fragments (idéaux pour une récupération vectorielle précise) et les grands contextes (idéaux pour le raisonnement du LLM).

```
[ Document / Section Parent (1024 Tokens) - Stocké dans la base Clé-Valeur ]
       │
       ├──► Fragment Enfant 1 (128 Tokens) ──► Indexé dans la DB Vectorielle
       ├──► Fragment Enfant 2 (128 Tokens) ──► Indexé dans la DB Vectorielle
       └──► Fragment Enfant 3 (128 Tokens) ──► Indexé dans la DB Vectorielle

```

#### Mécanisme

1. Découper le document en petits **Fragments Enfants** (par exemple 128 tokens) et en plus grands **Fragments Parents** (par exemple 1024 tokens ou sections complètes).
2. Générer des intégrations vectorielles et indexer *uniquement* les fragments enfants dans la base de données vectorielle.
3. Lier les métadonnées de chaque fragment enfant à son `parent_id` correspondant, stocké dans un magasin Clé-Valeur rapide (comme Redis ou PostgreSQL).
4. **Au moment de la requête :** Effectuer la recherche sur les vecteurs enfants pour obtenir une grande précision sémantique. Une fois le résultat trouvé, récupérer et injecter le *Fragment Parent* plus large dans le contexte du LLM.

---

### Matrice de décision des stratégies de découpage

| Stratégie | Complexité d'implémentation | Cohérence sémantique | Coût en calcul | Cas d'usage principal en production |
| --- | --- | --- | --- | --- |
| **Taille fixe** | Très faible | Faible | Très faible | Prototypage rapide, flux de texte brut simple |
| **Fixe + Chevauchement** | Faible | Modérée | Faible | Ligne de base solide par défaut pour du texte linéaire |
| **Structurel récursif** | Modérée | Élevée | Faible | Documentation structurée, manuels, wikis Markdown |
| **Sémantique** | Élevée | Très élevée | Élevé | Rapports spécialisés complexes (juridique, médical, finance) |
| **Parent-Enfant** | Élevée | Élevée | Modéré | Bases de connaissances profondes nécessitant précision et contexte |

---

## 5.3 Enrichissement par métadonnées et rembourrage contextuel

Les fragments de texte ne doivent jamais être stockés de manière isolée. Deux chaînes de texte identiques (par exemple : `"La période de garantie est de deux ans."`) ont des significations différentes si l'une s'applique au *Produit A (v1.0)* et l'autre au *Produit B (v5.0)*.

Les métadonnées fournissent un contexte essentiel que les vecteurs seuls ne peuvent pas capturer.

```json
{
  "chunk_id": "doc_fin_2026_q3_c14",
  "document_id": "doc_fin_2026_q3",
  "content": "La marge opérationnelle s'est accrue de 140 points de base pour atteindre 22,4%...",
  "vector": [0.0124, -0.0431, 0.0891, "..."],
  "metadata": {
    "source_url": "s3://finance-vault/2026/q3_report.pdf",
    "document_name": "q3_report.pdf",
    "file_type": "pdf",
    "page_number": 14,
    "section_title": "Résultats Financiers > Indicateurs Opérationnels",
    "created_at": "2026-08-01T10:00:00Z",
    "content_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "access_control_roles": ["finance_admin", "executive"],
    "is_active": true
  }
}

```

### Rembourrage contextuel (*Contextual Padding* - Préfixage des métadonnées)

Les modèles d'intégration pondèrent les mots en fonction de leur position relative. Pour éviter qu'un fragment ne perde son contexte global, vous pouvez préfixer les métadonnées du document directement dans le texte du fragment avant de générer son intégration vectorielle :

```python
def apply_contextual_padding(chunk_text: str, document_title: str, section_path: str) -> str:
    """Préfixe le contexte structurel directement dans le texte avant la génération du vecteur."""
    context_header = f"Document : {document_title}\nSection : {section_path}\n---\n"
    return context_header + chunk_text

```

Cela garantit que même si un fragment ne mentionne jamais explicitement le nom du produit, son vecteur reflétera le contexte global du document.

---

## 5.4 Pipelines ETL continus et gestion des suppressions

### La réalité des bases de connaissances d'état (*Stateful*)

Les scripts d'ingestion statiques fonctionnent très bien pour des démonstrations ponctuelles. Cependant, les applications d'entreprise en production doivent rester synchronisées avec des sources externes vivantes et évolutives (buckets S3, bases PostgreSQL, espaces Notion ou Jira).

Si un document est modifié à la source, l'ingérer de manière naïve crée des fragments en double dans votre base vectorielle. Si un fichier est supprimé à la source, laisser ses intégrations vectorielles intactes crée de graves risques de sécurité et amène l'IA à récupérer des informations obsolètes ou révoquées.

```
                               ┌──────────────────────────────┐
                               │ Document Source (PostgreSQL) │
                               └──────────────┬───────────────┘
                                              │
                                  CDC / Déclencheurs d'événements
                                              │
                                              ▼
                               ┌──────────────────────────────┐
                               │    Moteur d'Ingestion ETL    │
                               │(Calcule Hashes & Fragments)  │
                               └──────────────┬───────────────┘
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    │                                                   │
             [Upsert / Mise à jour]                              [Événement de Suppression]
                    │                                                   │
                    ▼                                                   ▼
          ┌──────────────────┐                                ┌──────────────────┐
          │Stockage Vectoriel│                                │Vecteurs Cibles : │
          │ (Vecteurs & MD)  │                                │doc_id == Cible   │
          └──────────────────┘                                └──────────────────┘

```

Un pipeline ETL en production doit être **idempotent** et **différentiel** : exécuter le pipeline de manière répétée sur une source inchangée ne doit produire aucun effet secondaire, et seules les données modifiées doivent être retraitées.

---

### Détection des changements via le hachage cryptographique du contenu

La stratégie la plus fiable pour suivre les mises à jour sur l'ensemble des fichiers sources consiste à calculer un hash cryptographique (par exemple `SHA-256`) du contenu brut du document avant toute transformation.

```python
import hashlib

def calculate_content_hash(content: str | bytes) -> str:
    """Génère un hash SHA-256 du contenu brut d'un document."""
    if isinstance(content, str):
        content = content.encode("utf-8")
    return hashlib.sha256(content).hexdigest()

```

#### Algorithme du cycle de vie de synchronisation

Maintenez une table d'état persistant (souvent appelée table de traçabilité ou d'état de synchronisation) contenant : `document_id`, `last_content_hash` et `last_synced_at`.

Lors d'une exécution d'ingestion, pour chaque document trouvé à la source :

1. Calculez le hash `SHA-256` du contenu actuel.
2. Comparez-le au hash stocké dans la table d'état.

* **Les hashes correspondent :** Le document n'a pas changé. Ignorez le traitement.
* **Les hashes diffèrent :** Le document a été modifié. Purgez tous les fragments existants associés à ce `document_id` dans l'index vectoriel. Ré-extrayez, nettoyez, découpez, intégrez (*embed*) et insérez/mettez à jour (*upsert*) les données rafraîchies. Mettez à jour le hash stocké.

3. **Document absent de la source :** Le document a été supprimé. Purgez ses fragments de la base vectorielle et supprimez son entrée de la table d'état.

```python
async def synchronize_document_corpus(
    source_documents: list[SourceDoc], 
    sync_table: SyncStateDatabase,
    vector_store: VectorDatabase
):
    source_ids = {doc.id for doc in source_documents}
    known_ids = await sync_table.get_all_document_ids()

    # 1. Traiter les suppressions (Présents dans la table de sync, mais absents de la source)
    deleted_ids = known_ids - source_ids
    for doc_id in deleted_ids:
        await vector_store.delete_by_document_id(doc_id)
        await sync_table.remove_entry(doc_id)

    # 2. Traiter les ajouts et les mises à jour
    for doc in source_documents:
        current_hash = calculate_content_hash(doc.raw_bytes)
        known_hash = await sync_table.get_hash(doc.id)

        if current_hash == known_hash:
            continue  # Pas de changement ; ignorer le traitement coûteux

        # En cas de modification d'un document existant, purger les anciens vecteurs d'abord
        if known_hash is not None:
            await vector_store.delete_by_document_id(doc.id)

        # Traiter le contenu nouveau ou mis à jour
        cleaned_text = sanitize_extracted_text(doc.text_content)
        chunks = chunk_fixed_with_overlap(cleaned_text)
        
        await vector_store.upsert_chunks(document_id=doc.id, chunks=chunks)
        await sync_table.upsert_entry(doc.id, current_hash)

```

---

### Stratégies de gestion des suppressions

Pour gérer les suppressions en production, vous pouvez choisir entre deux paradigmes principaux :

#### Paradigme A : Suppressions définitives (*Hard Deletes*)

Supprimez directement les données vectorielles du moteur vectoriel en utilisant un filtrage sur les métadonnées :

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

#### Paradigme B : Suppressions logiques & Filtrage actif (*Soft Deletes*)

Dans les environnements à forte conformité nécessitant une piste d'audit, marquez les vecteurs du document comme inactifs au lieu de les purger immédiatement :

1. Mettez à jour le champ de métadonnées pour définir `is_active: false` lors de la suppression à la source.
2. Ajoutez un filtre obligatoire à toutes les requêtes RAG entrantes :

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

Cela garantit que les documents obsolètes ou supprimés sont filtrés à l'exécution de la requête tout en conservant l'historique des données disponible pour les audits de conformité.

---

### Déclencheurs d'ingestion et architectures d'événements

En fonction des exigences de votre produit, choisissez un modèle de déclenchement approprié :

```
[ Batch Programmé Cron ]    ──► Faible complexité, mises à jour périodiques (ex. nocturnes)
[ Intégration par Webhook ] ──► Basé sur les événements, faible latence (ex. S3/Notion Upload)
[ Change Data Capture ]     ──► Traitement de flux en temps réel via logs DB (Debezium/Kafka)

```

1. **Batch programmé (*Scheduled Batch*) :** S'exécute selon un horaire fixe (par exemple via Celery Beat ou Airflow). Idéal lorsque la latence de synchronisation de quelques heures est acceptable.
2. **Webhooks pilotés par les événements (*Event-Driven*) :** Les systèmes sources notifient votre API dès qu'un fichier est créé, mis à jour ou supprimé (ex. Notifications d'événements S3 ou Webhooks GitHub). Cela offre une synchronisation à faible latence pour les applications sensibles au temps.
3. **Capture des changements de données (*Change Data Capture / CDC*) :** Utilise des outils de streaming comme Debezium ou le mécanisme `LISTEN/NOTIFY` de PostgreSQL pour capturer les modifications directement depuis les journaux de transactions de la base de données. C'est l'approche la plus évolutive et temps réel pour les grandes bases de données d'entreprise.

---

## 5.5 Contrôle qualité, observabilité et gestion des erreurs

### Observabilité du pipeline

Un pipeline d'ingestion qui échoue en silence est pire qu'un pipeline qui plante explicitement — il donne aux utilisateurs l'illusion que leur base de connaissances est à jour.

Un pipeline de niveau production doit suivre et enregistrer les métriques clés suivantes :

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

#### Métriques clés à surveiller

* **Débit d'ingestion :** Nombre de documents et de fragments traités par minute.
* **Qualité d'extraction & Perte de caractères :** Signalez les anomalies où l'extraction produit zéro caractère ou subit une chute inattendue de la taille en octets par rapport au fichier source.
* **Scores de cohérence des fragments :** Surveillez le nombre moyen de tokens et la complétude des phrases sur l'ensemble des fragments générés.
* **Latence de synchronisation :** Le temps écoulé entre la modification d'un document à la source et la mise à jour de son index vectoriel.

---

### Stratégies de rejeu solides et files d'attente de lettres mortes (DLQ)

Lors de l'ingestion de milliers de documents, la corruption de fichiers, les interruptions de réseau et les dépassements de limites d'API sont inévitables. Le pipeline doit isoler les documents défaillants sans faire planter l'ensemble du traitement.

```python
import asyncio
import logging

logger = logging.getLogger("ETLPipeline")

async def process_event_with_exponential_backoff(
    event: dict, 
    pipeline_worker: callable, 
    max_retries: int = 3
):
    """Traite un événement avec un retrait exponentiel, en l'orientant vers une DLQ en cas d'échec persistant."""
    attempt = 0
    base_delay = 2  # Secondes
    
    while attempt < max_retries:
        try:
            await pipeline_worker(event)
            return  # Succès
        except Exception as err:
            attempt += 1
            if attempt >= max_retries:
                logger.error(f"Erreur d'ingestion fatale pour l'événement {event['doc_id']}. Routage vers la DLQ. Erreur : {err}")
                await route_to_dead_letter_queue(event, err)
                return
            
            sleep_duration = base_delay ** attempt
            logger.warning(f"Erreur transitoire sur {event['doc_id']}. Nouvelle tentative dans {sleep_duration}s... (Essai {attempt}/{max_retries})")
            await asyncio.sleep(sleep_duration)

async def route_to_dead_letter_queue(event: dict, error: Exception):
    # Écrire la charge utile ayant échoué et la trace d'erreur dans une DLQ persistante pour inspection
    pass

```

---

## 5.6 Principes d'ingénierie fondamentaux à retenir

1. **Garbage In, Garbage Embedded :** Les systèmes RAG très performants reposent sur une ingestion de données propre et précise. Aucune architecture de récupération ne peut compenser un parsing PDF défectueux ou des tableaux déformés.
2. **La structure prime sur le texte brut :** Préservez la mise en page des documents. Utilisez des outils de parsing visuel pour les PDF multi-colonnes, structurez les tableaux en Markdown ou HTML, et nettoyez les en-têtes et pieds de page avant le découpage.
3. **Choisissez la bonne stratégie de découpage :** Adoptez des techniques adaptées au type de contenu :
* Taille fixe + Chevauchement pour du texte linéaire générique.
* Structurel récursif pour de la documentation structurée.
* Sémantique pour des rapports métiers complexes.
* Parent-Enfant pour une récupération haute précision avec un besoin de contexte large.


4. **Les métadonnées sont essentielles :** Attachez toujours un contexte riche (IDs de source, titres de section, numéros de page, balises de contrôle d'accès) à chaque fragment.
5. **Concevez pour la synchronisation continue :** Construisez des pipelines idempotents basés sur le hachage de contenu SHA-256 pour gérer la création, la modification et la suppression de manière fluide.
6. **Gérez les suppressions explicitement :** Traitez la suppression de documents comme une étape de synchronisation fondamentale afin d'éviter les données obsolètes et les fuites de confidentialité.
7. **Incorporez la résilience et l'observabilité :** Isolez les erreurs au niveau des documents grâce à des rejeux et des Dead-Letter Queues (DLQ), et surveillez les métriques clés comme les pertes d'extraction ou la latence de traitement.

---

## Résumé

Dans ce chapitre, nous sommes passés de la simple idée de « fournir des documents à une IA » à la construction d'un pipeline d'ingénierie de données robuste pour la production.

Nous avons vu comment les formats hétérogènes — PDFs multi-colonnes, Markdown, présentations PPTX et pages web — nécessitent des stratégies de parsing spécialisées pour préserver leur structure logique. Nous avons analysé quatre stratégies majeures de découpage (Fixe+Chevauchement, Structurel récursif, Sémantique et Parent-Enfant), en montrant comment la qualité des fragments influence directement la performance de la recherche en aval.

Enfin, nous avons abordé la conception d'ETL continus, en montrant comment le hachage cryptographique, la synchronisation différentielle, la gestion explicite des suppressions et l'observabilité permettent de maintenir les bases de données vectorielles parfaitement alignées avec les sources de données d'entreprise en direct.

Vos données étant désormais nettoyées, structurées et découpées en unités récupérables, la prochaine étape consiste à convertir ces fragments de texte en représentations mathématiques recherchables.

*Dans le chapitre suivant, nous aborderons les intégrations vectorielles, l'indexation dense vs. sparse, la recherche hybride et les architectures de récupération avancées.*