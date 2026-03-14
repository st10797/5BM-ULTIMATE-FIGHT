/**
 * multiplayer-client.js — Battaglia Navale Smash Client Multiplayer v5.0
 * PvP Online Realistico: API REST + WebSocket, Transizioni Automatiche, QR Code
 *
 * FLUSSO v5.0:
 * 1. POST /rooms → crea stanza, mostra UI Waiting con QR + Countdown
 * 2. WS subscribe_room → host sottoscritto
 * 3. Guest POST /rooms/{code}/join → PLAYER_JOINED event
 * 4. Transizione automatica → SelezionePersonaggi
 * 5. select_character → PLAYER_CHAR_SELECTED + MATCH_READY
 * 6. start_game → GAME_STARTED
 */

let socket            = null;
let isMultiplayer     = false;
let currentRoomCode   = null;
let localPlayerIndex  = null;
let remotePlayerIndex = null;
let isHost            = false;
let localPlayerId     = null;
let lastUpdateTime    = 0;
const UPDATE_INTERVAL = 33;
let currentPing       = 0;
let pingIv            = null;
let reconnectAttempts = 0;
let connectionQuality = 'good';
let roomCountdown     = 120;
let countdownInterval = null;

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
  socket.on('PLAYER_JOINED',          onPlayerJoined);
  socket.on('PLAYER_CHAR_SELECTED',   onPlayerCharSelected);
  socket.on('MATCH_READY',            onMatchReady);
  socket.on('GAME_STARTED',           onGameStarted);
  socket.on('GAME_ENDED',             onGameEnded);
  socket.on('PLAYER_MOVED',           onPlayerMoved);
  socket.on('ABILITY_USED',           onAbilityUsed);
  socket.on('PLAYER_LEFT',            onPlayerLeft);
  socket.on('ROOM_TIMEOUT',           onRoomTimeout);
  socket.on('ROOM_CANCELLED',         onRoomCancelled);
  socket.on('ERROR',                  onServerError);
  socket.on('reconnect_attempt',      onReconnectAttempt);
  socket.on('reconnect',              onReconnect);
  socket.on('reconnect_failed',       onReconnectFailed);
  socket.on('SERVER_SHUTDOWN',        onServerShutdown);
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
    socket.emit('subscribe_room', { code: currentRoomCode }, (res) => {
      if (res && res.success) {
        logMP('[REJOIN] Riaccesso a stanza:', currentRoomCode);
      }
    });
  }
}

function onReconnectFailed() {
  mpSetStatus('Impossibile riconnettersi. Ricarica la pagina.', 'error');
}

function onServerShutdown(data) {
  mpSetStatus((data && data.message) ? data.message : 'Server in riavvio...', 'warn');
}

function onPlayerJoined(data) {
  logMP('[PLAYER_JOINED]', data);
  mpSetStatus('Avversario trovato!', 'success');
  stopCountdown();
  setTimeout(() => showMpCharSelect(), 500);
}

function onPlayerCharSelected(data) {
  logMP('[PLAYER_CHAR_SELECTED]', data);
  if (data.playerIndex === remotePlayerIndex) {
    if (data.playerIndex === 0) sel1 = data.character;
    else sel2 = data.character;
    updateSelUI();
  }
}

function onMatchReady(data) {
  logMP('[MATCH_READY]', data);
  mpSetStatus('Entrambi pronti! Inizia il combattimento...', 'success');
  setTimeout(() => startGame(), 1000);
}

function onGameStarted(data) {
  logMP('[GAME_STARTED]', data);
  if (!sel1 || !sel2) { sel1 = sel1 || 'Brutus'; sel2 = sel2 || 'Tornari'; }
  startGame();
}

function onGameEnded(data) {
  logMP('[GAME_ENDED]', data);
  const winnerIndex = data.winnerId ? (data.winnerId === localPlayerId ? localPlayerIndex : remotePlayerIndex) : -1;
  if (winnerIndex >= 0) {
    showResult(winnerIndex === 0 ? sel1 : sel2);
  }
}

function onPlayerMoved(data) {
  if (!p || !p[remotePlayerIndex]) return;
  const pp = p[remotePlayerIndex];
  const d  = data.data || data;
  if (!d) return;
  if (typeof d.x   === 'number' && isFinite(d.x))  pp.x  = d.x;
  if (typeof d.y   === 'number' && isFinite(d.y))  pp.y  = d.y;
  if (typeof d.vx  === 'number' && isFinite(d.vx)) pp.vx = d.vx;
  if (typeof d.vy  === 'number' && isFinite(d.vy)) pp.vy = d.vy;
  if (d.facing    !== undefined) pp.facing    = !!d.facing;
  if (d.onGround  !== undefined) pp.onGround  = !!d.onGround;
  if (d.crouching !== undefined) pp.crouching = !!d.crouching;
  if (typeof d.atkT    === 'number') pp.atkT   = d.atkT;
  if (typeof d.atkAnim === 'string') pp.atkAnim = d.atkAnim;
  if (typeof d.damage  === 'number' && d.damage >= 0) pp.damage = d.damage;
  if (typeof d.stocks  === 'number' && d.stocks >= 0) pp.stocks = d.stocks;
  if (d.isDead !== undefined) pp.isDead = !!d.isDead;
}

function onAbilityUsed(data) {
  if (data.playerIndex === remotePlayerIndex && p[remotePlayerIndex]) {
    usePower(remotePlayerIndex);
  }
}

