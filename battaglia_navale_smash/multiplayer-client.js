/**
 * multiplayer-client.js — Battaglia Navale Smash Client Multiplayer v5.2
 * PvP Online Realistico: Session Recovery, Auto-reconnect con Backoff/Jitter
 *
 * RESILIENZA v5.2:
 * - Session token persistente (localStorage)
 * - Auto-reconnect con backoff esponenziale + jitter
 * - Resume automatico stanza post-disconnessione
 * - Transports fallback: ['websocket', 'polling']
 */

let socket            = null;
let isMultiplayer     = false;
let currentRoomCode   = null;
let localPlayerIndex  = null;
let remotePlayerIndex = null;
let localPlayerId     = null;
let isHost            = false;
let currentTick       = 0;
let lastUpdateTime    = 0;
const UPDATE_INTERVAL = 16;
let currentPing       = 0;
let pingIv            = null;
let reconnectAttempts = 0;
let connectionQuality = 'good';
let inLobby           = false;
let lobbyPlayers      = [];
let matchSeed         = null;
let matchStartAt      = null;
let sessionToken      = null;

// Determina l'URL del backend con protocollo corretto (WSS per HTTPS, WS per HTTP)
function getBackendURL() {
  if (window.BACKEND_URL) return window.BACKEND_URL;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname;
  const port = window.location.port ? ':' + window.location.port : '';
  return protocol + '//' + host + port;
}
const BACKEND_URL = getBackendURL();

// Backoff esponenziale con jitter
function calculateBackoff(attempt) {
  const base = Math.min(30000, 1000 * Math.pow(2, attempt));
  const jitter = Math.floor(Math.random() * 500);
  return base + jitter;
}

function initSessionToken() {
  sessionToken = localStorage.getItem('sessionToken');
  if (!sessionToken) {
    sessionToken = 'token_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('sessionToken', sessionToken);
  }
  return sessionToken;
}

function initSocket() {
  if (typeof io === 'undefined') {
    mpSetStatus('Socket.io non disponibile. Ricarica la pagina.', 'error');
    return false;
  }
  
  initSessionToken();
  mpSetStatus('Connessione al server in corso...', 'info');
  
  if (socket) { socket.removeAllListeners(); socket.disconnect(); socket = null; }
  
  socket = io(BACKEND_URL, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    randomizationFactor: 0.4,
    reconnectionAttempts: Infinity,
    timeout: 5000,
    transports: ['websocket', 'polling'], // WebSocket preferito, polling fallback
    autoConnect: true,
    upgrade: true,
    rememberUpgrade: false,
    pingInterval: 10000,
    pingTimeout: 5000,
    allowEIO3: true,
    forceNew: false,
    secure: window.location.protocol === 'https:',
    rejectUnauthorized: false,
    auth: { token: sessionToken },
    // Debug WebSocket
    path: '/socket.io/',
    query: {}
  });
  
  socket.on('connect',                onSocketConnect);
  socket.on('disconnect',             onSocketDisconnect);
  socket.on('connect_error',          onSocketError);
  socket.on('room:created',           onRoomCreated);
  socket.on('room:joined',            onRoomJoined);
  socket.on('resume:room',            onResumeRoom);
  socket.on('lobby:update',           onLobbyUpdate);
  socket.on('match:init',             onMatchInit);
  socket.on('match:start',            onMatchStart);
  socket.on('snapshot',               onSnapshot);
  socket.on('player:left',            onPlayerLeft);
  socket.on('room:cancelled',         onRoomCancelled);
  socket.on('error',                  onServerError);
  socket.on('reconnect_attempt',      onReconnectAttempt);
  socket.on('reconnect',              onReconnect);
  socket.on('reconnect_failed',       onReconnectFailed);
  socket.on('server:shutdown',        onServerShutdown);
  
  return true;
}

function onSocketConnect() {
  reconnectAttempts = 0;
  const transport = socket.io.engine.transport.name;
  mpSetStatus('Connesso al server (transport: ' + transport + ')', 'success');
  startPing();
  logMP('[CONNECT] Socket connesso:', socket.id, 'Transport:', transport);
}

function onSocketDisconnect(reason) {
  stopPing();
  const msg = reason === 'io server disconnect'
    ? 'Disconnesso dal server (riconnessione automatica...)'
    : 'Connessione persa: ' + reason;
  mpSetStatus(msg, 'warn');
  logMP('[DISCONNECT]', reason);
  
  // Se in match, mostra overlay "Riconnessione..."
  if (started && isMultiplayer) {
    showReconnectingOverlay();
  }
}

