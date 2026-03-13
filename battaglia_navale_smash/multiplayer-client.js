/**
 * multiplayer-client.js — Battaglia Navale Smash Client Multiplayer
 * Gestisce la connessione Socket.io, la UI multiplayer e la sincronizzazione con il server.
 * Usa window.BACKEND_URL (impostato da env-config.js) per il collegamento al backend Render.
 * Dipende da: config.js, engine.js, powers.js, env-config.js
 */

/* ============================================================
   STATO MULTIPLAYER
============================================================ */

/** Socket.io instance */
let socket = null;

/** Flag per indicare se siamo in modalità multiplayer */
let isMultiplayer = false;

/** Codice della stanza corrente */
let currentRoomCode = null;

/** Indice del giocatore locale (0 o 1) */
let localPlayerIndex = null;

/** Indice dell'avversario remoto */
let remotePlayerIndex = null;

/** Personaggio scelto in modalità multiplayer */
let mpCharSel = null;

/** Timestamp dell'ultimo update inviato */
let lastUpdateTime = 0;

/** Intervallo minimo tra gli update (ms) */
const UPDATE_INTERVAL = 33; // ~30 fps

/** Ping corrente in ms */
let currentPing = 0;

/** Intervallo di ping */
let pingIv = null;

/* ============================================================
   INIZIALIZZAZIONE SOCKET.IO
============================================================ */

/**
 * Inizializza la connessione Socket.io con il server Render.
 * L'URL viene letto da window.BACKEND_URL (env-config.js).
 */
function initSocket() {
  if (typeof io === 'undefined') {
    mpSetStatus('❌ Socket.io non disponibile. Ricarica la pagina.', 'error');
    return false;
  }

  const serverUrl = window.BACKEND_URL || 'https://fivebm-ultimate-fight.onrender.com';
  mpSetStatus('🔄 Connessione al server...', 'info');

  socket = io(serverUrl, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 15,  // Aumentato da 8 a 15 per più tentativi
    timeout: 20000,             // Aumentato da 15000 a 20000 ms
    // Prova prima WebSocket, poi polling come fallback
    transports: ['websocket', 'polling'],
    // Configurazioni aggiuntive per stabilità
    autoConnect: true,
    upgrade: true,
    rememberUpgrade: true,
    // Heartbeat per mantenere la connessione attiva
    pingInterval: 5000,
    pingTimeout: 10000,
    // Compatibilità con versioni precedenti
    allowEIO3: true,
  });

  socket.on('connect',          onSocketConnect);
  socket.on('disconnect',       onSocketDisconnect);
  socket.on('connect_error',    onSocketError);
  socket.on('playerJoined',     onPlayerJoined);
  socket.on('roomReady',        onRoomReady);
  socket.on('playerMoved',      onPlayerMoved);
  socket.on('abilityUsed',      onAbilityUsed);
  socket.on('gameStateChanged', onGameStateChanged);
  socket.on('gameStarted',      onGameStarted);
  socket.on('gameEnded',        onGameEnded);
  socket.on('playerLeft',       onPlayerLeft);
  socket.on('error',            onServerError);
  socket.on('reconnect_attempt', onReconnectAttempt);
  socket.on('reconnect',        onReconnect);

  return true;
}

/* ============================================================
   NAVIGAZIONE SCHERMATA MULTIPLAYER
============================================================ */

/**
 * Mostra la schermata multiplayer e inizializza la connessione.
 */
function showMultiplayer() {
  hideAll();
  document.getElementById('screen-multiplayer').classList.remove('hidden');
  document.getElementById('mp-room-info').classList.add('hidden');
  document.getElementById('mp-status').textContent = '';
  mpCharSel = null;

  // Inizializza socket se non già connesso
  if (!socket || !socket.connected) {
    initSocket();
  } else {
    mpSetStatus('✅ Connesso al server', 'success');
  }
}

