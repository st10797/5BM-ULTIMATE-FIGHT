# WebSocket Fix v5.2.1 — Risoluzione Errore "WebSocket Error"

## Problema

Quando il client non si connette al server, il 99% dei casi è dovuto a uno di questi 4 errori:

1. **Protocollo sbagliato**: `ws://` invece di `wss://`
2. **Nginx non fa l'upgrade WebSocket**: Header `Upgrade` e `Connection` mancanti
3. **Server Socket.IO offline o in crash**
4. **Firewall/Porte chiuse**: Porta 3000 non raggiungibile

## Soluzione Completa v5.2.1

### 1. Client: Forzare WSS Automaticamente

**File**: `multiplayer-client.js`

```javascript
// Determina l'URL del backend con protocollo corretto
function getBackendURL() {
  if (window.BACKEND_URL) return window.BACKEND_URL;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname;
  const port = window.location.port ? ':' + window.location.port : '';
  return protocol + '//' + host + port;
}
const BACKEND_URL = getBackendURL();

// Connessione con transports fallback
socket = io(BACKEND_URL, {
  transports: ['websocket', 'polling'], // WebSocket preferito, polling fallback
  secure: window.location.protocol === 'https:',
  rejectUnauthorized: false,
  path: '/socket.io/',
  // ... altre opzioni
});

// Log del transport utilizzato
socket.on('connect', () => {
  const transport = socket.io.engine.transport.name;
  console.log('Transport:', transport); // 'websocket' o 'polling'
});
```

**Effetto:**
- Se HTTPS → usa `wss://`
- Se HTTP → usa `ws://`
- Se WebSocket fallisce → fallback a polling (HTTP long-polling)

### 2. Server: CORS Permissivo + Transports Fallback

**File**: `server.js`

```javascript
const io = socketIo(server, {
  cors: {
    origin: '*',  // Permissivo: accetta tutte le origini
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  transports: ['websocket', 'polling'],  // WebSocket preferito, polling fallback
  pingInterval: 10000,
  pingTimeout: 5000,
  path: '/socket.io/',
  serveClient: false,
  maxHttpBufferSize: 1e6,
});

// CORS Express
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors());
```

**Effetto:**
- Accetta richieste da qualsiasi origine
- Se WebSocket non disponibile, usa polling
- Nessun blocco CORS

### 3. Nginx: Header Upgrade Obbligatori

**File**: `/etc/nginx/sites-available/tuodominio.conf`

```nginx
server {
  listen 443 ssl http2;
  server_name tuodominio.com;

  ssl_certificate /etc/letsencrypt/live/tuodominio.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/tuodominio.com/privkey.pem;

  # ============================================================
  # WebSocket Upgrade Headers (OBBLIGATORI!)
  # ============================================================
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";

  # ============================================================
  # Forward Headers
  # ============================================================
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;

  # ============================================================
  # Timeout Lunghi (WebSocket)
  # ============================================================
  proxy_read_timeout 3600s;
  proxy_send_timeout 3600s;
  proxy_connect_timeout 60s;
  proxy_http_version 1.1;

  # ============================================================
  # Buffering Disabilitato
  # ============================================================
  proxy_buffering off;
  proxy_request_buffering off;

  # ============================================================
  # Socket.IO Endpoint
  # ============================================================
  location /socket.io/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }

  # ============================================================
  # API Endpoints
  # ============================================================
  location /api/ {
    proxy_pass http://127.0.0.1:3000;
  }

  # ============================================================
  # Frontend
  # ============================================================
  location / {
    proxy_pass http://127.0.0.1:5173;
  }
}
```

**Installazione:**
```bash
sudo cp nginx.conf /etc/nginx/sites-available/tuodominio.conf
sudo ln -s /etc/nginx/sites-available/tuodominio.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Checklist Troubleshooting

### ✅ 1. Verifica Protocollo

```javascript
// Nel browser DevTools Console:
console.log(window.location.protocol); // Deve essere 'https:'
console.log(window.location.hostname); // Es. 'tuodominio.com'
```

**Se HTTPS:**
- Client DEVE usare `wss://`
- Nginx DEVE avere SSL certificate valido

**Se HTTP:**
- Client può usare `ws://`
- Nginx NON ha bisogno di SSL

### ✅ 2. Verifica Nginx Headers

```bash
# Test handshake WebSocket
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \
  -H "Sec-WebSocket-Version: 13" \
  https://tuodominio.com/socket.io/?EIO=4&transport=websocket

# Deve rispondere con 101 Switching Protocols
```

### ✅ 3. Verifica Server in Vita

```bash
# Health check
curl https://tuodominio.com/health
# Deve rispondere: {"status":"ok","timestamp":"..."}

# Polling fallback
curl https://tuodominio.com/socket.io/?EIO=4&transport=polling
# Deve rispondere con dati Socket.IO
```

### ✅ 4. Verifica Firewall/Porte

```bash
# Controlla se porta 3000 è aperta
sudo ss -tulpn | grep 3000
# Deve mostrare: LISTEN 127.0.0.1:3000

# Controlla firewall
sudo ufw status
# Porta 443 deve essere ALLOW
```

