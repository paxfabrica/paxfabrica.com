# Projet 0 : Le Kit Parfait

### ⚡ Constat d'Impact & Note de Cadrage
Ce document formalise les spécifications fonctionnelles et techniques absolues pour la création de l'usine logicielle standardisée qui servira de socle à l'ensemble des projets d'ingénierie du manuel. Conformément aux exigences de la Partie 0, ce livrable définit quoi construire et pourquoi, excluant toute implémentation immédiate. Il s'agit de structurer l'environnement de l'AI Product Engineer : un profil hybride né de la convergence entre le développement web, l'ingénierie de données et la vision produit.

---

## 1. Contexte & Objectifs Stratégiques

### 1.1 Le Problème

80% des projets d'intelligence artificielle échouent ou restent au stade de démonstration en raison d'un environnement mal configuré. Les conflits de dépendances (« *ça marche sur ma machine* »), l'absence de typage strict sur des données non structurées et le manque d'isolation des environnements détruisent la vélocité des équipes et rendent l'industrialisation impossible.

### 1.2 La Solution : « Le Kit du Parfait Bâtard »

Ce projet consiste à concevoir un template de dépôt de code (*boilerplate*) hautement professionnel, modulaire et 100% reproductible. Il doit permettre à n'importe quel développeur (du junior à l'ingénieur senior) de cloner le dépôt et d'obtenir une infrastructure locale prête pour la production en moins de 5 minutes.

### 1.3 Alignement avec les Piliers du Manifeste

* **Velocity (Vélocité) :** Réduire le temps entre l'idée et le prototype. L'environnement doit automatiser toutes les tâches redondantes (*boilerplate code*) pour libérer du temps de conception.
* **User-in-the-Loop :** Préparer le terrain pour capturer le feedback utilisateur et tracer les flux probabilistes.
* **Éthique & Sécurité par défaut :** Interdire nativement la fuite de secrets (clés API) et isoler les environnements d'exécution.

---

## 2. Périmètre Fonctionnel (Le « Quoi »)

Le kit doit impérativement couvrir cinq besoins fondamentaux :