function onSocketError(err) {
  const msg = (err && err.message) ? err.message : String(err);
  let displayMsg = 'Errore connessione: ' + msg;
  if (msg.includes('timeout') || msg.includes('TIMEOUT'))
    displayMsg = 'Timeout: il server non risponde. Riprova tra qualche secondo.';
  else if (msg.includes('refused') || msg.includes('ECONNREFUSED'))
    displayMsg = 'Server non raggiungibile. Verifica la connessione internet.';
  mpSetStatus(displayMsg, 'error');
  logMP('[ERROR]', msg);
}

function onReconnectAttempt(attempt) {
  reconnectAttempts = attempt;
  const delay = calculateBackoff(attempt);
  mpSetStatus('Tentativo riconnessione ' + attempt + ' in ' + Math.round(delay / 1000) + 's...', 'warn');
  logMP('[RECONNECT_ATTEMPT]', 'Tentativo ' + attempt + ', delay: ' + delay + 'ms');
}

function onReconnect(attempt) {
  reconnectAttempts = 0;
  mpSetStatus('Riconnesso al server', 'success');
  startPing();
  logMP('[RECONNECT]', 'Riconnesso dopo ' + attempt + ' tentativi');
}

function onReconnectFailed() {
  mpSetStatus('Impossibile riconnettersi. Ricarica la pagina.', 'error');
  logMP('[RECONNECT_FAILED]', 'Riconnessione fallita');
}

function onServerShutdown(data) {
  mpSetStatus((data && data.message) ? data.message : 'Server in riavvio...', 'warn');
}

function onRoomCreated(data) {
  logMP('[ROOM_CREATED]', data);
  currentRoomCode = data.code;
  sessionToken = data.token || sessionToken;
  localStorage.setItem('sessionToken', sessionToken);
  isHost = true;
  isMultiplayer = true;
  localPlayerIndex = 0;
  remotePlayerIndex = 1;
  showMpLobby();
}

function onRoomJoined(data) {
  logMP('[ROOM_JOINED]', data);
  currentRoomCode = data.code;
  sessionToken = data.token || sessionToken;
  localStorage.setItem('sessionToken', sessionToken);
  isHost = false;
  isMultiplayer = true;
  localPlayerIndex = 1;
  remotePlayerIndex = 0;
  showMpLobby();
}

function onResumeRoom(data) {
  logMP('[RESUME_ROOM]', data);
  currentRoomCode = data.code;
  mpSetStatus('Ripresa stanza ' + currentRoomCode, 'success');
  // Re-subscribe agli eventi di gioco e sincronizza UI
  if (inLobby) {
    showMpLobby();
  }
}

function onLobbyUpdate(data) {
  logMP('[LOBBY_UPDATE]', data);
  lobbyPlayers = data.players;
  inLobby = true;
  updateLobbyUI();
}

function onMatchInit(data) {
  logMP('[MATCH_INIT]', data);
  matchSeed = data.seed;
  matchStartAt = data.startAt;
  mpSetStatus('Inizio tra: ' + data.countdown + 's', 'success');
  showCountdown(data.countdown);
}

function onMatchStart(data) {
  logMP('[MATCH_START]', data);
  // Assicurati che i personaggi siano impostati correttamente prima di avviare
  if (lobbyPlayers && lobbyPlayers.length >= 2) {
    sel1 = lobbyPlayers[0].character;
    sel2 = lobbyPlayers[1].character;
  }
  startGame();
}

function onSnapshot(data) {
  if (!isMultiplayer || !started) return;
  currentTick = data.tick;
  const snapshot = data.snapshot;
  snapshot.forEach(pData => {
    // Usa l'ID del giocatore per trovare l'indice corretto
    const pi = pData.id === localPlayerId ? localPlayerIndex : remotePlayerIndex;
    if (p[pi]) {
      const pp = p[pi];
      // Aggiorna sempre il giocatore remoto
      if (pi === remotePlayerIndex) {
        pp.x = pData.x; pp.y = pData.y; pp.vx = pData.vx; pp.vy = pData.vy;
        pp.facing = pData.f; pp.onGround = pData.g; pp.crouching = pData.c;
        pp.atkT = pData.at; pp.atkAnim = pData.aa; pp.damage = pData.d;
        pp.stocks = pData.s; pp.isDead = pData.dead;
        
        // Aggiorna HUD per il giocatore remoto
        if (typeof updPct === 'function') updPct(pi);
        if (typeof buildLives === 'function') buildLives(pi);
        if (typeof updPBar === 'function') updPBar(pi);
      } else {
        // Per il giocatore locale, sincronizza solo stocks e damage se c'è discrepanza enorme
        if (Math.abs(pp.damage - pData.d) > 10) {
          pp.damage = pData.d;
          if (typeof updPct === 'function') updPct(pi);
        }
        if (pp.stocks !== pData.s) {
          pp.stocks = pData.s;
          if (typeof buildLives === 'function') buildLives(pi);
        }
      }
    }
  });
}

