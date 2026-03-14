/**
 * multiplayer-client.js — Battaglia Navale Smash Client Multiplayer v5.1
 * PvP Online Realistico: Server-Authoritative, Tick Loop 60Hz, Lobby/Ready
 *
 * FLUSSO v5.1:
 * 1. room:create -> CREATED -> LOBBY (host)
 * 2. room:join -> LOBBY (guest) -> lobby:update (entrambi)
 * 3. lobby:ready -> allReady? -> COUNTDOWN -> match:init {seed, startAt}
 * 4. startAt -> IN_MATCH -> Tick Loop 60Hz -> snapshot 20Hz
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
const UPDATE_INTERVAL = 16; // ~60Hz
let currentPing       = 0;
let pingIv            = null;
let reconnectAttempts = 0;
let connectionQuality = 'good';
let inLobby           = false;
let lobbyPlayers      = [];
let matchSeed         = null;
let matchStartAt      = null;

const BACKEND_URL = window.BACKEND_URL || 'https://fivebm-ultimate-fight.onrender.com';

function initSocket() {
  if (typeof io === 'undefined') {
    mpSetStatus('Socket.io non disponibile. Ricarica la pagina.', 'error');
    return false;
  }
  mpSetStatus('Connessione al server in corso...', 'info');
  if (socket) { socket.removeAllListeners(); socket.disconnect(); socket = null; }
  socket = io(BACKEND_URL, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    randomizationFactor: 0.4,
    reconnectionAttempts: 20,
    timeout: 30000,
    transports: ['websocket', 'polling'],
    autoConnect: true,
    upgrade: true,
    rememberUpgrade: false,
    pingInterval: 8000,
    pingTimeout: 25000,
    allowEIO3: true,
    forceNew: false,
  });
  socket.on('connect',                onSocketConnect);
  socket.on('disconnect',             onSocketDisconnect);
  socket.on('connect_error',          onSocketError);
  socket.on('room:created',           onRoomCreated);
  socket.on('room:joined',            onRoomJoined);
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
  return true;
}

function onSocketConnect() {
  reconnectAttempts = 0;
  mpSetStatus('Connesso al server', 'success');
  startPing();
  logMP('[CONNECT] Socket connesso:', socket.id);
}

function onSocketDisconnect(reason) {
  stopPing();
  const msg = reason === 'io server disconnect'
    ? 'Disconnesso dal server (riconnessione automatica...)'
    : 'Connessione persa: ' + reason;
  mpSetStatus(msg, 'warn');
  logMP('[DISCONNECT]', reason);
  if (reason === 'io server disconnect') {
    setTimeout(() => { if (socket) socket.connect(); }, 2000);
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
  mpSetStatus('Tentativo di riconnessione ' + attempt + '/20...', 'warn');
}

function onReconnect(attempt) {
  reconnectAttempts = 0;
  mpSetStatus('Riconnesso al server', 'success');
  startPing();
  if (currentRoomCode && socket) {
    socket.emit('room:join', { code: currentRoomCode, playerId: localPlayerId, name: document.getElementById('mp-name')?.value?.trim() || 'Giocatore' });
  }
}

function onReconnectFailed() {
  mpSetStatus('Impossibile riconnettersi. Ricarica la pagina.', 'error');
}

function onRoomCreated(data) {
  logMP('[ROOM_CREATED]', data);
  currentRoomCode = data.code;
  isHost = true;
  isMultiplayer = true;
  localPlayerIndex = 0;
  remotePlayerIndex = 1;
  showMpLobby();
}

function onRoomJoined(data) {
  logMP('[ROOM_JOINED]', data);
  currentRoomCode = data.code;
  isHost = false;
  isMultiplayer = true;
  localPlayerIndex = 1;
  remotePlayerIndex = 0;
  showMpLobby();
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
  startGame();
}

function onSnapshot(data) {
  if (!isMultiplayer || !started) return;
  currentTick = data.tick;
  const snapshot = data.snapshot;
  snapshot.forEach(pData => {
    const pi = pData.id === localPlayerId ? localPlayerIndex : remotePlayerIndex;
    if (p[pi]) {
      const pp = p[pi];
      // Se è il player remoto, aggiorna direttamente
      if (pi === remotePlayerIndex) {
        pp.x = pData.x; pp.y = pData.y; pp.vx = pData.vx; pp.vy = pData.vy;
        pp.facing = pData.f; pp.onGround = pData.g; pp.crouching = pData.c;
        pp.atkT = pData.at; pp.atkAnim = pData.aa; pp.damage = pData.d;
        pp.stocks = pData.s; pp.isDead = pData.dead;
      }
      // Se è il player locale, potresti fare reconciliation qui
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

function onPowerUsed(pi) {
  if (!isMultiplayer || pi !== localPlayerIndex) return;
  if (!socket || !socket.connected) return;
  socket.emit('use_ability', { abilityType: p[pi].ch.powType });
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
  if (socket) { socket.disconnect(); socket = null; }
  isMultiplayer = false; currentRoomCode = null;
  localPlayerIndex = null; remotePlayerIndex = null; reconnectAttempts = 0;
  isHost = false; localPlayerId = null; inLobby = false;
}

console.log('[MULTIPLAYER v5.1] Modulo caricato — Tick Loop 60Hz');
