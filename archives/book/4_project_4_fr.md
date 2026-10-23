# Projet 3 : Chatbot Web Temps Réel à Faible Latence

> **Module :** Livrable du Chapitre 4 | **Type :** Application Web de Production  
> **Domaine :** Architecture Backend pour l'IA, Asynchronisme & Interface UI en Streaming  
> **Stack :** Python 3.11+, FastAPI (ASGI), Uvicorn, AsyncOpenAI / httpx, Server-Sent Events (SSE), React 18+, TypeScript, Vite, Tailwind CSS, Poetry, Ruff, Mypy  

---

## Synthèse Explicative

Dans les Projets 2 et 3, vous avez validé votre capacité à dialoguer de façon programmatique avec des grands modèles de langage (LLM), à mettre en œuvre des mécanismes de retry/backoff prêts pour la production et à imposer des sorties structurées via des schémas Pydantic. Cependant, ces implémentations étaient des scripts par lots/CLI mono-utilisateur et synchrones : une entrée était envoyée, le thread se bloquait en attendant une réponse, puis le script se terminait.

Les produits d'IA du monde réel ne fonctionnent pas sous des contraintes synchrones mono-utilisateur. Ils doivent servir des dizaines à des milliers d'utilisateurs simultanés — où chaque connexion active invoque un LLM dont la génération de réponse prend des secondes, voire des dizaines de secondes.

**Le Projet 3 marque votre transition vers l'ingénierie complète de produits d'IA (Full-Stack AI Product Engineering).**

Vous allez construire une application web complète prêt pour la production, à faible latence, dotée d'un backend FastAPI non bloquant (ASGI) connecté à une interface interactive React via Server-Sent Events (SSE). Le mandat principal est d'éliminer les bugs de saturation de threads (*thread starvation*), de réduire le temps d'apparition du premier token (TTFT) à moins de 100 ms et de maintenir le débit du système indépendamment de la charge d'utilisateurs concurrents.

Ce projet évalue votre maîtrise de :