/**
 * Imposta il messaggio di stato nella UI multiplayer.
 * @param {string} msg  - Messaggio
 * @param {string} type - 'info' | 'success' | 'error' | 'warn'
 */
function mpSetStatus(msg, type = 'info') {
  const el = document.getElementById('mp-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'mp-status mp-status-' + type;
}

/* ============================================================
   CREAZIONE / JOIN STANZA
============================================================ */

/**
 * Crea una nuova stanza e mostra il codice.
 */
function mpCreateRoom() {
  if (!socket || !socket.connected) {
    mpSetStatus('❌ Non connesso al server. Attendi...', 'error');
    if (!socket) initSocket();
    return;
  }

  // Genera codice casuale lato client (il server lo accetterà)
  const code = Math.random().toString(36).substring(2, 6).toUpperCase();
  mpDoJoin(code, true);
}

/**
 * Si unisce alla stanza inserita dall'utente.
 */
function mpJoinRoom() {
  const input = document.getElementById('mp-room-input');
  const code  = input ? input.value.trim().toUpperCase() : '';
  if (!code || code.length < 2) {
    mpSetStatus('⚠️ Inserisci un codice stanza valido', 'warn');
    return;
  }
  if (!socket || !socket.connected) {
    mpSetStatus('❌ Non connesso al server. Attendi...', 'error');
    if (!socket) initSocket();
    return;
  }
  mpDoJoin(code, false);
}

/**
 * Esegue il join alla stanza (usato sia da create che da join).
 * @param {string}  code     - Codice stanza
 * @param {boolean} isCreate - true se stiamo creando la stanza
 */
function mpDoJoin(code, isCreate) {
  mpSetStatus('🔄 Connessione alla stanza ' + code + '...', 'info');

  socket.emit('joinRoom', {
    roomCode: code,
    playerName: 'Player',
    character: 'Brutus', // placeholder, verrà aggiornato dopo la selezione
  }, (response) => {
    if (!response || !response.success) {
      mpSetStatus('❌ ' + (response?.message || 'Errore di connessione'), 'error');
      return;
    }

    isMultiplayer      = true;
    currentRoomCode    = code;
    localPlayerIndex   = response.playerIndex;
    remotePlayerIndex  = 1 - localPlayerIndex;

    // Mostra info stanza
    document.getElementById('mp-room-info').classList.remove('hidden');
    document.getElementById('mp-room-code-display').textContent = code;
    document.getElementById('mp-room-players').textContent =
      localPlayerIndex === 0
        ? '👤 Sei il Player 1 — In attesa del Player 2...'
        : '👤 Sei il Player 2 — In attesa che il Player 1 avvii la partita';

    if (isCreate) {
      mpSetStatus('✅ Stanza creata! Condividi il codice: ' + code, 'success');
    } else {
      mpSetStatus('✅ Unito alla stanza ' + code, 'success');
    }

    // Avvia ping periodico
    startPing();
  });
}

/* ============================================================
   AVVIO PARTITA MULTIPLAYER
============================================================ */

/**
 * Avvia la partita multiplayer (solo il Player 1 può farlo).
 */
function mpStartGame() {
  if (!socket || !isMultiplayer) return;
  if (localPlayerIndex !== 0) {
    mpSetStatus('⚠️ Solo il Player 1 può avviare la partita', 'warn');
    return;
  }
  socket.emit('startGame');
}

/* ============================================================
   SOCKET EVENT HANDLERS
============================================================ */

function onSocketConnect() {
  mpSetStatus('✅ Connesso al server', 'success');
  console.log('[MP] Connesso:', socket.id);
}

function onSocketDisconnect(reason) {
  mpSetStatus('🔴 Disconnesso: ' + reason, 'error');
  isMultiplayer = false;
  currentRoomCode = null;
  stopPing();
  console.log('[MP] Disconnesso:', reason);
}

function onSocketError(err) {
  const msg = err.message || String(err);
  // Messaggio più chiaro per errori comuni
  let displayMsg = '❌ Errore connessione: ' + msg;
  if (msg.includes('timeout') || msg.includes('TIMEOUT')) {
    displayMsg = '❌ Timeout: il server non risponde. Riprova tra qualche secondo.';
  } else if (msg.includes('refused') || msg.includes('ECONNREFUSED')) {
    displayMsg = '❌ Server non raggiungibile. Verifica la connessione internet.';
  } else if (msg.includes('cors') || msg.includes('CORS')) {
    displayMsg = '❌ Errore CORS: configurazione server non corretta.';
  }
  mpSetStatus(displayMsg, 'error');
  console.error('[MP] Errore connessione:', err);
}

function onServerError(data) {
  mpSetStatus('❌ ' + (data.message || 'Errore server'), 'error');
}

function onReconnectAttempt() {
  console.log('[MP] Tentativo di riconnessione...');
  mpSetStatus('🔄 Tentativo di riconnessione...', 'info');
}

function onReconnect() {
  console.log('[MP] Riconnesso al server');
  mpSetStatus('✅ Riconnesso al server', 'success');
}

function onPlayerJoined(data) {
  console.log('[MP] Giocatore unito:', data.playerName);
  const players = data.players || [];
  const count   = players.length;
  document.getElementById('mp-room-players').textContent =
    `👥 ${count}/2 giocatori — ${count < 2 ? 'In attesa...' : 'Pronti!'}`;
  mpSetStatus('👋 ' + (data.playerName || 'Player') + ' si è unito!', 'success');
}

function onRoomReady(data) {
  console.log('[MP] Stanza pronta');
  document.getElementById('mp-room-players').textContent = '✅ Entrambi i giocatori connessi!';
  mpSetStatus('🎮 Pronti! Il Player 1 può avviare la partita.', 'success');

  // Mostra il pulsante start solo al Player 1
  const startBtn = document.getElementById('mp-start-btn');
  if (startBtn) {
    startBtn.style.display = localPlayerIndex === 0 ? 'block' : 'none';
  }
}

function onPlayerMoved(data) {
  if (!p[remotePlayerIndex]) return;
  // Applica interpolazione dei dati ricevuti
  const pp = p[remotePlayerIndex];
  const d  = data.data;
  if (d.x !== undefined)        pp.x        = pp.x + (d.x - pp.x) * 0.4;
  if (d.y !== undefined)        pp.y        = pp.y + (d.y - pp.y) * 0.4;
  if (d.vx !== undefined)       pp.vx       = d.vx;
  if (d.vy !== undefined)       pp.vy       = d.vy;
  if (d.facing !== undefined)   pp.facing   = d.facing;
  if (d.damage !== undefined)   pp.damage   = d.damage;
  if (d.stocks !== undefined)   pp.stocks   = d.stocks;
  if (d.isDead !== undefined)   pp.isDead   = d.isDead;
  if (d.atkT !== undefined)     pp.atkT     = d.atkT;
  if (d.atkAnim !== undefined)  pp.atkAnim  = d.atkAnim;
  if (d.crouching !== undefined) pp.crouching = d.crouching;
  if (d.onGround !== undefined) pp.onGround = d.onGround;
}

function onAbilityUsed(data) {
  // Esegui il potere del giocatore remoto localmente
  if (data.playerIndex === remotePlayerIndex && p[remotePlayerIndex]) {
    usePower(remotePlayerIndex);
  }
}

function onGameStateChanged(data) {
  if (data.playerIndex === remotePlayerIndex && p[remotePlayerIndex]) {
    const pp = p[remotePlayerIndex];
    const d  = data.data;
    if (d.damage !== undefined) { pp.damage = d.damage; updPct(remotePlayerIndex); }
    if (d.stocks !== undefined) { pp.stocks = d.stocks; buildLives(remotePlayerIndex); }
    if (d.isDead !== undefined)   pp.isDead = d.isDead;
  }
}

function onGameStarted(data) {
  console.log('[MP] Partita iniziata');
  // Avvia la partita in modalità multiplayer
  if (!sel1 || !sel2) {
    // Se i personaggi non sono stati selezionati, usa i default
    sel1 = sel1 || 'Brutus';
    sel2 = sel2 || 'Tornari';
  }
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
  mpSetStatus('⚠️ L\'avversario ha abbandonato la partita', 'warn');
  isMultiplayer = false;
  if (started) {
    // Dichiara vincitore il giocatore rimasto
    const winner = localPlayerIndex === 0 ? sel1 : sel2;
    showResult(winner);
  }
}

/* ============================================================
   INVIO DATI AL SERVER
============================================================ */

/**
 * Invia l'aggiornamento di movimento del giocatore locale.
 * Throttled a UPDATE_INTERVAL ms.
 */
function sendPlayerMove() {
  if (!isMultiplayer || !socket || !socket.connected) return;
  if (!p[localPlayerIndex]) return;

  const now = Date.now();
  if (now - lastUpdateTime < UPDATE_INTERVAL) return;
  lastUpdateTime = now;

  const pp = p[localPlayerIndex];
  socket.emit('playerMove', {
    x:        pp.x,
    y:        pp.y,
    vx:       pp.vx,
    vy:       pp.vy,
    facing:   pp.facing,
    onGround: pp.onGround,
    crouching:pp.crouching,
    atkT:     pp.atkT,
    atkAnim:  pp.atkAnim,
    damage:   pp.damage,
    stocks:   pp.stocks,
    isDead:   pp.isDead,
  });
}

/**
 * Notifica l'uso di un'abilità speciale al server.
 * @param {number} pi - Indice del giocatore
 */
function onPowerUsed(pi) {
  if (!isMultiplayer || pi !== localPlayerIndex) return;
  if (!socket || !socket.connected) return;
  const pp = p[pi];
  socket.emit('useAbility', {
    abilityType:  pp.ch.powType,
    targetIndex:  remotePlayerIndex,
  });
}

/**
 * Notifica un cambio di stato del giocatore locale.
 * @param {number} pi - Indice del giocatore
 */
function onPlayerStateChanged(pi) {
  if (!isMultiplayer || pi !== localPlayerIndex) return;
  if (!socket || !socket.connected) return;
  const pp = p[pi];
  socket.emit('gameStateUpdate', {
    damage: pp.damage,
    stocks: pp.stocks,
    isDead: pp.isDead,
    x:      pp.x,
    y:      pp.y,
  });
}

/**
 * Chiamata nel loop di gioco per sincronizzare i dati.
 */
function updateMultiplayer() {
  if (!isMultiplayer) return;
  sendPlayerMove();
}

/* ============================================================
   PING
============================================================ */

function startPing() {
  stopPing();
  pingIv = setInterval(() => {
    if (!socket || !socket.connected) return;
    const t0 = Date.now();
    socket.emit('ping', (res) => {
      currentPing = Date.now() - t0;
      const el = document.getElementById('mp-room-ping');
      if (el) el.textContent = `Ping: ${currentPing}ms`;
    });
  }, 3000);
}

function stopPing() {
  if (pingIv) { clearInterval(pingIv); pingIv = null; }
}

/* ============================================================
   UTILITY
============================================================ */

function isInMultiplayer()    { return isMultiplayer; }
function getRoomCode()        { return currentRoomCode; }
function getLocalPlayerIndex(){ return localPlayerIndex; }

function disconnectMultiplayer() {
  stopPing();
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  isMultiplayer     = false;
  currentRoomCode   = null;
  localPlayerIndex  = null;
  remotePlayerIndex = null;
}

console.log('[MULTIPLAYER] Modulo caricato — Backend:', window.BACKEND_URL || '(non configurato)');
