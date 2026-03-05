# Battaglia Navale Smash — Backend Node.js

Server multiplayer per il gioco Battaglia Navale Smash, costruito con **Express** e **Socket.io**.

## Installazione

```bash
npm install
```

## Avvio Locale

```bash
npm start
```

Il server sarà disponibile su `http://localhost:3000`

## Struttura

- `server.js` — Server principale con Express e Socket.io
- `package.json` — Dipendenze e script

## API HTTP

### GET `/api/health`
Verifica lo stato del server.

**Risposta:**
```json
{
  "status": "ok",
  "timestamp": "2026-03-05T08:45:00.000Z",
  "activeRooms": 2,
  "connectedClients": 4
}
```

### GET `/api/rooms`
Ritorna la lista delle stanze attive (debug).

**Risposta:**
```json
[
  {
    "code": "ABC123",
    "players": [
      { "name": "Player1", "character": "Brutus", "index": 0 },
      { "name": "Player2", "character": "Tornari", "index": 1 }
    ],
    "state": "playing",
    "createdAt": "2026-03-05T08:40:00.000Z"
  }
]
```

## Socket.io Events

### Client → Server

#### `joinRoom`
Unisce il client a una stanza.

**Payload:**
```javascript
{
  roomCode: "ABC123",
  playerName: "Player1",
  character: "Brutus"
}
```

**Callback:**
```javascript
{
  success: true,
  roomCode: "ABC123",
  playerIndex: 0,
  players: [...]
}
```

#### `playerMove`
Invia l'aggiornamento di movimento del giocatore.

**Payload:**
```javascript
{
  x: 100,
  y: 200,
  vx: 5,
  vy: -3,
  facing: 1,
  damage: 45,
  isDead: false
}
```

#### `useAbility`
Notifica l'uso di un'abilità speciale.

**Payload:**
```javascript
{
  abilityType: "armata_nani",
  targetIndex: 1
}
```

#### `gameStateUpdate`
Aggiorna lo stato di gioco.

**Payload:**
```javascript
{
  damage: 50,
  stocks: 2,
  isDead: false
}
```

#### `startGame`
Richiede l'inizio della partita.

#### `endGame`
Notifica la fine della partita.

**Payload:**
```javascript
{
  winnerId: "socket-id-123",
  reason: "stocks"
}
```

### Server → Client

#### `playerJoined`
Un altro giocatore si è unito alla stanza.

#### `roomReady`
La stanza è pronta (2 giocatori presenti).

#### `playerMoved`
Riceve l'aggiornamento di movimento dell'avversario.

#### `abilityUsed`
Riceve la notifica di un'abilità usata.

#### `gameStateChanged`
Riceve l'aggiornamento dello stato di gioco.

#### `gameStarted`
La partita è iniziata.

#### `gameEnded`
La partita è terminata.

#### `playerLeft`
Un giocatore ha abbandonato.

## Deploy su Render

1. Crea un account su [Render.com](https://render.com)
2. Collega il tuo repository GitHub
3. Crea un nuovo **Web Service**
4. Configura:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment:** Node.js
5. Deploy!

L'URL del server sarà qualcosa come: `https://battaglia-navale-smash-backend.onrender.com`

## Variabili di Ambiente

- `PORT` — Porta di ascolto (default: 3000)
- `NODE_ENV` — Ambiente (development/production)

## Architettura

### Stanze (Rooms)

Ogni stanza contiene:
- **code** — Codice univoco della stanza
- **players** — Mappa dei giocatori connessi
- **state** — Stato della stanza (waiting/playing/finished)
- **gameState** — Dati di gioco (timer, stocks, ecc.)

### Giocatori (Players)

Ogni giocatore ha:
- **id** — Socket ID
- **index** — Indice (0 o 1)
- **name** — Nome del giocatore
- **character** — Personaggio selezionato
- **x, y** — Posizione
- **damage** — Danno accumulato
- **stocks** — Vite rimanenti
- **isDead** — Flag di morte

## Sincronizzazione

La sincronizzazione avviene tramite:

1. **Client invia movimento** — Ogni 50ms (20 aggiornamenti/sec)
2. **Server riceve e memorizza** — Aggiorna lo stato della stanza
3. **Server invia agli altri** — Broadcast ai giocatori nella stanza
4. **Client riceve** — Aggiorna la posizione dell'avversario

Questo approccio riduce la latenza e il traffico di rete.

## Troubleshooting

### "Socket.io non disponibile"
Assicurati che il client abbia importato `socket.io-client`:
```html
<script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
```

### "Stanza piena"
Massimo 2 giocatori per stanza. Crea una nuova stanza con un codice diverso.

### "Errore di connessione"
Verifica che il server sia in esecuzione e che l'URL sia corretto.

## Licenza

MIT