1. Python asynchrone non bloquant de bout en bout (`asyncio`, planification de la boucle d'événements ASGI).
2. Protocoles de streaming (SSE vs WebSockets) et consommation de flux côté client à l'aide des standards web.
3. Gestion défensive du pool de connexions backend et orchestration des timeouts/retries en amont.
4. Isolation des requêtes concurrentes (empêcher les pics de latence mono-client de paralyser les workers multi-clients).

---

## 2. Stack technique & architecture système

### Schéma d'architecture système

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   NAVIGATEUR / CLIENT                                  │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                              Frontend React (Vite)                               │  │
│  │                                                                                  │  │
│  │   [UI Optimiste] ──► [Fetch + ReadableStream] ──► [Tampon] ──► [Rendu Tokens]     │  │
│  └──────────────────────────────┬──────────────────────────▲────────────────────────┘  │
└─────────────────────────────────┼──────────────────────────┼───────────────────────────┘
                                  │                          │
           1. POST /api/chat/stream │                          │ 2. text/event-stream
              (Payload de Chat)   │                          │    (Chunks: data: {...}\n\n)
                                  ▼                          │
┌────────────────────────────────────────────────────────────┼───────────────────────────┐
│                               BACKEND FASTAPI (ASGI)       │                           │
│                                                            │                           │
│  ┌─────────────────────────────────────────────────────────┴────────────────────────┐  │
│  │                     Serveur ASGI Uvicorn (Boucle Single-Thread)                  │  │
│  │                                                                                  │  │
│  │  ┌──────────────────────┐   ┌───────────────────────┐   ┌─────────────────────┐  │  │
│  │  │ Route Chat (Async)   │──►│ Générateur de Flux   │──►│  StreamingResponse  │  │  │
│  │  └──────────────────────┘   └───────────────────────┘   │ (X-Accel-Buffering) │  │  │
│  │                                                         └─────────────────────┘  │  │
│  └──────────────────────────────────────┬───────────────────────────────────────────┘  │
└─────────────────────────────────────────┼──────────────────────────────────────────────┘
                                          │
                                          │ 3. Flux Socket Async
                                          │    (AsyncOpenAI / httpx.AsyncClient)
                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                    API LLM EN AMONT                                    │
│                                (API OpenAI / Anthropic)                                │
└────────────────────────────────────────────────────────────────────────────────────────┘

```

### Matrice des technologies

| Couche | Composant | Standard de sélection | Justification / Règles non négociables |
| --- | --- | --- | --- |
| **Framework Backend** | Python 3.11+ / FastAPI | `FastAPI` (v0.110+) | Stack ASGI native Starlette ; intégration stricte avec les schémas Pydantic V2. |
| **Serveur ASGI** | Uvicorn | `uvicorn` | Exécuteur de boucle d'événements haute performance basé sur `uvloop` et `httptools`. |
| **Client LLM** | SDK Async / `httpx` | `AsyncOpenAI` ou `httpx.AsyncClient` | **Règle stricte non négociable :** Toute utilisation de clients synchrones (`requests`, `OpenAI()` synchrone) dans des routes `async def` entraîne le rejet immédiat du projet. |
| **Protocole de Streaming** | HTTP SSE | Server-Sent Events (`text/event-stream`) | Transport unidirectionnel de tokens du serveur vers le client ; léger sur HTTP standard sans le surcoût de poignée de main ni d'état des WebSockets. |
| **Framework Frontend** | React 18+ | TypeScript + Vite | Typage explicite pour les payloads de chat, les tampons de lignes SSE et les états de connexion. |
| **Styles** | Tailwind CSS | CSS Utility-first | Permet un aménagement typographique fluide, des indicateurs de streaming et le positionnement des bulles de message. |
| **Gestion des dépendances** | Poetry | `pyproject.toml` | Builds déterministes imposés par fichier verrou (*lockfile*) pour des environnements reproductibles. |
| **Contrôle qualité** | Ruff + Mypy | Mode Strict (`--strict`) | Tolérance zéro aux avertissements sur les annotations de type et règles de linter non bloquantes. |

---

## 3. Exigences fonctionnelles & techniques

### 3.1 Exigences fonctionnelles

1. **Interface de conversation interactive :**
* Zone de texte (*textarea*) avec saisie multi-ligne (Maj+Entrée pour un saut de ligne, Entrée pour soumettre).
* Historique du fil de conversation conservé pendant la session utilisateur.
* Défilement automatique (*auto-scroll*) jusqu'à la dernière trame de token, se mettant automatiquement en pause si l'utilisateur remonte manuellement.


2. **Retour visuel immédiat (Réduction du TTFT) :**
* Dès la soumission d'un message, le prompt de l'utilisateur s'affiche instantanément sur l'UI (mise à jour UI optimiste).
* Une animation de "réflexion" s'active immédiatement jusqu'à l'arrivée du premier bloc (*chunk*) de token.
* Le texte de réponse s'affiche de manière incrémentale (effet machine à écrire) sans effacer ni réafficher tout le bloc à chaque chunk.


3. **Annulation de flux en cours d'exécution :**
* Un bouton "Arrêter la génération" s'affiche pendant que le streaming est actif.
* Cliquer sur "Arrêter la génération" annule la requête `Fetch` du client via un `AbortController`, signale le socket backend et ferme immédiatement les ressources de connexion.


4. **Gestion du contexte multi-tours :**
* Le client maintient un tableau d'historique de chat local `[{role: 'user'|'assistant', content: string}]` et renvoie la totalité du payload de la fenêtre au serveur à chaque itération.



---

### 3.2 Exigences techniques & règles d'architecture

1. **Chemin d'exécution non bloquant :**
* Tous les gestionnaires d'API doivent être implémentés avec `async def`.
* Sous aucun prétexte des E/S synchrones (`time.sleep()`, `requests.post()`, drivers de BDD synchrones) ne doivent être appelées dans la boucle d'événements.
* Les opérations gourmandes en CPU (ex. parsing de tokens ou transformations locales du payload) doivent être déportées vers des exécuteurs de threads via `asyncio.to_thread()` ou `loop.run_in_executor()`.


2. **Réutilisation des connexions & gestion du cycle de vie :**
* Le backend doit maintenir une instance unique et mutualisée du client LLM asynchrone (`httpx.AsyncClient` ou `AsyncOpenAI`) initialisée dans le gestionnaire de contexte `lifespan` de FastAPI.
* Les connexions clients doivent être fermées proprement lors de l'arrêt de l'application.


3. **Résilience en amont & gestion des erreurs :**
* Le générateur backend doit gérer proprement les timeouts en amont, les réponses de limitation de débit (HTTP 429) et l'absence d'identifiants.
* Les erreurs survenant en cours de flux doivent produire un événement d'erreur SSE structuré (`event: error\ndata: {"error": "..."}\n\n`) plutôt que de couper la connexion socket de manière inattendue.


4. **Désactivation de la mise en tampon par les proxys :**
* Le backend doit émettre les en-têtes `X-Accel-Buffering: no` et `Cache-Control: no-cache` sur tous les objets `StreamingResponse` pour empécher les reverse proxies (ex. Nginx) de regrouper les tokens en rafales lourdes et tardives.



---

## 4. Guide d'implémentation étape par étape

### Étape 1 : Plan de la structure du projet

Imposez une structure de projet modulaire séparant les modèles de domaine, les wrappers de service, les routes d'API et les composants frontend :

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

### Étape 2 : Implémentation du Backend

#### `backend/app/schemas/chat.py`

Définissez des structures Pydantic me stricte pour les trames de données entrantes et sortantes.

```python
from typing import List, Literal, Optional
from pydantic import BaseModel, Field

class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str = Field(..., min_length=1, description="Contenu textuel du message.")

class ChatPayload(BaseModel):
    messages: List[ChatMessage] = Field(..., min_items=1)
    model: str = Field(default="gpt-4o-mini")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)

