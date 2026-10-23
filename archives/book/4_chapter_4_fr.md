# Chapitre 4 : Architecture Backend pour l'IA : Asynchronisme et Interface UI en Streaming

Dans le développement web traditionnel, une réponse d'API prenant 200 millisecondes est déjà considérée comme lente. En ingénierie de produits IA, attendre 5 à 15 secondes pour qu'un grand modèle de langage (LLM) termine une réponse complexe est la norme. Si vous concevez une application d'IA en utilisant des modèles synchrones traditionnels, cette latence détruira votre infrastructure backend et frustrera vos utilisateurs.

Ce chapitre couvre les motifs architecturaux nécessaires pour gérer la latence de l'IA : Python asynchrone non bloquant, backends orientés événements avec FastAPI, et streaming de tokens de bout en bout utilisant les Server-Sent Events (SSE) et les WebSockets.

---

## Objectifs d'apprentissage

À la fin de ce chapitre, vous serez capable de :

* **Diagnostiquer les goulots d'étranglement architecturaux :** Expliquer pourquoi les frameworks WSGI synchrones s'effondrent face à la latence de l'IA.
* **Maîtriser Python asynchrone :** Écrire des coroutines non bloquantes avec `asyncio` et `httpx` sans bloquer la boucle d'événements (event loop).
* **Construire des microservices d'IA scalables :** Concevoir des applications FastAPI gérant les opérations d'E/S (I/O) concurrentes et l'assemblage de contexte.
* **Mettre en œuvre le streaming de bout en bout :** Construire des pipelines de streaming de tokens en utilisant Server-Sent Events (SSE) et WebSockets.
* **Optimiser la latence perçue :** Réduire le temps avant le premier token (TTFT - Time-To-First-Token) et gérer les signaux d'annulation de manière défensive.

---

## 4.1 La révolution architecturale : Pourquoi le code synchrone échoue face à la latence de l'IA

### Le changement de paradigme de la latence

Les backends web traditionnels passent la majeure partie de leur temps à exécuter des instructions CPU ou à récupérer des enregistrements en base de données, opérations mesurées en millisecondes. Les applications d'IA passent presque tout leur temps d'exécution à attendre des endpoints d'API externes.

| Type d'opération | Latence typique | Goulot d'étranglement principal |
| --- | --- | --- |
| **Requête SQL indexée** | 1 ms – 50 ms | E/S Base de données / Indexation |
| **API REST standard** | 50 ms – 300 ms | Réseau / Logique métier |
| **Génération LLM (non streamée)** | 2 000 ms – 30 000 ms | Attente de l'inférence externe |
| **Workflow agentique multi-étapes** | 10 000 ms – 120 000 ms | Raisonnement séquentiel & Exécution d'outils |

Un appel à un LLM n'est pas simplement une requête SQL lente. Il s'agit d'une opération d'un tout autre ordre de grandeur. Il se comporte comme un traitement par lots (batch job), alors que les utilisateurs s'attendent à ce qu'il réponde comme une interface conversationnelle en temps réel.

---

### Le goulot d'étranglement synchrone (WSGI)

Dans les architectures traditionnelles de type WSGI (Web Server Gateway Interface), comme Flask ou Django s'exécutant derrière Gunicorn, les requêtes HTTP entrantes sont attribuées à des threads ou processus de travail (worker threads) dédiés. Un thread prend une requête, effectue le travail, attend une réponse externe, envoie le résultat, puis retourne dans le pool.

```text
Modèle Bloquant Synchrone (WSGI)

Thread 1 : [--- Requête SQL (10ms) ---][--- Rendu HTML (2ms) ---] (Libre)
Thread 2 : [---------------- Appel API LLM (8 000ms) ----------------] (BLOQUÉ)
Thread 3 : [---------------- Appel API LLM (12 000ms) ---------------] (BLOQUÉ)
Thread 4 : [---------------- Appel API LLM (6 000ms) ----------------] (BLOQUÉ)
Pool de Workers Épuisé -> Requête Entrante 5 -> HTTP 504 Gateway Timeout / Connexion Refusée

```

