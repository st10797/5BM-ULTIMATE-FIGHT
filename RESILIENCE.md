# Battaglia Navale Smash v5.2 — Resilienza Massima

## Panoramica

La versione v5.2 implementa un'architettura **server-authoritative** con **resilienza massima** per garantire connessioni stabili, recovery automatico e sincronizzazione deterministica anche in condizioni di rete instabile.

## Architettura Resilienza

### 1. Session Token Persistente

**Client (localStorage):**
```javascript
const sessionToken = localStorage.getItem('sessionToken') || generateNewToken();
localStorage.setItem('sessionToken', sessionToken);
```

**Server (in-memory, scalabile con Redis):**
```javascript
const sessions = new Map(); // token → { playerId, lastRoom, updatedAt }
```

**Benefici:**
- Ripresa automatica post-disconnessione
- Mantiene lo stato del giocatore anche se il socket cade
- Idempotente: join multipli della stessa stanza non creano duplicati

### 2. ConnectionStateRecovery (Socket.IO v4)

**Server Config:**
```javascript
const io = new Server(http, {
  connectionStateRecovery: {
    maxDisconnectionDuration: 30000, // 30 secondi
    skipMiddlewares: false
  }
});
```

**Cosa fa:**
- Conserva i messaggi non consegnati per 30 secondi
- Se il client si riconnette entro la finestra, riceve i messaggi persi
- Evita desync durante brevi disconnessioni

### 3. Auto-Reconnect con Backoff Esponenziale + Jitter

**Client Backoff Strategy:**
```javascript
function calculateBackoff(attempt) {
  const base = Math.min(30000, 1000 * Math.pow(2, attempt)); // 1s, 2s, 4s, 8s, 16s, 30s...
  const jitter = Math.floor(Math.random() * 500); // ±500ms
  return base + jitter;
}
```

**Vantaggi:**
- Evita thundering herd (tutti i client che si riconnettono simultaneamente)
- Backoff esponenziale riduce il carico sul server
- Jitter distribuisce i tentativi nel tempo
- Max 30s tra tentativi (non infinito)

### 4. Ping/Pong Stretti

**Server Config:**
```javascript
const io = new Server(http, {
  pingInterval: 10000,  // 10 secondi
  pingTimeout: 5000     // 5 secondi
});
```

**Effetto:**
- Rileva disconnessioni rapide (entro 15 secondi)
- Evita "zombie connections" (client offline ma socket ancora attivo)
- Mantiene la connessione viva attraverso proxy/firewall

### 5. Transports Fallback

**Client Config:**
```javascript
socket = io(BACKEND_URL, {
  transports: ['websocket', 'polling'],
  // WebSocket è preferito, polling è fallback
});
```

**Scenario:**
- **WebSocket**: Fast, bidirectional, basso overhead
- **Polling**: Fallback per reti mobili/proxy aziendali che bloccano WebSocket
- Il client tenta WebSocket prima, poi passa a polling automaticamente

### 6. Resume Automatico Stanza

**Flusso:**
1. Client si disconnette
2. Server mantiene la sessione per 30 secondi
3. Client si riconnette con lo stesso token
4. Server emette `resume:room` con il codice stanza
5. Client re-subscribe agli eventi e sincronizza UI

**Codice Server:**
```javascript
io.on('connection', (socket) => {
  const sess = socket.session;
  if (sess.lastRoom) {
    socket.join(sess.lastRoom);
    socket.emit('resume:room', { code: sess.lastRoom });
  }
});
```

## Configurazione Nginx per WebSocket Stabile