class StreamChunk(BaseModel):
    content: Optional[str] = None
    error: Optional[str] = None

```

#### `backend/app/services/llm.py`

Implémentez l'abstraction de service non bloquante capable d'interagir avec l'API OpenAI Async réelle ou de basculer proprement sur un générateur de flux asynchrone hors ligne lorsque les identifiants sont absents.

```python
import asyncio
import json
import os
from typing import AsyncGenerator, List, Optional
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
        """Générateur asynchrone de secours pour l'exécution hors ligne et les tests locaux."""
        mock_text = (
            "Bonjour ! Je suis un assistant IA à faible latence conçu avec FastAPI et React. "
            "Je diffuse cette réponse token par token via un canal asynchrone "
            "Server-Sent Events (SSE) sans bloquer le thread worker du backend."
        )
        for word in mock_text.split(" "):
            await asyncio.sleep(0.04)  # Simule la latence du réseau non bloquante
            yield word + " "

    async def stream_chat_response(
        self, messages: List[ChatMessage], model: str, temperature: float
    ) -> AsyncGenerator[str, None]:
        """Consomme la réponse du modèle en amont et produit des chaînes SSE formatées."""
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

            # Signale la fin du flux
            yield "event: end\ndata: [DONE]\n\n"

        except Exception as exc:
            error_payload = StreamChunk(error=str(exc)).model_dump_json()
            yield f"event: error\ndata: {error_payload}\n\n"

```

#### `backend/app/main.py`

Configurez le point d'entrée ASGI, les politiques CORS, la configuration du cycle de vie des connexions et la route de streaming.

```python
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.schemas.chat import ChatPayload
from app.services.llm import LLMService

llm_service: LLMService

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    global llm_service
    # Démarrage : Initialisation de l'instance du service non bloquant
    llm_service = LLMService()
    yield
    # Arrêt : Opérations de nettoyage si nécessaire

app = FastAPI(
    title="Chatbot IA Temps Réel à Faible Latence",
    version="1.0.0",
    lifespan=lifespan,
)

# Active CORS pour le développement React local multi-origines
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/chat/stream", response_class=StreamingResponse)
async def chat_stream_endpoint(payload: ChatPayload) -> StreamingResponse:
    """Endpoint asynchrone diffusant les tokens LLM via Server-Sent Events."""
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
            "X-Accel-Buffering": "no",  # Désactive la mise en tampon par proxy (ex. Nginx)
        },
    )

@app.get("/healthz", status_code=status.HTTP_200_OK)
async def health_check() -> dict[str, str]:
    return {"status": "ok"}

```

---

### Étape 3 : Implémentation du Frontend

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

Construisez l'interface utilisateur de streaming complète à l'aide des hooks React standards et de l'API Web Streams (`ReadableStream`).

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { Message, StreamPayload } from './types/chat';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Défilement automatique vers le bas à l'arrivée des nouveaux tokens
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

    // Mises à jour optimistes de l'UI
    setMessages(updatedHistory);
    setInput('');
    setIsGenerating(true);

    // Ajoute un espace réservé vide pour le message entrant de l'assistant
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    // Initialise l'AbortController pour l'annulation du flux
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
        throw new Error(`Statut d'erreur HTTP : ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        
        // Conserve le bloc final incomplet dans le tampon
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
            console.error('Échec du parsing de la ligne de payload SSE :', line, err);
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: '\n[Génération annulée par l\'utilisateur.]' },
        ]);
      } else {
        console.error('Échec du streaming :', err);
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: '⚠️ Erreur de streaming rencontrée. Veuillez réessayer.' },
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
        <h1 className="text-2xl font-bold">Assistant IA FastAPI + React SSE</h1>
        <p className="text-sm text-gray-500">UI de Streaming Asynchrone Non Bloquante</p>
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
              {msg.content || (isGenerating && idx === messages.length - 1 ? 'Réflexion en cours...' : '')}
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
          placeholder="Saisissez votre message..."
          disabled={isGenerating}
          className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        {isGenerating ? (
          <button
            type="button"
            onClick={handleCancel}
            className="bg-red-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-red-700 transition"
          >
            Arrêter
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium disabled:opacity-50 hover:bg-blue-700 transition"
          >
            Envoyer
          </button>
        )}
      </form>
    </div>
  );
}

