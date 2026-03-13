/**
 * multiplayer-client.js — Battaglia Navale Smash Client Multiplayer v4.0
 * NUOVO FLUSSO: 1. Crea/Accedi stanza -> 2. Selezione personaggi in-room -> 3. Avvia partita
 * FIX v3.0: timeout 30s, retry esponenziale con jitter, riconnessione graceful,
 * validazione payload, indicatore qualità connessione, graceful server shutdown.
 */

let socket            = null;
let isMultiplayer     = false;
let currentRoomCode   = null;
let localPlayerIndex  = null;
let remotePlayerIndex = null;
let mpCharSel         = null;
let lastUpdateTime    = 0;
const UPDATE_INTERVAL = 33;
let currentPing       = 0;
let pingIv            = null;
let reconnectAttempts = 0;
let connectionQuality = 'good';
let inRoomCharSelect  = false;
let remotePlayerName  = null;
let remotePlayerChar  = null;

function initSocket() {
  if (typeof io === 'undefined') {
    mpSetStatus('Socket.io non disponibile. Ricarica la pagina.', 'error');
    return false;
  }
  const serverUrl = window.BACKEND_URL || 'https://fivebm-ultimate-fight.onrender.com';
  mpSetStatus('Connessione al server in corso...', 'info');
  if (socket) { socket.removeAllListeners(); socket.disconnect(); socket = null; }
  socket = io(serverUrl, {
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
  socket.on('connect',           onSocketConnect);
  socket.on('disconnect',        onSocketDisconnect);
  socket.on('connect_error',     onSocketError);
  socket.on('playerJoined',      onPlayerJoined);
  socket.on('roomReady',         onRoomReady);
  socket.on('playerCharSelected', onPlayerCharSelected);
  socket.on('playerMoved',       onPlayerMoved);
  socket.on('abilityUsed',       onAbilityUsed);
  socket.on('gameStateChanged',  onGameStateChanged);
  socket.on('gameStarted',       onGameStarted);
  socket.on('gameEnded',         onGameEnded);
  socket.on('playerLeft',        onPlayerLeft);
  socket.on('error',             onServerError);
  socket.on('reconnect_attempt', onReconnectAttempt);
  socket.on('reconnect',         onReconnect);
  socket.on('reconnect_failed',  onReconnectFailed);
  socket.on('serverShutdown',    onServerShutdown);
  return true;
}

function onSocketConnect() {
  reconnectAttempts = 0;
  mpSetStatus('Connesso al server', 'success');
  startPing();
  console.log('[MP] Connesso — socket:', socket.id);
}

function onSocketDisconnect(reason) {
  stopPing();
  const msg = reason === 'io server disconnect'
    ? 'Disconnesso dal server (riconnessione automatica...)'
    : 'Connessione persa: ' + reason;
  mpSetStatus(msg, 'warn');
  console.warn('[MP] Disconnesso:', reason);
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
  console.error('[MP] Errore connessione:', err);
}

function onReconnectAttempt(attempt) {
  reconnectAttempts = attempt;
  mpSetStatus('Tentativo di riconnessione ' + attempt + '/20...', 'warn');
}

function onReconnect(attempt) {
  reconnectAttempts = 0;
  mpSetStatus('Riconnesso al server', 'success');
  startPing();
  if (currentRoomCode && inRoomCharSelect) {
    const playerName = document.getElementById('mp-name')?.value?.trim() || 'Giocatore';
    setTimeout(() => mpRejoinRoom(currentRoomCode, playerName), 500);
  }
}

function onReconnectFailed() {
  mpSetStatus('Impossibile riconnettersi. Ricarica la pagina.', 'error');
}

function onServerShutdown(data) {
  mpSetStatus((data && data.message) ? data.message : 'Server in riavvio...', 'warn');
}

function onPlayerJoined(data) {
  console.log('[MP] Giocatore entrato:', data.playerName);
  remotePlayerName = data.playerName;
  mpSetStatus('Avversario trovato: ' + data.playerName, 'success');
  updateMpRoomUI();
}

function onPlayerCharSelected(data) {
  console.log('[MP] Avversario ha scelto:', data.character);
  remotePlayerChar = data.character;
  if (remotePlayerIndex !== null && data.playerIndex !== undefined) {
    if (data.playerIndex === 0) sel1 = data.character;
    else sel2 = data.character;
  }
  updateMpRoomUI();
  checkBothPlayersReady();
}

function onRoomReady(data) {
  console.log('[MP] Stanza pronta:', data);
  mpSetStatus('Stanza pronta! Seleziona il personaggio.', 'success');
  updateMpRoomUI();
}

function onPlayerMoved(data) {
  if (!p || !p[remotePlayerIndex]) return;
  const pp = p[remotePlayerIndex];
  const d  = (data && data.data) ? data.data : data;
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

function onGameStateChanged(data) {
  if (data.playerIndex === remotePlayerIndex && p[remotePlayerIndex]) {
    const pp = p[remotePlayerIndex];
    const d  = data.data;
    if (d && typeof d.damage === 'number') { pp.damage = d.damage; updPct(remotePlayerIndex); }
    if (d && typeof d.stocks === 'number') { pp.stocks = d.stocks; buildLives(remotePlayerIndex); }
    if (d && d.isDead !== undefined) pp.isDead = !!d.isDead;
  }
}

function onGameStarted(data) {
  console.log('[MP] Partita iniziata');
  if (!sel1 || !sel2) { sel1 = sel1 || 'Brutus'; sel2 = sel2 || 'Tornari'; }
  startGame();
}

function onGameEnded(data) {
  console.log('[MP] Partita terminata');
  const winnerIndex = data.players
    ? data.players.findIndex(pl => pl.id === data.winnerId)
    : -1;
  if (winnerIndex >= 0 && data.players[winnerIndex]) {
    showResult(data.players[winnerIndex].character || (winnerIndex === 0 ? sel1 : sel2));
  }
}

function onPlayerLeft(data) {
  console.log('[MP] Giocatore abbandonato:', data.playerName);
  mpSetStatus('L\'avversario ha abbandonato la partita', 'warn');
  isMultiplayer = false;
  if (started) { showResult(localPlayerIndex === 0 ? sel1 : sel2); }
}

function onServerError(data) {
  mpSetStatus('Errore server: ' + ((data && data.message) ? data.message : 'sconosciuto'), 'error');
}

function showMultiplayer() {
  hideAll();
  document.getElementById('screen-multiplayer').classList.remove('hidden');
  document.getElementById('mp-room-info').classList.add('hidden');
  document.getElementById('mp-status').textContent = '';
  mpCharSel = null;
  inRoomCharSelect = false;
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
  const code = Math.random().toString(36).substring(2, 6).toUpperCase();
  const playerName = document.getElementById('mp-name')?.value?.trim() || 'Giocatore';
  mpDoCreateRoom(code, playerName);
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
  mpDoJoinRoom(code, playerName);
}

function mpDoCreateRoom(code, playerName) {
  if (!socket || !socket.connected) { mpSetStatus('Non connesso. Riprova tra qualche secondo.', 'error'); return; }
  mpSetStatus('Creazione stanza ' + code + '...', 'info');
  socket.emit('createRoom', { roomCode: code, playerName: playerName }, (res) => {
    if (!res || !res.success) {
      mpSetStatus('Errore: ' + ((res && res.message) ? res.message : 'risposta non valida'), 'error');
      return;
    }
    currentRoomCode   = code;
    localPlayerIndex  = res.playerIndex;
    remotePlayerIndex = localPlayerIndex === 0 ? 1 : 0;
    isMultiplayer     = true;
    inRoomCharSelect  = true;
    mpCharSel         = null;
    remotePlayerName  = null;
    remotePlayerChar  = null;
    sel1 = null; sel2 = null;
    const codeDisplay = document.getElementById('mp-room-code-display');
    if (codeDisplay) codeDisplay.textContent = code;
    const roomInfo = document.getElementById('mp-room-info');
    if (roomInfo) roomInfo.classList.remove('hidden');
    mpSetStatus('Stanza ' + code + ' creata! Condividi il codice con l\'avversario.', 'success');
    updateMpRoomUI();
    showMpCharSelect();
    console.log('[MP] Stanza creata:', code, '— Indice locale:', localPlayerIndex);
  });
}

function mpDoJoinRoom(code, playerName) {
  if (!socket || !socket.connected) { mpSetStatus('Non connesso. Riprova tra qualche secondo.', 'error'); return; }
  mpSetStatus('Accesso alla stanza ' + code + '...', 'info');
  socket.emit('joinRoom', { roomCode: code, playerName: playerName }, (res) => {
    if (!res || !res.success) {
      mpSetStatus('Errore: ' + ((res && res.message) ? res.message : 'risposta non valida'), 'error');
      return;
    }
    currentRoomCode   = code;
    localPlayerIndex  = res.playerIndex;
    remotePlayerIndex = localPlayerIndex === 0 ? 1 : 0;
    isMultiplayer     = true;
    inRoomCharSelect  = true;
    mpCharSel         = null;
    remotePlayerName  = res.otherPlayerName || null;
    remotePlayerChar  = null;
    sel1 = null; sel2 = null;
    const codeDisplay = document.getElementById('mp-room-code-display');
    if (codeDisplay) codeDisplay.textContent = code;
    const roomInfo = document.getElementById('mp-room-info');
    if (roomInfo) roomInfo.classList.remove('hidden');
    mpSetStatus('Entrato nella stanza ' + code + '. Seleziona il personaggio.', 'success');
    updateMpRoomUI();
    showMpCharSelect();
    console.log('[MP] Stanza acceduta:', code, '— Indice locale:', localPlayerIndex);
  });
}

function mpRejoinRoom(code, playerName) {
  if (!socket || !socket.connected) return;
  socket.emit('rejoinRoom', { roomCode: code, playerName: playerName }, (res) => {
    if (res && res.success) {
      mpSetStatus('Riaccesso alla stanza ' + code + '.', 'success');
      updateMpRoomUI();
    }
  });
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
  if (lbl2) lbl2.textContent = (remotePlayerName || 'Avversario') + ' · In attesa...';
}

function mpSelectCharacter(charId) {
  if (!inRoomCharSelect || !socket || !socket.connected) return;
  mpCharSel = charId;
  if (localPlayerIndex === 0) sel1 = charId;
  else sel2 = charId;
  updateSelUI();
  socket.emit('selectCharacter', { character: charId });
  checkBothPlayersReady();
}

function checkBothPlayersReady() {
  if (!inRoomCharSelect || !mpCharSel || !remotePlayerChar) return;
  const startBtn = document.getElementById('fight-btn');
  if (startBtn) {
    startBtn.disabled = false;
    startBtn.textContent = '⚔ COMBATTI ONLINE!';
  }
}

function updateMpRoomUI() {
  const playersEl = document.getElementById('mp-room-players');
  if (!playersEl) return;
  if (remotePlayerName) {
    playersEl.textContent = 'Tu vs ' + remotePlayerName;
  } else {
    playersEl.textContent = 'In attesa del secondo giocatore...';
  }
}

function mpStartGame() {
  if (!socket || !socket.connected || !currentRoomCode) {
    mpSetStatus('Non connesso o stanza non valida.', 'error'); return;
  }
  if (!sel1 || !sel2) {
    mpSetStatus('Entrambi i giocatori devono scegliere il personaggio.', 'warn');
    return;
  }
  socket.emit('startGame');
}

function sendPlayerMove() {
  if (!isMultiplayer || !socket || !socket.connected) return;
  if (!p[localPlayerIndex]) return;
  const now = Date.now();
  if (now - lastUpdateTime < UPDATE_INTERVAL) return;
  lastUpdateTime = now;
  const pp = p[localPlayerIndex];
  socket.emit('playerMove', {
    x: pp.x, y: pp.y, vx: pp.vx, vy: pp.vy,
    facing: pp.facing, onGround: pp.onGround, crouching: pp.crouching,
    atkT: pp.atkT, atkAnim: pp.atkAnim,
    damage: pp.damage, stocks: pp.stocks, isDead: pp.isDead,
  });
}

function onPowerUsed(pi) {
  if (!isMultiplayer || pi !== localPlayerIndex) return;
  if (!socket || !socket.connected) return;
  socket.emit('useAbility', { abilityType: p[pi].ch.powType, targetIndex: remotePlayerIndex });
}

function onPlayerStateChanged(pi) {
  if (!isMultiplayer || pi !== localPlayerIndex) return;
  if (!socket || !socket.connected) return;
  const pp = p[pi];
  socket.emit('gameStateUpdate', { damage: pp.damage, stocks: pp.stocks, isDead: pp.isDead, x: pp.x, y: pp.y });
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
  inRoomCharSelect = false; mpCharSel = null;
}

console.log('[MULTIPLAYER v4.0] Modulo caricato — Nuovo flusso: Stanza -> Selezione -> Start');
