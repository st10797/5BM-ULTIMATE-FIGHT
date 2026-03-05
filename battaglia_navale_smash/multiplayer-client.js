/**
 * multiplayer-client.js — Battaglia Navale Smash Client Multiplayer
 * Gestisce la connessione Socket.io e la sincronizzazione con il server
 * Dipende da: config.js, engine.js, powers.js
 */

/* ============================================================
   CONFIGURAZIONE SOCKET.IO
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

/** Socket ID del giocatore remoto */
let remotePlayerId = null;

/** Timestamp dell'ultimo update inviato */
let lastUpdateTime = 0;

/** Intervallo minimo tra gli update (ms) per ridurre il traffico */
const UPDATE_INTERVAL = 50; // 20 aggiornamenti al secondo

/* ============================================================
   INIZIALIZZAZIONE SOCKET.IO
============================================================ */

/**
 * Inizializza la connessione Socket.io con il server
 * @param {string} serverUrl - URL del server (es. 'http://localhost:3000')
 */
function initSocket(serverUrl = '') {
  if (typeof io === 'undefined') {
    console.warn('[MULTIPLAYER] Socket.io non disponibile');
    return;
  }

  socket = io(serverUrl, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  // Event listeners
  socket.on('connect', onSocketConnect);
  socket.on('disconnect', onSocketDisconnect);
  socket.on('playerJoined', onPlayerJoined);
  socket.on('roomReady', onRoomReady);
  socket.on('playerMoved', onPlayerMoved);
  socket.on('abilityUsed', onAbilityUsed);
  socket.on('gameStateChanged', onGameStateChanged);
  socket.on('gameStarted', onGameStarted);
  socket.on('gameEnded', onGameEnded);
  socket.on('playerLeft', onPlayerLeft);
  socket.on('error', onSocketError);

  console.log('[MULTIPLAYER] Socket.io inizializzato');
}

/* ============================================================
   SOCKET EVENT HANDLERS
============================================================ */

/**
 * Callback: connessione stabilita
 */
function onSocketConnect() {
  console.log('[MULTIPLAYER] Connesso al server');
}

/**
 * Callback: disconnessione dal server
 */
function onSocketDisconnect(reason) {
  console.log('[MULTIPLAYER] Disconnesso dal server:', reason);
  isMultiplayer = false;
  currentRoomCode = null;
}

/**
 * Callback: un altro giocatore si è unito alla stanza
 */
function onPlayerJoined(data) {
  console.log('[MULTIPLAYER] Giocatore unito:', data.playerName);
  remotePlayerId = data.players[1 - localPlayerIndex]?.id;
  remotePlayerIndex = 1 - localPlayerIndex;
}

/**
 * Callback: la stanza è pronta (2 giocatori presenti)
 */
function onRoomReady(data) {
  console.log('[MULTIPLAYER] Stanza pronta per iniziare');
  // Mostra UI per iniziare la partita
  if (document.getElementById('mp-start-btn')) {
    document.getElementById('mp-start-btn').style.display = 'block';
  }
}

/**
 * Callback: riceve l'aggiornamento di movimento dell'avversario
 */
function onPlayerMoved(data) {
  if (data.playerIndex === remotePlayerIndex && p[remotePlayerIndex]) {
    // Applica i dati ricevuti al giocatore remoto
    Object.assign(p[remotePlayerIndex], data.data);
  }
}

/**
 * Callback: riceve la notifica di un'abilità usata
 */
function onAbilityUsed(data) {
  console.log('[MULTIPLAYER] Abilità usata:', data.abilityType);
  // L'abilità è già stata eseguita sul client remoto,
  // qui possiamo aggiungere effetti visivi sincronizzati
}

/**
 * Callback: riceve l'aggiornamento dello stato di gioco
 */
function onGameStateChanged(data) {
  if (data.playerIndex === remotePlayerIndex && p[remotePlayerIndex]) {
    Object.assign(p[remotePlayerIndex], data.data);
  }
}

/**
 * Callback: la partita è iniziata
 */
function onGameStarted(data) {
  console.log('[MULTIPLAYER] Partita iniziata');
  // Sincronizza i dati dei giocatori
  data.players.forEach((pData, idx) => {
    if (p[idx]) {
      Object.assign(p[idx], pData);
    }
  });
}

/**
 * Callback: la partita è terminata
 */
function onGameEnded(data) {
  console.log('[MULTIPLAYER] Partita terminata');
  // Mostra il vincitore
  const winnerId = data.winnerId;
  const winnerIndex = data.players.findIndex(pl => pl.id === winnerId);
  if (winnerIndex >= 0) {
    showResult(data.players[winnerIndex].character);
  }
}

/**
 * Callback: un giocatore ha abbandonato
 */
function onPlayerLeft(data) {
  console.log('[MULTIPLAYER] Giocatore abbandonato:', data.playerName);
  // Termina la partita
  endGame();
}

/**
 * Callback: errore dal server
 */
function onSocketError(data) {
  console.error('[MULTIPLAYER] Errore:', data.message);
}

/* ============================================================
   FUNZIONI DI COMUNICAZIONE
============================================================ */

/**
 * Richiede di unirsi a una stanza
 * @param {string} roomCode - Codice della stanza
 * @param {string} playerName - Nome del giocatore
 * @param {string} character - Personaggio selezionato
 * @param {Function} callback - Callback di risposta
 */
function joinRoom(roomCode, playerName, character, callback) {
  if (!socket) {
    console.error('[MULTIPLAYER] Socket non inizializzato');
    callback({ success: false, message: 'Socket non disponibile' });
    return;
  }

  socket.emit('joinRoom', { roomCode, playerName, character }, (response) => {
    if (response.success) {
      isMultiplayer = true;
      currentRoomCode = roomCode;
      localPlayerIndex = response.playerIndex;
      remotePlayerIndex = 1 - localPlayerIndex;
      console.log(`[MULTIPLAYER] Unito a stanza ${roomCode} come giocatore ${localPlayerIndex}`);
    }
    callback(response);
  });
}

/**
 * Invia l'aggiornamento di movimento del giocatore locale
 * Throttled per ridurre il traffico di rete
 */
function sendPlayerMove() {
  if (!isMultiplayer || !socket || !p[localPlayerIndex]) return;

  const now = Date.now();
  if (now - lastUpdateTime < UPDATE_INTERVAL) return;
  lastUpdateTime = now;

  const pp = p[localPlayerIndex];
  socket.emit('playerMove', {
    x: pp.x,
    y: pp.y,
    vx: pp.vx,
    vy: pp.vy,
    facing: pp.facing,
    onGround: pp.onGround,
    crouching: pp.crouching,
    atkT: pp.atkT,
    atkAnim: pp.atkAnim,
    damage: pp.damage,
    stocks: pp.stocks,
    isDead: pp.isDead,
  });
}

/**
 * Notifica l'uso di un'abilità speciale
 * @param {string} abilityType - Tipo di abilità
 */
function sendAbility(abilityType) {
  if (!isMultiplayer || !socket) return;

  socket.emit('useAbility', {
    abilityType,
    targetIndex: remotePlayerIndex,
  });
}

/**
 * Invia l'aggiornamento dello stato di gioco
 * @param {Object} stateData - Dati dello stato
 */
function sendGameStateUpdate(stateData) {
  if (!isMultiplayer || !socket) return;

  socket.emit('gameStateUpdate', stateData);
}

/**
 * Richiede l'inizio della partita
 */
function sendStartGame() {
  if (!isMultiplayer || !socket) return;

  socket.emit('startGame');
}

/**
 * Notifica la fine della partita
 * @param {string} winnerId - ID del vincitore
 * @param {string} reason - Motivo della fine
 */
function sendEndGame(winnerId, reason) {
  if (!isMultiplayer || !socket) return;

  socket.emit('endGame', {
    winnerId,
    reason,
  });
}

/**
 * Invia un ping per verificare la connessione
 * @param {Function} callback - Callback con il pong
 */
function sendPing(callback) {
  if (!socket) return;

  socket.emit('ping', (response) => {
    if (callback) callback(response);
  });
}

/* ============================================================
   INTEGRAZIONE CON IL LOOP DI GIOCO
============================================================ */

/**
 * Deve essere chiamato nel loop di gioco per sincronizzare i dati
 * Tipicamente dentro la funzione loop() in engine.js
 */
function updateMultiplayer() {
  if (!isMultiplayer) return;

  // Invia l'aggiornamento di movimento del giocatore locale
  sendPlayerMove();
}

/**
 * Hook per l'uso di un'abilità
 * Deve essere chiamato quando usePower() è eseguito
 * @param {number} pi - Indice del giocatore
 */
function onPowerUsed(pi) {
  if (!isMultiplayer || pi !== localPlayerIndex) return;

  const pp = p[pi];
  const abilityType = pp.ch.powType;
  sendAbility(abilityType);
}

/**
 * Hook per l'aggiornamento dello stato di gioco
 * Deve essere chiamato quando il danno o lo stato cambia
 * @param {number} pi - Indice del giocatore
 */
function onPlayerStateChanged(pi) {
  if (!isMultiplayer || pi !== localPlayerIndex) return;

  const pp = p[pi];
  sendGameStateUpdate({
    damage: pp.damage,
    stocks: pp.stocks,
    isDead: pp.isDead,
    x: pp.x,
    y: pp.y,
  });
}

/* ============================================================
   UTILITY
============================================================ */

/**
 * Verifica se siamo in modalità multiplayer
 * @returns {boolean}
 */
function isInMultiplayer() {
  return isMultiplayer;
}

/**
 * Ottiene il codice della stanza corrente
 * @returns {string|null}
 */
function getRoomCode() {
  return currentRoomCode;
}

/**
 * Ottiene l'indice del giocatore locale
 * @returns {number|null}
 */
function getLocalPlayerIndex() {
  return localPlayerIndex;
}

/**
 * Disconnette dal server
 */
function disconnectMultiplayer() {
  if (socket) {
    socket.disconnect();
    isMultiplayer = false;
    currentRoomCode = null;
  }
}

console.log('[MULTIPLAYER] Modulo caricato');