### Header Essenziali

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "Upgrade";
```

**Perché:**
- Comunica al proxy che la connessione deve essere upgraddata a WebSocket
- Senza questi header, il proxy blocca la connessione

### Timeout Lunghi

```nginx
proxy_read_timeout 3600s;   # 1 ora
proxy_send_timeout 3600s;   # 1 ora
proxy_connect_timeout 60s;  # 60 secondi
```

**Perché:**
- WebSocket è una connessione long-lived
- Timeout brevi causano disconnessioni spurie
- 1 ora è sicuro per una partita

### Buffering Disabilitato

```nginx
proxy_buffering off;
proxy_request_buffering off;
```

**Perché:**
- WebSocket richiede comunicazione real-time
- Buffering introduce latenza

### Configurazione Completa

Vedi `nginx.conf` nel repository.

## Test di Resilienza

### 1. Test Disconnessione Breve

```bash
# Simulare disconnessione di 5 secondi
1. Apri DevTools → Network → Throttle (Offline)
2. Attendi 5 secondi
3. Ripristina connessione
4. Verifica: UI non si blocca, stanza riprende
```

**Risultato atteso:**
- Overlay "Riconnessione in corso..."
- Dopo 5 secondi: "Riconnesso"
- Partita continua senza interruzioni

### 2. Test Cambio Rete

```bash
# Simulare cambio da WiFi a 4G
1. Apri partita su WiFi
2. Disabilita WiFi, abilita 4G
3. Verifica: transizione fluida
```

**Risultato atteso:**
- Breve lag (< 2 secondi)
- Polling fallback se WebSocket non disponibile
- Sincronizzazione automatica

### 3. Test Timeout Lobby

```bash
# Simulare timeout di 120 secondi
1. Crea stanza
2. Non fare join per 120 secondi
3. Verifica: stanza scaduta, cleanup automatico
```

**Risultato atteso:**
- Dopo 120s: "Stanza scaduta"
- Redirect a menu
- Server elimina stanza

### 4. Test Carico (Load Test)

```bash
# Simulare 100 client simultanei
npm install -g artillery
artillery quick --count 100 --num 10 https://tuodominio.com
```

**Metriche:**
- p95 latency < 200ms
- Error rate < 1%
- Reconnect rate < 5%

## Monitoring & Alerting

### Metriche Critiche

1. **Reconnect Rate** (riconnessioni/minuto)
   - Soglia: > 10/min = anomalia
   - Azione: Check server logs, network

2. **Connection Error Rate** (errori/minuto)
   - Soglia: > 5/min = anomalia
   - Azione: Check CORS, SSL, firewall

3. **Ping Latency** (p95)
   - Soglia: > 500ms = degradazione
   - Azione: Check network, server load

4. **Session Recovery Success Rate**
   - Soglia: < 95% = anomalia
   - Azione: Check ConnectionStateRecovery config

### Logging

**Server:**
```
[2026-03-14T10:00:00Z] [INFO] [CONNECT] Socket abc123 connesso con token xyz789...
[2026-03-14T10:00:05Z] [WARN] [DISCONNECT] Socket abc123 disconnesso (ping timeout)
[2026-03-14T10:00:08Z] [INFO] [RESUME] Socket abc123 ripreso in stanza H7Q9
```

**Client:**
```
[MP] [CONNECT] Socket connesso: socket_id_xyz
[MP] [DISCONNECT] Connessione persa: transport close
[MP] [RECONNECT_ATTEMPT] Tentativo 1, delay: 1523ms
[MP] [RECONNECT] Riconnesso dopo 1 tentativi
```

## Deployment Checklist

- [ ] Nginx configurato con Upgrade/Connection headers
- [ ] SSL certificati validi (Let's Encrypt)
- [ ] Socket.IO con CORS, transports fallback, pingInterval/pingTimeout
- [ ] Session token persistente (localStorage/PlayerPrefs)
- [ ] ConnectionStateRecovery attivo
- [ ] Auto-reconnect con backoff + jitter
- [ ] Health check endpoint (/api/health)
- [ ] Monitoring reconnect rate
- [ ] Logging strutturato (server + client)
- [ ] Sticky sessions (se multi-istanza)
- [ ] Redis adapter (se multi-istanza)

## Troubleshooting

### "Connessione persa: transport close"

**Causa:** Proxy non supporta WebSocket
**Soluzione:** Verifica Nginx headers (Upgrade, Connection)

### "Timeout: il server non risponde"

**Causa:** Server down o rete instabile
**Soluzione:** Check health endpoint, server logs

### "Impossibile riconnettersi. Ricarica la pagina."

**Causa:** Backoff max raggiunto (30 tentativi)
**Soluzione:** Server è down, riavvia e ricarica

### "Stanza scaduta: nessun giocatore ha fatto il join"

**Causa:** Guest non ha fatto join entro 120 secondi
**Soluzione:** Condividi il codice stanza più velocemente

## Performance Tuning

### Ridurre Latenza

```javascript
// Client: Aumenta frecuenza input
const UPDATE_INTERVAL = 16; // 60Hz

// Server: Aumenta frecuenza snapshot
const SNAPSHOT_RATE = 30; // 30Hz (invece di 20Hz)
```

### Ridurre Bandwidth

```javascript
// Server: Comprimi snapshot (delta compression)
const snapshot = {
  tick: room.tick,
  delta: changedPlayersOnly, // solo player che si sono mossi
};
```

### Aumentare Stabilità

```javascript
// Server: Aumenta ConnectionStateRecovery
connectionStateRecovery: {
  maxDisconnectionDuration: 60000, // 60 secondi (invece di 30)
}
```

## Roadmap Futura

- [ ] Redis adapter per multi-istanza
- [ ] GGPO rollback per fighting game
- [ ] Spectator mode con low-latency
- [ ] Replay system con deterministic seed
- [ ] Anti-cheat basato su server-authoritative
- [ ] Matchmaking con ELO rating
- [ ] Tournament mode con bracket

---

**Versione:** v5.2  
**Data:** 2026-03-14  
**Autore:** Battaglia Navale Smash Team