Lorsqu'un gestionnaire HTTP appelle une API de LLM de manière synchrone (par exemple via `requests.post()` ou un SDK synchrone), le thread du système d'exploitation entre dans un état d'attente d'E/S pendant plusieurs secondes ou minutes.

Puisque les threads de l'OS sont bloqués dans l'attente des paquets réseau en provenance du fournisseur de modèle, trois modes de défaillance surviennent :

1. **Shat de threads (Thread Starvation) :** Un serveur configuré avec 16 threads workers peut gérer au maximum 16 utilisateurs simultanés. La 17ᵉ requête est mise en attente ou s'interrompt par timeout, même si l'utilisation du CPU et de la mémoire reste proche de 0 %.
2. **Inefficacité des coûts :** L'extensibilité horizontale (horizontal scaling) pour gérer des milliers de requêtes concurrentes bloquées en E/S nécessite des milliers de threads OS lourds, ce qui augmente inutilement les coûts d'infrastructure.
3. **Taux de rebond élevé :** Les utilisateurs se retrouvent face à un indicateur de chargement fixe pendant 10 secondes avant de voir le moindre contenu, provoquant des taux d'abandon supérieurs à 40 %.

---

### La solution asynchrone (ASGI)

Les interfaces ASGI (Asynchronous Server Gateway Interfaces) résolvent la saturation des threads grâce au multitâche coopératif géré par une **boucle d'événements** (*event loop*).

```text
Modèle de Boucle d'Événements Asynchrone (ASGI)

Event Loop (Thread Unique) :
[Req 1: Appel LLM] -> Cède le contrôle -> [Req 2: Lecture DB] -> Cède -> [Req 1: Token Reçu] -> Cède -> [Req 3: Appel LLM] ...
Résultat : 1 seul thread gère 10 000+ attentes d'E/S concurrentes sans bloquer.

```

Lorsque votre backend envoie une requête HTTP à un fournisseur de LLM en utilisant un client asynchrone (tel que `httpx.AsyncClient` ou `AsyncOpenAI`), il cède le contrôle d'exécution à la boucle d'événements au moyen du mot-clé `await`. La boucle d'événements passe ensuite au traitement d'autres requêtes entrantes pendant qu'elle attend que les sockets réseau reçoivent des données.

---

### Latence vs Débit

Dans les systèmes d'IA, la latence et le débit représentent deux vecteurs opérationnels distincts :

* **Latence :** Le temps total écoulé (temps horloge) pour traiter une seule requête (ex. $6\text{ secondes}$).
* **Débit (Throughput) :** Le nombre de requêtes simultanées que le système traite en parallèle (ex. $1\text{ }000\text{ requêtes simultanées/sec}$).

Une architecture asynchrone ne peut pas réduire la latence d'inférence brute d'un modèle LLM tiers. En revanche, elle maximise le débit du système, garantissant qu'une génération longue n'interrompt ni ne bloque le trafic entrant non lié.

---

## 4.2 Les bases de Python asynchrone (`asyncio`) et FastAPI

Pour écrire des services d'IA non bloquants, vous devez comprendre comment la boucle d'événements `asyncio` de Python gère les coroutines et comment FastAPI exécute les fonctions d'endpoints.

```text
Fonction Coroutine (async def)
       │
       ▼
Encapsulation en Tâche (asyncio.create_task)
       │
       ▼
Planification dans la Boucle ──(await)──► Cède l'exécution pendant l'attente d'E/S
       │
       ▼
Reprise de l'exécution dès la fin de l'E/S

```

### Les règles d'or du code non bloquant

1. **Ne JAMAIS exécuter d'E/S bloquantes dans une route `async def` :** Utiliser `requests.get()`, `time.sleep()`, ou des pilotes de base de données synchrones (ex. `psycopg2` standard) à l'intérieur d'un gestionnaire `async def` gèle l'ensemble de la boucle d'événements, arrêtant toutes les connexions actives.
2. **Utiliser des clients natifs asynchrones :** Utilisez `httpx` à la place de `requests`, `asyncpg` ou `SQLAlchemy[asyncio]` au lieu de drivers DB synchrones, et `asyncio.sleep()` au lieu de `time.sleep()`.
3. **Déporter les calculs lourds en CPU :** Les opérations gourmandes en CPU (ex. calculs vectoriels complexes, tokenisation ou inférences de modèles locaux) bloquent l'exécution du thread. Déportez-les vers des pools de workers en arrière-plan.