### ✅ 5. Verifica DevTools Browser

1. Apri DevTools → Network
2. Filtra per `socket.io`
3. Guarda la richiesta di handshake
4. Verifica:
   - Status: **101 Switching Protocols** (WebSocket)
   - Oppure: **200 OK** (Polling fallback)
   - Headers: `Upgrade: websocket`, `Connection: Upgrade`

## Errori Comuni e Soluzioni

### Errore: "WebSocket is closed before the connection is established"

**Causa:** Nginx non sta facendo l'upgrade

**Soluzione:**
```bash
# Verifica Nginx config
sudo nginx -t

# Ricarica Nginx
sudo systemctl reload nginx

# Verifica header Upgrade
curl -v https://tuodominio.com/socket.io/ 2>&1 | grep -i upgrade
```

### Errore: "Mixed Content: The page was loaded over HTTPS, but requested an insecure resource"

**Causa:** Stai usando `ws://` invece di `wss://`

**Soluzione:** Il client v5.2.1 lo fa automaticamente, ma verifica:
```javascript
console.log(BACKEND_URL); // Deve iniziare con 'wss://'
```

### Errore: "CORS policy: No 'Access-Control-Allow-Origin' header"

**Causa:** CORS non configurato correttamente

**Soluzione:** Assicurati che server.js abbia:
```javascript
app.use(cors({ origin: '*' }));
app.options('*', cors());
```

### Errore: "Socket timeout"

**Causa:** Ping/Pong non funzionante o timeout Nginx troppo breve

**Soluzione:**
```nginx
proxy_read_timeout 3600s;  # Almeno 1 ora
proxy_send_timeout 3600s;
```

## Test di Connessione Passo per Passo

### 1. Test Locale (HTTP)

```bash
# Terminal 1: Avvia server
cd /home/ubuntu/5BM-ULTIMATE-FIGHT/battaglia_navale_smash_backend
node server.js

# Terminal 2: Apri browser
http://localhost:3000

# Verifica: Deve connettersi con WebSocket
```

### 2. Test HTTPS (con Nginx)

```bash
# Terminal 1: Avvia server
node server.js

# Terminal 2: Verifica Nginx
sudo systemctl status nginx

# Terminal 3: Apri browser
https://tuodominio.com

# Verifica: Deve connettersi con WSS
```

### 3. Test Fallback Polling

```javascript
// Nel browser DevTools Console:
// Disabilita WebSocket (DevTools → Network → Throttle → Offline)
// Ricarica pagina
// Verifica: Deve connettersi con polling
```

## Performance Tuning

### Ridurre Latenza WebSocket

```javascript
// Client
socket = io(BACKEND_URL, {
  reconnectionDelay: 500,  // Ridotto da 1000
  reconnectionDelayMax: 10000,  // Ridotto da 30000
  pingInterval: 5000,  // Ridotto da 10000
  pingTimeout: 3000,  // Ridotto da 5000
});
```

### Aumentare Stabilità Polling

```javascript
// Client
socket = io(BACKEND_URL, {
  transports: ['polling', 'websocket'],  // Polling preferito
  pollInterval: 1000,  // Polling ogni 1 secondo
});
```

## Deployment Finale

### Checklist Pre-Deploy

- [ ] Client usa `wss://` per HTTPS
- [ ] Server CORS permissivo (`origin: '*'`)
- [ ] Server transports: `['websocket', 'polling']`
- [ ] Nginx headers: `Upgrade` e `Connection`
- [ ] Nginx timeout: 3600s
- [ ] SSL certificate valido
- [ ] Firewall porta 443 aperta
- [ ] Health check risponde
- [ ] DevTools mostra 101 Switching Protocols

### Deploy Script

```bash
#!/bin/bash
set -e

echo "🔄 Aggiornamento codice..."
cd /home/ubuntu/5BM-ULTIMATE-FIGHT
git pull origin main

echo "🔄 Riavvio server..."
pm2 restart all || systemctl restart pvp-server

echo "✅ Verifica health..."
curl https://tuodominio.com/health

echo "✅ Deploy completato!"
```

## Monitoraggio Continuo

### Metriche da Monitorare

```bash
# Reconnect rate (deve essere < 5/min)
grep "RECONNECT" /var/log/pvp-server.log | wc -l

# Connection errors (deve essere < 1/min)
grep "connect_error" /var/log/pvp-server.log | wc -l

# WebSocket vs Polling ratio
grep "transport: websocket" /var/log/pvp-server.log | wc -l
grep "transport: polling" /var/log/pvp-server.log | wc -l
```

---

**Versione:** v5.2.1  
**Data:** 2026-03-14  
**Autore:** Battaglia Navale Smash Team

Se ancora non si connette dopo questi step, contatta il supporto con:
- URL del sito
- Output di `curl https://tuodominio.com/health`
- Screenshot DevTools Network
- Log del server (`/var/log/pvp-server.log`)