1.  Isolation totale de l'environnement : Garantir une exécution identique et agnostique du système d'exploitation hôte (macOS, Linux, Windows).
2.  Gestion déterministe des dépendances : Déclarer, résoudre et verrouiller les versions des bibliothèques de façon stricte, en séparant l'environnement de production de celui de développement (tests, linters).
3.  **Assistance au code et édition IA-First :** Intégrer des fichiers de configuration partagés pour aligner l'éditeur sur les standards de l'équipe (complétion et règles d'ingénierie).
4.  **Contrôle qualité automatisé (Gatekeeping) :** Bloquer à la source l'introduction de code mal formaté, non typé ou non sécurisé avant chaque validation Git.
5.  **Preuve de concept minimale :** Un script d'amorçage (`main.py` ou un endpoint `/health`) capable de valider la connectivité réseau et la structure d'import sans charger de logique métier.

---

## 3. Architecture de Dossiers Imposée (Arborescence Modulaire)

Le dépôt doit se conformer strictement à l'arborescence suivante pour garantir la séparation des privilèges et éviter les fuites de code expérimental en production :

``` bash
ai-product-engineer-kit/
├── .github/                  # Workflows d'intégration continue (CI/CD)
│   └── workflows/
│       └── ci.yml
├── .vscode/                  # Configuration partagée de l'IDE (Cursor / VS Code)
│   ├── extensions.json       # Extensions d'équipe recommandées
│   └── settings.json         # Règles de formatage et paths Python
├── src/                      # Code source applicatif unique destiné au déploiement
│   ├── __init__.py
│   ├── api/                  # Endpoints et routeurs (ex: FastAPI)
│   ├── core/                 # Logique centrale, configuration et sécurité
│   │   ├── llm/              # Abstraction des clients de modèles
│   │   └── prompts/          # Gestionnaires de prompts système
│   ├── models/               # Schémas de données et contrats d'interface (Pydantic)
│   └── main.py               # Point d'entrée de l'application
├── tests/                    # Tests automatisés (Unitaires, Intégration, LLM-as-a-Judge)
│   ├── __init__.py
│   ├── conftest.py           # Fixtures et configurations de tests
│   └── test_main.py          # Validation de l'environnement
├── notebooks/                # Exploration libre, prototypage de prompts (Exclu de la prod)
├── scripts/                  # Outils utilitaires (ingestion, hooks, maintenance)
├── docs/                     # Documentation technique et schémas d'architecture
├── .dockerignore             # Exclusion des fichiers locaux lourds ou sensibles
├── .gitignore                # Exclusion stricte des runtimes et des fichiers de secrets
├── .pre-commit-config.yaml   # Chaîne d'exécution des hooks automatisés
├── Makefile                  # Interface de commandes unifiée pour le cycle de vie du projet
├── pyproject.toml            # Manifeste central de configuration et de dépendances
└── Dockerfile                # Recette de conteneurisation multi-stage
```

---

## 4. Spécifications Techniques & Choix des Outils

| Composant             | Solution Choisie        | Contrainte de Version | Justification Technologique                                                                                                                          |
| :-------------------- | :---------------------- | :-------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Langage**           | Python                  | `3.11+`               | Support natif des fonctionnalités de typage avancées (`typing.Self`), optimisation de l'asynchronisme et compatibilité étendue avec l'écosystème IA. |
| **Gestionnaire**      | Poetry                  | `1.7+`                | Isolation stricte via un fichier de verrouillage (`poetry.lock`) éliminant le non-déterminisme des paquets tiers en production.                      |
| **Conteneurisation**  | Docker & Docker Compose | `24+`                 | Isolation de l'environnement d'exécution par rapport au système d'exploitation hôte. Exigence de builds multi-stages pour la légèreté des images.    |
| **Qualité & Linting** | Ruff                    | `0.3+`                | Remplace avantageusement Flake8 et Black avec une exécution ultra-rapide en C++, préservant la vélocité lors des commits.                            |
| **Typage Statique**   | Mypy                    | `1.8+`                | Analyse statique rigoureuse sans exception. Essentielle pour valider la structure des payloads JSON hautement variables retournés par les LLM.       |
| **Formatage**         | Black                   | `24+`                 | Standardisation absolue du style de code pour éviter les bruits de relecture sur Git.                                                                |
| **Framework Test**    | Pytest                  | `8+`                  | Flexibilité éprouvée et gestion native des tests asynchrones via `pytest-asyncio`.                                                                   |
| **Sécurité**          | Detect-Secrets          | S.O.                  | Hook pré-commit obligatoire bloquant le processus d'envoi si une chaîne assimilable à une clé privée ou d'API est détectée.                          |

---

## 5. Critères de Réussite & Limites du Projet

5.1 Definition of Done (DoD) — Critères d'Acceptation

Pour que le Projet 0 soit validé, il doit répondre aux critères mesurables suivants :

- [ ] **Zéro Configuration Manuelle Complexifiée :** L'installation complète s'exécute via une seule commande (`make install` ou `poetry install`).
- [ ] **Contrôle Qualité Hermétique :** Une commande `make lint` ou une tentative de `git commit` avec un fichier mal formaté ou contenant une erreur de type doit lever une erreur explicite et interrompre le flux de travail.
- [ ] **Sanitisation Git :** Le fichier `.env` contenant les jetons d'accès ne doit jamais pouvoir être indexé. Seul un fichier `.env.example` anonymisé est accepté sur le dépôt distant.
- [ ] **Isolation Validée :** Le conteneur Docker doit compiler et s'exécuter via `docker-compose up --build` sur une machine tierce vierge en moins de 5 minutes.

5.2 Hors Périmètre (Out of Scope)

Pour préserver la pureté de l'infrastructure logicielle initiale, sont explicitement exclus :

  * Tout appel réseau ou intégration directe de fonctionnalités de modèles de langage (LLM).
  * La persistance de données métier ou la configuration d'agents complexes.
  * Le déploiement vers des fournisseurs de cloud en production.