```python
import asyncio
import time
from fastapi import FastAPI
import httpx

app = FastAPI()

# ❌ INCORRECT : Appel synchrone bloquant dans une route async
@app.post("/bad-async")
async def bad_async():
    # BLOQUE L'ENSEMBLE DE LA BOUCLE D'ÉVÉNEMENTS pendant 5 secondes
    time.sleep(5)
    return {"status": "done"}

# ✅ CORRECT : Pause asynchrone cédant le contrôle à la boucle d'événements
@app.post("/good-async")
async def good_async():
    await asyncio.sleep(5)
    return {"status": "done"}

# ⚠️ ACCEPTABLE : Route synchrone prise en charge via un pool de threads
@app.post("/sync-fallback")
def sync_fallback():
    # FastAPI déporte automatiquement les endpoints 'def' classiques vers un pool de threads
    time.sleep(5)
    return {"status": "done"}

```

---

### Motifs de concurrence pour l'assemblage de contexte IA

Les applications d'IA agrègent souvent du contexte provenant de plusieurs services en amont (ex. bases de données relationnelles, bases vectorielles et modèles de permissions utilisateur) avant de construire un prompt. Réaliser cela de manière séquentielle entraîne une latence cumulative :

$$t_{\text{total}} = t_1 + t_2 + t_3$$

L'exécution simultanée de tâches d'E/S indépendantes limite le temps d'attente global à l'opération la plus lente :

$$t_{\text{total}} = \max(t_1, t_2, t_3)$$

```python
import asyncio
import time
from typing import Dict, Any, List

async def fetch_user_profile(user_id: str) -> Dict[str, Any]:
    await asyncio.sleep(0.10)  # Simule la latence DB (100ms)
    return {"user_id": user_id, "tier": "enterprise"}

async def fetch_vector_context(query: str) -> List[str]:
    await asyncio.sleep(0.25)  # Simule la latence de la base vectorielle (250ms)
    return ["Chunk A: Contexte RAG", "Chunk B: Directives Système"]

async def fetch_conversation_history(session_id: str) -> List[Dict[str, str]]:
    await asyncio.sleep(0.15)  # Simule la latence du cache Redis (150ms)
    return [{"role": "user", "content": "Bonjour"}]

async def assemble_llm_payload(user_id: str, session_id: str, query: str) -> Dict[str, Any]:
    # Exécute les trois opérations d'E/S indépendantes de manière concurrente
    profile, context, history = await asyncio.gather(
        fetch_user_profile(user_id),
        fetch_vector_context(query),
        fetch_conversation_history(session_id)
    )
    
    # Le temps total écoulé est d'environ 250ms (max) au lieu de 500ms (somme)
    return {
        "profile": profile,
        "context": context,
        "history": history,
        "query": query
    }

```

---

### Workflows gourmands en CPU et exécution sur Thread Pool

Si votre microservice d'IA doit exécuter des opérations locales intensives en CPU (telles que le comptage de tokens, des opérations matricielles ou le parsing de fichiers JSON volumineux), exécutez-les en dehors du thread principal de la boucle d'événements à l'aide d'un pool d'exécuteurs (*executor pool*).

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor
from fastapi import FastAPI

app = FastAPI()
executor = ThreadPoolExecutor(max_workers=4)

def heavy_tokenization_sync(text: str) -> int:
    # Simule un traitement de chaîne gourmand en CPU ou un comptage de tokens
    count = len(text.split()) # Calcul d'exemple
    return count

@app.post("/tokenize")
async def tokenize_endpoint(text: str):
    loop = asyncio.get_running_loop()
    # Déporte le travail CPU vers le pool de threads, laissant la boucle principale disponible
    token_count = await loop.run_in_executor(executor, heavy_tokenization_sync, text)
    return {"tokens": token_count}