function onPlayerLeft(data) {
  logMP('[PLAYER_LEFT]', data);
  mpSetStatus('L\'avversario ha abbandonato la partita', 'warn');
  isMultiplayer = false;
  if (started) { showResult(localPlayerIndex === 0 ? sel1 : sel2); }
}

function onRoomTimeout(data) {
  logMP('[ROOM_TIMEOUT]', data);
  mpSetStatus('Stanza scaduta: nessun giocatore ha fatto il join.', 'warn');
  setTimeout(() => showTitle(), 2000);
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

async function mpCreateRoom() {
  if (!socket || !socket.connected) {
    mpSetStatus('Non connesso al server. Attendi...', 'error');
    if (!socket) initSocket();
    return;
  }
  const playerName = document.getElementById('mp-name')?.value?.trim() || 'Giocatore';
  localPlayerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  mpSetStatus('Creazione stanza...', 'info');
  try {
    const res = await fetch(BACKEND_URL + '/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostId: localPlayerId, hostName: playerName }),
    });
    const data = await res.json();
    if (!data.success) {
      mpSetStatus('Errore: ' + (data.message || 'risposta non valida'), 'error');
      return;
    }
    currentRoomCode = data.code;
    localPlayerIndex = 0;
    remotePlayerIndex = 1;
    isHost = true;
    isMultiplayer = true;
    socket.emit('subscribe_room', { code: currentRoomCode }, (res) => {
      if (res && res.success) {
        logMP('[CREATE] Stanza creata:', currentRoomCode);
        showMpWaitingRoom();
        startCountdown();
      }
    });
  } catch (err) {
    mpSetStatus('Errore rete: ' + err.message, 'error');
    logMP('[ERROR]', err);
  }
}

async function mpJoinRoom() {
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
  mpSetStatus('Accesso alla stanza ' + code + '...', 'info');
  try {
    const res = await fetch(BACKEND_URL + '/rooms/' + code + '/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestId: localPlayerId, guestName: playerName }),
    });
    const data = await res.json();
    if (!data.success) {
      mpSetStatus('Errore: ' + (data.message || 'risposta non valida'), 'error');
      return;
    }
    currentRoomCode = code;
    localPlayerIndex = 1;
    remotePlayerIndex = 0;
    isHost = false;
    isMultiplayer = true;
    socket.emit('subscribe_room', { code: currentRoomCode }, (res) => {
      if (res && res.success) {
        logMP('[JOIN] Accesso a stanza:', currentRoomCode);
        mpSetStatus('Entrato nella stanza! Scegli il personaggio.', 'success');
        showMpCharSelect();
      }
    });
  } catch (err) {
    mpSetStatus('Errore rete: ' + err.message, 'error');
    logMP('[ERROR]', err);
  }
}

function showMpWaitingRoom() {
  hideAll();
  const waitingEl = document.createElement('div');
  waitingEl.id = 'mp-waiting-room';
  waitingEl.className = 'screen';
  waitingEl.innerHTML = `
    <div class="mp-waiting-container">
      <div class="mp-waiting-title">In attesa dell'avversario...</div>
      <div class="mp-room-code-display" id="mp-code-display">${currentRoomCode}</div>
      <button class="mp-action-btn" onclick="mpCopyCode()">📋 Copia Codice</button>
      <div class="mp-qr-placeholder" id="mp-qr">QR Code</div>
      <div class="mp-countdown" id="mp-countdown">Scade tra: 120s</div>
      <button class="res-btn" onclick="mpCancelRoom()">Annulla</button>
    </div>
  `;
  document.body.appendChild(waitingEl);
}

function mpCopyCode() {
  if (!currentRoomCode) return;
  navigator.clipboard.writeText(currentRoomCode).then(() => {
    mpSetStatus('Codice copiato negli appunti!', 'success');
  }).catch(() => {
    mpSetStatus('Errore copia codice', 'error');
  });
}

async function mpCancelRoom() {
  if (!currentRoomCode || !isHost) return;
  try {
    await fetch(BACKEND_URL + '/rooms/' + currentRoomCode, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostId: localPlayerId }),
    });
    mpSetStatus('Stanza cancellata', 'info');
    setTimeout(() => showTitle(), 1000);
  } catch (err) {
    mpSetStatus('Errore cancellazione stanza', 'error');
  }
}

function startCountdown() {
  roomCountdown = 120;
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    roomCountdown--;
    const el = document.getElementById('mp-countdown');
    if (el) el.textContent = 'Scade tra: ' + roomCountdown + 's';
    if (roomCountdown <= 0) {
      stopCountdown();
      mpSetStatus('Stanza scaduta', 'warn');
      setTimeout(() => showTitle(), 2000);
    }
  }, 1000);
}

function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
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
  socket.emit('select_character', { character: charId });
}

function sendPlayerMove() {
  if (!isMultiplayer || !socket || !socket.connected) return;
  if (!p[localPlayerIndex]) return;
  const now = Date.now();
  if (now - lastUpdateTime < UPDATE_INTERVAL) return;
  lastUpdateTime = now;
  const pp = p[localPlayerIndex];
  socket.emit('player_move', {
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
  stopCountdown();
  if (socket) { socket.disconnect(); socket = null; }
  isMultiplayer = false; currentRoomCode = null;
  localPlayerIndex = null; remotePlayerIndex = null; reconnectAttempts = 0;
  isHost = false; localPlayerId = null;
}

console.log('[MULTIPLAYER v5.0] Modulo caricato — PvP Online Realistico');