```

---

## 5. Cadre de vérification & de test

### 5.1 Test d'intégration automatisé de la concurrence

Pour vérifier que votre backend ne bloque pas la boucle d'événements sous une charge importante, construisez un test d'intégration asynchrone utilisant `httpx` et `pytest-asyncio`. Ce test lance plusieurs requêtes simultanées vers l'endpoint de streaming et s'assure qu'elles s'exécutent toutes en parallèle plutôt que de façon séquentielle.

#### `backend/tests/test_chat_stream.py`

```python
import time
import asyncio
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_concurrent_streaming_non_blocking() -> None:
    """Vérifie que 5 requêtes de streaming parallèles ne se bloquent pas entre elles."""
    transport = ASGITransport(app=app)
    payload = {
        "messages": [{"role": "user", "content": "Raconte-moi une histoire"}]
    }

    async def fetch_stream(client: AsyncClient) -> float:
        start = time.perf_counter()
        response = await client.post("/api/chat/stream", json=payload)
        assert response.status_code == 200
        
        # Lit le contenu complet du flux
        async for _ in response.aiter_bytes():
            pass
        return time.perf_counter() - start

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        start_all = time.perf_counter()
        
        # Exécute 5 requêtes de streaming concurrentes
        durations = await asyncio.gather(*[fetch_stream(client) for _ in range(5)])
        total_wall_clock_time = time.perf_counter() - start_all

        # Les requêtes individuelles prennent ~1,0 seconde (sleep simulé).
        # En cas de blocage, le temps total serait >= 5,0s.
        # L'exécution asynchrone termine les 5 requêtes en < 1,5 seconde.
        assert total_wall_clock_time < 2.0, (
            f"Boucle d'événements bloquée ! 5 flux parallèles ont pris {total_wall_clock_time:.2f}s."
        )

```

---

## 6. Critères d'évaluation & grille de notation

Le projet soumis sera évalué selon six capacités principales :

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           PONDÉRATION DE L'ÉVALUATION                           │
│                                                                                 │
│   [Concurrence non bloquante] ── 25%   [Performance SSE temps réel] ── 20%       │
│   [Architecture du code]      ── 20%   [UX Erreurs & Annulation]    ── 15%       │
│   [Rigueur du typage statique]── 10%   [Tests & Documentation]      ── 10%       │
└─────────────────────────────────────────────────────────────────────────────────┘

```

| Dimension d'évaluation | Poids | Spécifications cibles & critères |
| --- | --- | --- |
| **Architecture backend non bloquante** | **25%** | Absence totale d'appels bloquants (`requests`, `time.sleep`) dans les fonctions `async def`. Le backend réussit les tests de charge multi-requêtes concurrentes sans file d'attente ni saturation de la boucle d'événements. |
| **Performance SSE en temps réel** | **20%** | Le temps d'apparition du premier token (TTFT) reste inférieur à 100 ms. Les tokens sont diffusés de manière incrémentale sans regroupement par lots, retards de tampon ou réinitialisations d'état. |
| **Architecture de code propre** | **20%** | Séparation explicite des responsabilités (gestionnaires FastAPI, classes de service, définitions de schémas, composants de présentation React). Pool de connexions implémenté via le `lifespan` de l'application. |
| **UX de gestion des erreurs & d'annulation** | **15%** | Les signaux d'annulation coupent immédiatement les sockets de flux HTTP côté client et serveur. Les erreurs en cours de flux sont rendues proprement dans le fil de discussion sans casser l'UI React. |
| **Rigueur du typage statique & linting** | **10%** | Zéro erreur retournée sous `mypy --strict` et `ruff check`. Couverture complète des interfaces TypeScript sur les flux de données frontend. |
| **Tests & Documentation** | **10%** | `README.md` complet contenant les commandes d'exécution, la justification architecturale et une suite de tests automatisés de concurrence. |

---

## 7. Livrables à soumettre

Pour valider le Projet 3, soumettez un dépôt propre contenant :

1. **Code source entièrement exécutable :** Codebase complet du backend (FastAPI) et du frontend (React/TypeScript) correspondant à l'architecture spécifiée.
2. **Configuration déterministe :** Fichiers verrou valides `pyproject.toml` (Poetry) et `package.json`.
3. **Documentation `README.md` :**
* Instructions d'installation locale étape par étape pour exécuter l'application avec de vraies clés d'API ou en mode simulation (*mock*) hors ligne.
* Justification architecturale expliquant pourquoi **SSE** a été choisi plutôt que les WebSockets pour le streaming d'IA unidirectionnel.
* Capture d'écran ou logs du terminal démontrant le succès des tests `pytest` exécutés en concurrence.


4. **Suite de tests automatisés :** Suite de tests d'intégration `pytest` réussie vérifiant les performances non bloquantes de la boucle d'événements sous charge.