```

---

### Bonnes pratiques pour la gestion des pools de connexions

Créer et détruire des connexions client HTTP à chaque requête introduit un surcoût d'allocation de sockets ainsi qu'une latence liée aux poignées de main (handshakes) TCP/TLS. Gérez toujours des pools de connexions globaux au niveau du cycle de vie de votre application ASGI.

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
import httpx

# Instance partagée du client
http_client: httpx.AsyncClient = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global http_client
    # Initialisation du pool de connexions au démarrage de l'application
    http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(30.0, connect=5.0),
        limits=httpx.Limits(max_keepalive_connections=50, max_connections=200)
    )
    yield
    # Fermeture propre des connexions à l'arrêt de l'application
    await http_client.aclose()

app = FastAPI(lifespan=lifespan)

```

---

## 4.3 Architectures de streaming de bout en bout : SSE vs WebSockets

Attendre qu'un LLM génère une réponse complète de 1 000 tokens oblige les utilisateurs à patienter plusieurs secondes avant de voir le moindre résultat. Transmettre les tokens en streaming au fur et à mesure de leur génération fait chuter le temps d'apparition du premier token (TTFT) de plusieurs secondes à quelques millisecondes.

```text
Requête-Réponse Traditionnelle :
Client  ──[ Requête POST ]──► Serveur ──[ Attente 8 Secondes ]──► Client (Affiche le texte complet)

Réponse en Streaming :
Client  ──[ Requête POST ]──► Serveur ──► Token 1 ("B")    ──► Client (Affiche "B")
                                     ──► Token 2 ("onjour") ──► Client (Affiche "Bonjour")
                                     ──► Token 3 (" !")     ──► Client (Affiche "Bonjour !")

```

### Comparaison des protocoles

| Fonctionnalité | Server-Sent Events (SSE) | WebSockets |
| --- | --- | --- |
| **Protocole** | HTTP Standard / HTTP/2 (`text/event-stream`) | WS / WSS (Connexion TCP persistante et surévaluée) |
| **Directionnalité** | Unidirectionnel (Serveur $\rightarrow$ Client) | Full Duplex (Serveur $\leftrightarrow$ Client) |
| **Format des données** | Texte brut UTF-8 / Blocs de données structurés | Flux Texte, JSON et Binaire |
| **Reconnexion** | Reconnexion automatique gérée nativement par le client | Logique de reconnexion manuelle requise |
| **Infrastructure** | Fonctionne nativement avec les reverse proxies et CDNs standard | Nécessite des sessions persistantes (sticky sessions) et du routage spécifique |
| **Cas d'usage principaux** | Génération de texte, rapports en streaming, génération de code | Flux audio/voix en temps réel, éditions collaboratives, annulation immédiate |

---

## 4.4 Implémentation des Server-Sent Events (SSE) dans FastAPI

Les Server-Sent Events sont particulièrement adaptés au streaming de texte d'IA. Le client émet une requête HTTP POST classique, et le serveur maintient la connexion ouverte tout en délivrant des fragments structurés au format `text/event-stream`.

### Structure du protocole de message SSE

Un flux SSE est constitué de champs de texte UTF-8 séparés par des caractères de saut de ligne (`\n`), et terminés par deux sauts de ligne consécutifs (`\n\n`) :

```text
event: message
data: {"content": "Bonjour"}

event: message
data: {"content": " le monde"}

event: end
data: [DONE]

```

---

### Implémentation FastAPI en production

L'application FastAPI complète ci-dessous consomme un générateur de tokens asynchrone et renvoie les réponses SSE au client en utilisant `StreamingResponse`.

```python
import json
import asyncio
from typing import AsyncGenerator
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

app = FastAPI()

class ChatRequest(BaseModel):
    prompt: str

async def mock_llm_stream_engine(prompt: str) -> AsyncGenerator[str, None]:
    """Simule un générateur de tokens asynchrone issu d'un SDK de LLM."""
    tokens = ["Bonjour", " !", " Je", " suis", " un", " moteur", " d'architecture", " backend", " IA."]
    for token in tokens:
        await asyncio.sleep(0.06)  # Simule la latence réseau/inférence entre les tokens
        yield token

async def sse_event_generator(prompt: str) -> AsyncGenerator[str, None]:
    """Formate la sortie brute du modèle en messages SSE structurés."""
    try:
        async for token in mock_llm_stream_engine(prompt):
            payload = json.dumps({"content": token})
            # Formatage selon la norme SSE
            yield f"event: message\ndata: {payload}\n\n"
        
        # Signal de fin de flux
        yield "event: end\ndata: [DONE]\n\n"
    except Exception as e:
        error_payload = json.dumps({"error": str(e)})
        yield f"event: error\ndata: {error_payload}\n\n"

@app.post("/api/v1/chat/stream")
async def stream_chat(request: ChatRequest):
    return StreamingResponse(
        sse_event_generator(request.prompt),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Essentiel : Empêche Nginx/proxies de mettre en tampon le flux
        }
    )

```