function onPlayerLeft(data) {
  logMP('[PLAYER_LEFT]', data);
  mpSetStatus('L\'avversario ha abbandonato la partita', 'warn');
  isMultiplayer = false;
  if (started) { showResult(localPlayerIndex === 0 ? sel1 : sel2); }
}

function onRoomCancelled(data) {
  logMP('[ROOM_CANCELLED]', data);
  mpSetStatus('Stanza cancellata dall\'host.', 'warn');
  setTimeout(() => showTitle(), 2000);
}

function onServerError(data) {
  mpSetStatus('Errore server: ' + ((data && data.message) ? data.message : 'sconosciuto'), 'error');
}

function logMP(tag, msg) {
  console.log('[MP]', tag, msg);
}

function showMultiplayer() {
  hideAll();
  document.getElementById('screen-multiplayer').classList.remove('hidden');
  document.getElementById('mp-status').textContent = '';
  if (!socket || !socket.connected) initSocket();
  else mpSetStatus('Connesso al server', 'success');
}

function mpSetStatus(msg, type = 'info') {
  const el = document.getElementById('mp-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'mp-status mp-status-' + type;
}

function mpCreateRoom() {
  if (!socket || !socket.connected) {
    mpSetStatus('Non connesso al server. Attendi...', 'error');
    if (!socket) initSocket();
    return;
  }
  const playerName = document.getElementById('mp-name')?.value?.trim() || 'Giocatore';
  localPlayerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  socket.emit('room:create', { playerId: localPlayerId, name: playerName });
}

function mpJoinRoom() {
  if (!socket || !socket.connected) {
    mpSetStatus('Non connesso al server. Attendi...', 'error');
    if (!socket) initSocket();
    return;
  }
  const codeEl = document.getElementById('mp-room-input');
  const code   = codeEl ? codeEl.value.trim().toUpperCase() : '';
  if (!code || code.length < 4) { mpSetStatus('Inserisci un codice stanza valido (4 caratteri).', 'warn'); return; }
  const playerName = document.getElementById('mp-name')?.value?.trim() || 'Giocatore';
  localPlayerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  socket.emit('room:join', { code, playerId: localPlayerId, name: playerName });
}

function showMpLobby() {
  hideAll();
  const lobbyEl = document.createElement('div');
  lobbyEl.id = 'mp-lobby';
  lobbyEl.className = 'screen';
  lobbyEl.innerHTML = `
    <div class="mp-lobby-container">
      <div class="mp-lobby-title">LOBBY MULTIPLAYER</div>
      <div class="mp-room-code-display" id="mp-code-display">${currentRoomCode}</div>
      <div class="mp-players-list" id="mp-players-list"></div>
      <div class="mp-char-select-btn" id="mp-char-select-btn">
        <button class="mp-action-btn" onclick="showMpCharSelect()">SCEGLI PERSONAGGIO</button>
      </div>
      <div class="mp-ready-btn" id="mp-ready-btn" style="display:none">
        <button class="mp-action-btn" onclick="mpReady()">SONO PRONTO!</button>
      </div>
      <button class="res-btn" onclick="showTitle()">Esci</button>
    </div>
  `;
  document.body.appendChild(lobbyEl);
  updateLobbyUI();
}

function updateLobbyUI() {
  const list = document.getElementById('mp-players-list');
  if (!list) return;
  list.innerHTML = '';
  lobbyPlayers.forEach(p => {
    const pEl = document.createElement('div');
    pEl.className = 'mp-player-item';
    pEl.innerHTML = `
      <span class="mp-p-name">${p.name} ${p.id === localPlayerId ? '(TU)' : ''}</span>
      <span class="mp-p-char">${p.character ? CHARS[p.character].em + ' ' + CHARS[p.character].nome : 'Scegliendo...'}</span>
      <span class="mp-p-ready ${p.ready ? 'ready' : ''}">${p.ready ? 'PRONTO' : '...'}</span>
    `;
    list.appendChild(pEl);
  });
  
  const localP = lobbyPlayers.find(p => p.id === localPlayerId);
  if (localP && localP.character) {
    document.getElementById('mp-ready-btn').style.display = 'block';
  }
}

function showMpCharSelect() {
  hideAll();
  document.getElementById('screen-select').classList.remove('hidden');
  sel1 = null; sel2 = null; selTurn = localPlayerIndex + 1;
  buildGrid();
  updateSelUI();
  const lbl = document.getElementById('sel-lbl' + (localPlayerIndex + 1));
  if (lbl) lbl.textContent = 'TU · Scegli il personaggio';
  const lbl2 = document.getElementById('sel-lbl' + (remotePlayerIndex + 1));
  if (lbl2) lbl2.textContent = 'Avversario · In attesa...';
}

function mpSelectCharacter(charId) {
  if (!socket || !socket.connected) return;
  if (localPlayerIndex === 0) sel1 = charId;
  else sel2 = charId;
  updateSelUI();
  socket.emit('lobby:char', { character: charId });
  setTimeout(() => {
    const lobby = document.getElementById('mp-lobby');
    if (lobby) {
      hideAll();
      lobby.classList.remove('hidden');
      updateLobbyUI();
    }
  }, 1000);
}

function mpReady() {
  if (!socket || !socket.connected) return;
  socket.emit('lobby:ready');
  document.getElementById('mp-ready-btn').style.display = 'none';
}

function showCountdown(sec) {
  const cdEl = document.createElement('div');
  cdEl.id = 'mp-countdown-overlay';
  cdEl.className = 'mp-countdown-overlay';
  cdEl.innerHTML = `<div class="mp-cd-num">${sec}</div>`;
  document.body.appendChild(cdEl);
  
  let current = sec;
  const int = setInterval(() => {
    current--;
    if (current <= 0) {
      clearInterval(int);
      cdEl.remove();
    } else {
      cdEl.querySelector('.mp-cd-num').textContent = current;
    }
  }, 1000);
}

function showReconnectingOverlay() {
  if (document.getElementById('mp-reconnecting')) return;
  const overlay = document.createElement('div');
  overlay.id = 'mp-reconnecting';
  overlay.className = 'mp-reconnecting-overlay';
  overlay.innerHTML = `
    <div class="mp-reconnecting-box">
      <div class="mp-reconnecting-spinner"></div>
      <div class="mp-reconnecting-text">Riconnessione in corso...</div>
      <div class="mp-reconnecting-ping" id="mp-reconnecting-ping">Ping: --ms</div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function hideReconnectingOverlay() {
  const overlay = document.getElementById('mp-reconnecting');
  if (overlay) overlay.remove();
}

function sendPlayerMove() {
  if (!isMultiplayer || !socket || !socket.connected || !started) return;
  if (!p[localPlayerIndex]) return;
  const now = Date.now();
  if (now - lastUpdateTime < UPDATE_INTERVAL) return;
  lastUpdateTime = now;
  const pp = p[localPlayerIndex];
  socket.emit('input', {
    tick: currentTick,
    x: pp.x, y: pp.y, vx: pp.vx, vy: pp.vy,
    facing: pp.facing, onGround: pp.onGround, crouching: pp.crouching,
    atkT: pp.atkT, atkAnim: pp.atkAnim,
    damage: pp.damage, stocks: pp.stocks, isDead: pp.isDead,
  });
}

function updateMultiplayer() {
  if (!isMultiplayer) return;
  sendPlayerMove();
}

function startPing() {
  stopPing();
  pingIv = setInterval(() => {
    if (!socket || !socket.connected) return;
    const t0 = Date.now();
    socket.emit('ping', (res) => {
      currentPing = Date.now() - t0;
      connectionQuality = currentPing < 80 ? 'good' : currentPing < 200 ? 'fair' : 'poor';
      const el = document.getElementById('mp-room-ping');
      if (el) {
        el.textContent = 'Ping: ' + currentPing + 'ms';
        el.style.color = connectionQuality === 'good' ? '#00ff88' : connectionQuality === 'fair' ? '#ffcc00' : '#ff4444';
      }
      const reconEl = document.getElementById('mp-reconnecting-ping');
      if (reconEl) {
        reconEl.textContent = 'Ping: ' + currentPing + 'ms';
      }
    });
  }, 3000);
}

function stopPing() {
  if (pingIv) { clearInterval(pingIv); pingIv = null; }
}

function isInMultiplayer()     { return isMultiplayer; }
function getRoomCode()         { return currentRoomCode; }
function getLocalPlayerIndex() { return localPlayerIndex; }
function getConnectionQuality(){ return connectionQuality; }

function disconnectMultiplayer() {
  stopPing();
  hideReconnectingOverlay();
  if (socket) { socket.disconnect(); socket = null; }
  isMultiplayer = false; currentRoomCode = null;
  localPlayerIndex = null; remotePlayerIndex = null; reconnectAttempts = 0;
  isHost = false; localPlayerId = null; inLobby = false;
}

console.log('[MULTIPLAYER v5.2] Modulo caricato — Resilienza Massima');