> **Avertissement sur la configuration des Reverse Proxies :** Par défaut, les reverse proxies comme Nginx mettent en tampon (buffer) les réponses descendantes avant de les envoyer au client. Cela rompt le streaming et fait arriver les tokens par blocs saccadés. Transmettez toujours l'en-tête `X-Accel-Buffering: no` et définissez explicitement `proxy_buffering off;` dans la configuration du proxy.

---

## 4.5 Implémentation des WebSockets pour des interactions IA bidirectionnelles

Utilisez les WebSockets lorsque le client doit envoyer des données en continu au serveur (comme des segments audio ou des signaux d'annulation) sur un socket TCP unique et persistant.

```python
import json
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

app = FastAPI()

class ConnectionManager:
    """Gère et suit les connexions WebSocket actives des clients."""
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

manager = ConnectionManager()

@app.websocket("/ws/chat")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Réception de la trame d'entrée client
            raw_data = await websocket.receive_text()
            data = json.loads(raw_data)
            user_prompt = data.get("prompt", "")

            # Transmet les tokens en retour sur la connexion WebSocket ouverte
            mock_tokens = ["Traitement : ", user_prompt, " -> ", "Analyse ", "Terminée."]
            for token in mock_tokens:
                await asyncio.sleep(0.08)
                await websocket.send_json({
                    "type": "token",
                    "value": token
                })
            
            # Envoi du signal de fin
            await websocket.send_json({"type": "status", "value": "FINISHED"})
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        await websocket.send_json({"type": "error", "message": str(e)})
        manager.disconnect(websocket)

```

---

### Signaux d'annulation via WebSockets

L'un des avantages des WebSockets par rapport au simple SSE est la gestion des interruptions utilisateur. Si un utilisateur stoppe la génération de texte au milieu du flux, le client peut envoyer un message d'annulation sur le même socket pour interrompre immédiatement la tâche sur l'API du LLM.

```python
# Motif de gestion de tâches pour intercepter l'annulation en cours de flux
active_tasks = {}

async def run_cancellable_generation(websocket: WebSocket, prompt: str, task_id: str):
    try:
        tokens = ["Analyse", " du grand", " contexte", " en cours...", " Terminé."]
        for token in tokens:
            await asyncio.sleep(0.2)
            await websocket.send_json({"type": "token", "value": token})
    except asyncio.CancelledError:
        # Nettoyage des ressources lors de l'annulation de l'exécution
        await websocket.send_json({"type": "status", "value": "CANCELLED"})
        raise

```

---

## 4.6 Stratégies de consommation de tokens côté Frontend

Puisque les prompts d'IA nécessitent des requêtes HTTP POST contenant des payloads JSON et des en-têtes d'authentification, les frontends modernes consomment les flux SSE en combinant l'API `Fetch` et l'interface `ReadableStream`.

```typescript
interface StreamPayload {
  content?: string;
  error?: string;
}

async function streamAIResponse(
  promptText: string, 
  onToken: (token: string) => void
): Promise<void> {
  const response = await fetch('/api/v1/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: promptText }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Le serveur a retourné l'état d'erreur HTTP : ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // Décode le segment binaire actuel et l'ajoute au tampon
    buffer += decoder.decode(value, { stream: true });

    // Extrait les trames de messages SSE complètes séparées par \n\n
    const lines = buffer.split('\n\n');
    
    // Conserve tout bloc d'événement partiel et non terminé dans le tampon
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      const eventMatch = line.match(/^event:\s*(.+)$/m);
      const dataMatch = line.match(/^data:\s*(.+)$/m);

      const eventType = eventMatch ? eventMatch[1] : 'message';
      const rawData = dataMatch ? dataMatch[1] : '';

      if (rawData === '[DONE]' || eventType === 'end') {
        return;
      }

      if (eventType === 'message' && rawData) {
        try {
          const parsed: StreamPayload = JSON.parse(rawData);
          if (parsed.content) {
            onToken(parsed.content);
          }
        } catch (err) {
          console.error("Échec du parsing du segment JSON du payload SSE", err);
        }
      }
    }
  }
}

```

---

## 4.7 Architecture Middleware IA tolérante à la latence

Pour faire évoluer les applications de streaming à haute concurrence, intégrez ces techniques asynchrones, la collecte concurrente de contexte et les mécanismes de diffusion d'événements dans une architecture de pipeline unifiée :

```text
[ Client Frontend / Navigateur ]
             │
             │ Requête HTTP POST (Payload & Demande de Stream)
             ▼
[ Reverse Proxy / API Gateway (Nginx) ] ── (X-Accel-Buffering: no)
             │
             │ Connexion Socket Non Bloquante
             ▼
[ Application FastAPI (Boucle d'Événements Async ASGI) ]
             │
             ├─► [ asyncio.gather ] ──► Récupération concurrente : Base Vectorielle + DB SQL
             │
             └─► [ Client SDK LLM Async (httpx) ]
                               │
                               │ Flux de Tokens Asynchrone (HTTP/2 SSE)
                               ▼
                   [ Tampon de Chunks de la Boucle d'Événements ]
                               │
                               └─► [ Émission des trames de données SSE au Client ]

```

---

## Résumé du chapitre

Le développement axé sur l'IA modifie les principes économiques des backends web. Contrairement aux applications web traditionnelles qui exécutent des calculs locaux rapides, les systèmes d'IA passent la majeure partie de leur durée d'exécution en attente de fournisseurs externes. Traiter ces périodes d'attente comme des opportunités de concurrence non bloquante est essentiel pour concevoir des logiciels réactifs et scalables.

* **La programmation asynchrone évite la saturation des ressources :** La boucle d'événements `asyncio` de Python permet à un seul thread de gérer des milliers d'attentes d'E/S simultanées sans bloquer la capacité du serveur.
* **FastAPI intègre un support asynchrone natif :** Les endpoints déclarés avec `async def` s'exécutent directement sur la boucle d'événements, tandis que les fonctions synchrones peuvent être déportées vers des pools de threads.
* **Le streaming améliore la latence perçue :** Les Server-Sent Events (SSE) réduisent le délai d'obtention du premier token (TTFT) en transmettant les tokens dès leur génération sur du protocole HTTP standard.
* **Les WebSockets permettent une communication bidirectionnelle :** Les connexions WebSockets persistantes sont adaptées aux cas où les clients doivent envoyer des données au serveur en continu ou transmettre des signaux d'annulation en cours de génération.

---

## Liste de contrôle des bonnes pratiques

* [ ] Utiliser par défaut des endpoints `async def` pour tous les gestionnaires d'API d'IA effectuant des E/S.
* [ ] Remplacer les bibliothèques HTTP synchrones comme `requests` par des alternatives natives asynchrones telles que `httpx`.
* [ ] Éviter d'exécuter du code gourmand en CPU directement sur la boucle d'événements ; déporter ces traitements vers des pools de threads d'exécution.
* [ ] Maintenir des pools de connexions client réutilisables à l'échelle globale via le gestionnaire de cycle de vie (*lifespan*) de FastAPI.
* [ ] Inclure l'en-tête de réponse `X-Accel-Buffering: no` sur toutes les réponses en streaming pour éviter les problèmes de mise en tampon par les proxies.
* [ ] Encapsuler les tâches en amont indépendantes (ex. requêtes SQL et recherches vectorielles) avec `asyncio.gather()` pour réduire la latence totale.
* [ ] Mettre en place une gestion défensive des erreurs et propager rapidement l'annulation des tâches lorsque les utilisateurs se déconnectent.