/**
 * server.js — Battaglia Navale Smash Backend
 * Server Node.js con Express e Socket.io per il multiplayer
 * Gestisce stanze, sincronizzazione giocatori e abilità
 *
 * BUGFIX v1.1:
 * - CORS: aggiunto supporto per origini multiple e wildcard sicuro
 * - Socket.io: aggiunto allowEIO3 per compatibilità con client più vecchi
 * - Socket.io: aggiunto transports con polling come fallback
 * - Aggiunto endpoint /api/ping per test di connessione rapido
 * - Migliorata la gestione degli errori di connessione
 * - Aggiunto cleanup automatico delle stanze inattive (>30 minuti)
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

/* ============================================================
   CONFIGURAZIONE CORS
   Permette connessioni da qualsiasi origine in development,
   oppure solo dall'URL del frontend in production.
============================================================ */

// Funzione di validazione origine CORS
function corsOriginValidator(origin, callback) {
  // Permetti richieste senza origine (es. Postman, curl, file://)
  if (!origin) return callback(null, true);

  // In development o senza FRONTEND_URL configurato: permetti tutto
  if (!process.env.FRONTEND_URL || process.env.NODE_ENV !== 'production') {
    return callback(null, true);
  }

  // In production: permetti solo l'URL del frontend e localhost
  const allowed = [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
  ];

  if (allowed.includes(origin)) {
    callback(null, true);
  } else {
    console.warn(`[CORS] Origine bloccata: ${origin}`);
    callback(new Error('CORS: origine non consentita'));
  }
}

const corsOptions = {
  origin: corsOriginValidator,
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
};

const io = socketIo(server, {
  cors: {
    origin: corsOriginValidator,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Supporto per polling come fallback (utile quando WebSocket è bloccato)
  transports: ['websocket', 'polling'],
  // Compatibilità con versioni precedenti di Socket.io client
  allowEIO3: true,
  // Timeout ping/pong per rilevare connessioni cadute
  pingTimeout: 20000,
  pingInterval: 10000,
});

// Middleware — CORS, JSON e file statici
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../battaglia_navale_smash')));

/* ============================================================
   STRUTTURA DATI GLOBALE
============================================================ */

/**
 * Mappa delle stanze attive
 * rooms[roomCode] = {
 *   code: string,
 *   players: { socketId: { id, name, character, x, y, damage, ... } },
 *   state: 'waiting' | 'playing' | 'finished',
 *   createdAt: timestamp,
 *   lastActivity: timestamp,
 *   gameState: { timer, p1Stocks, p2Stocks, ... }
 * }
 */
const rooms = {};

/**
 * Mappa socket -> roomCode per tracking veloce
 */
const socketToRoom = {};

/* ============================================================
   UTILITY
============================================================ */

/**
 * Genera un codice stanza casuale (4 caratteri)
 * @returns {string} Codice stanza
 */
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

/**
 * Ottiene una stanza per codice
 * @param {string} roomCode
 * @returns {Object|null} Stanza o null
 */
function getRoom(roomCode) {
  return rooms[roomCode] || null;
}

/**
 * Crea una nuova stanza
 * @param {string} roomCode
 * @returns {Object} Stanza creata
 */
function createRoom(roomCode) {
  const room = {
    code: roomCode,
    players: {},
    state: 'waiting',
    createdAt: Date.now(),
    lastActivity: Date.now(),
    gameState: {
      timer: 180,
      started: false,
    },
  };
  rooms[roomCode] = room;
  return room;
}

/**
 * Aggiorna il timestamp di ultima attività di una stanza
 * @param {string} roomCode
 */
function touchRoom(roomCode) {
  const room = getRoom(roomCode);
  if (room) room.lastActivity = Date.now();
}

/**
 * Aggiunge un giocatore a una stanza
 * @param {string} roomCode
 * @param {string} socketId
 * @param {Object} playerData
 */
function addPlayerToRoom(roomCode, socketId, playerData) {
  const room = getRoom(roomCode);
  if (!room) return false;

  const playerCount = Object.keys(room.players).length;
  if (playerCount >= 2) return false; // Max 2 giocatori

  room.players[socketId] = {
    id: socketId,
    index: playerCount,
    ...playerData,
    x: playerCount === 0 ? 0.28 : 0.72,
    y: 0.7,
    damage: 0,
    stocks: 3,
    isDead: false,
  };

  socketToRoom[socketId] = roomCode;
  touchRoom(roomCode);
  return true;
}

/**
 * Rimuove un giocatore da una stanza
 * @param {string} roomCode
 * @param {string} socketId
 */
function removePlayerFromRoom(roomCode, socketId) {
  const room = getRoom(roomCode);
  if (!room) return;

  delete room.players[socketId];
  delete socketToRoom[socketId];

  // Elimina la stanza se vuota
  if (Object.keys(room.players).length === 0) {
    delete rooms[roomCode];
  }
}

/**
 * Cleanup automatico delle stanze inattive da più di 30 minuti
 */
function cleanupInactiveRooms() {
  const now = Date.now();
  const TIMEOUT = 30 * 60 * 1000; // 30 minuti
  let cleaned = 0;
  for (const code in rooms) {
    if (now - rooms[code].lastActivity > TIMEOUT) {
      delete rooms[code];
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`[CLEANUP] Rimosse ${cleaned} stanze inattive`);
  }
}

// Esegui cleanup ogni 10 minuti
setInterval(cleanupInactiveRooms, 10 * 60 * 1000);

/* ============================================================
   SOCKET.IO EVENTS
============================================================ */

io.on('connection', (socket) => {
  console.log(`[CONNECT] Socket ${socket.id} connesso da ${socket.handshake.address}`);

  /**
   * Evento: joinRoom
   * Client richiede di unirsi a una stanza
   * Payload: { roomCode, playerName, character }
   */
  socket.on('joinRoom', (data, callback) => {
    // Validazione callback
    if (typeof callback !== 'function') {
      console.warn(`[JOIN] Callback mancante da ${socket.id}`);
      return;
    }

    const { roomCode, playerName, character } = data || {};

    if (!roomCode || !playerName || !character) {
      callback({ success: false, message: 'Dati mancanti (roomCode, playerName, character)' });
      return;
    }

    let room = getRoom(roomCode);
    if (!room) {
      room = createRoom(roomCode);
    }

    const playerCount = Object.keys(room.players).length;
    if (playerCount >= 2) {
      callback({ success: false, message: 'Stanza piena (massimo 2 giocatori)' });
      return;
    }

    // Controlla se il socket è già in questa stanza
    if (socketToRoom[socket.id] === roomCode) {
      callback({ success: false, message: 'Sei già in questa stanza' });
      return;
    }

    // Aggiungi il giocatore
    const success = addPlayerToRoom(roomCode, socket.id, {
      name: playerName,
      character,
    });

    if (!success) {
      callback({ success: false, message: 'Errore durante l\'aggiunta del giocatore' });
      return;
    }

    // Unisci il socket alla stanza
    socket.join(roomCode);

    // Callback di successo
    callback({
      success: true,
      roomCode,
      playerIndex: room.players[socket.id].index,
      players: Object.values(room.players),
    });

    // Notifica gli altri giocatori
    socket.to(roomCode).emit('playerJoined', {
      playerIndex: room.players[socket.id].index,
      playerName,
      character,
      players: Object.values(room.players),
    });

    console.log(`[JOIN] ${playerName} (${character}) in stanza ${roomCode} [slot ${room.players[socket.id].index}]`);

    // Se la stanza è piena, notifica per iniziare
    if (Object.keys(room.players).length === 2) {
      io.to(roomCode).emit('roomReady', {
        players: Object.values(room.players),
      });
      console.log(`[READY] Stanza ${roomCode} pronta — 2 giocatori connessi`);
    }
  });

  /**
   * Evento: playerMove
   * Client invia i dati di movimento del giocatore
   * Payload: { x, y, vx, vy, facing, ... }
   */
  socket.on('playerMove', (data) => {
    const roomCode = socketToRoom[socket.id];
    if (!roomCode) return;

    const room = getRoom(roomCode);
    if (!room || !room.players[socket.id]) return;

    // Aggiorna i dati del giocatore
    Object.assign(room.players[socket.id], data);
    touchRoom(roomCode);

    // Invia a tutti gli altri giocatori nella stanza
    socket.to(roomCode).emit('playerMoved', {
      playerId: socket.id,
      playerIndex: room.players[socket.id].index,
      data,
    });
  });

  /**
   * Evento: useAbility
   * Client notifica l'uso di un'abilità speciale
   * Payload: { abilityType, targetIndex }
   */
  socket.on('useAbility', (data) => {
    const roomCode = socketToRoom[socket.id];
    if (!roomCode) return;

    const room = getRoom(roomCode);
    if (!room || !room.players[socket.id]) return;

    const playerIndex = room.players[socket.id].index;
    touchRoom(roomCode);

    // Broadcast a tutti i giocatori nella stanza
    io.to(roomCode).emit('abilityUsed', {
      playerId: socket.id,
      playerIndex,
      ...data,
    });

    console.log(`[ABILITY] Player ${playerIndex} in ${roomCode}: ${data.abilityType}`);
  });

  /**
   * Evento: gameStateUpdate
   * Client invia aggiornamenti dello stato di gioco
   * Payload: { damage, stocks, isDead, ... }
   */
  socket.on('gameStateUpdate', (data) => {
    const roomCode = socketToRoom[socket.id];
    if (!roomCode) return;

    const room = getRoom(roomCode);
    if (!room || !room.players[socket.id]) return;

    // Aggiorna lo stato del giocatore
    Object.assign(room.players[socket.id], data);
    touchRoom(roomCode);

    // Broadcast a tutti
    io.to(roomCode).emit('gameStateChanged', {
      playerId: socket.id,
      playerIndex: room.players[socket.id].index,
      data,
    });
  });

  /**
   * Evento: startGame
   * Client richiede l'inizio della partita
   */
  socket.on('startGame', () => {
    const roomCode = socketToRoom[socket.id];
    if (!roomCode) return;

    const room = getRoom(roomCode);
    if (!room) return;

    if (Object.keys(room.players).length < 2) {
      socket.emit('error', { message: 'Attendere il secondo giocatore prima di iniziare' });
      return;
    }

    room.state = 'playing';
    room.gameState.started = true;
    room.gameState.timer = 180;
    touchRoom(roomCode);

    io.to(roomCode).emit('gameStarted', {
      players: Object.values(room.players),
      timer: room.gameState.timer,
    });

    console.log(`[START] Partita iniziata in stanza ${roomCode}`);
  });

  /**
   * Evento: endGame
   * Client notifica la fine della partita
   * Payload: { winnerId, reason }
   */
  socket.on('endGame', (data) => {
    const roomCode = socketToRoom[socket.id];
    if (!roomCode) return;

    const room = getRoom(roomCode);
    if (!room) return;

    room.state = 'finished';
    touchRoom(roomCode);

    io.to(roomCode).emit('gameEnded', {
      winnerId: data.winnerId,
      reason: data.reason,
      players: Object.values(room.players),
    });

    console.log(`[END] Partita terminata in stanza ${roomCode}`);
  });

  /**
   * Evento: disconnect
   * Client si disconnette
   */
  socket.on('disconnect', (reason) => {
    const roomCode = socketToRoom[socket.id];
    if (roomCode) {
      const room = getRoom(roomCode);
      if (room) {
        const playerName = room.players[socket.id]?.name || 'Sconosciuto';
        removePlayerFromRoom(roomCode, socket.id);

        // Notifica gli altri giocatori
        io.to(roomCode).emit('playerLeft', {
          playerId: socket.id,
          playerName,
        });

        console.log(`[DISCONNECT] ${playerName} ha lasciato la stanza ${roomCode} (motivo: ${reason})`);
      }
    }
    console.log(`[DISCONNECT] Socket ${socket.id} disconnesso (motivo: ${reason})`);
  });

  /**
   * Evento: ping
   * Health check per verificare la connessione
   */
  socket.on('ping', (callback) => {
    if (typeof callback === 'function') {
      callback({ pong: true, timestamp: Date.now() });
    }
  });
});

/* ============================================================
   ROUTE HTTP
============================================================ */

/**
 * GET /api/rooms
 * Ritorna la lista delle stanze attive (debug)
 */
app.get('/api/rooms', (req, res) => {
  const roomsList = Object.values(rooms).map(room => ({
    code: room.code,
    players: Object.values(room.players).map(p => ({
      name: p.name,
      character: p.character,
      index: p.index,
    })),
    state: room.state,
    createdAt: new Date(room.createdAt).toISOString(),
    lastActivity: new Date(room.lastActivity).toISOString(),
  }));
  res.json(roomsList);
});

/**
 * GET /api/health
 * Health check del server
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeRooms: Object.keys(rooms).length,
    connectedClients: io.engine.clientsCount,
    uptime: Math.floor(process.uptime()) + 's',
    environment: process.env.NODE_ENV || 'development',
  });
});

/**
 * GET /api/ping
 * Ping rapido per verificare la raggiungibilità del server
 */
app.get('/api/ping', (req, res) => {
  res.json({ pong: true, timestamp: Date.now() });
});

/**
 * GET /
 * Serve il file index.html
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../battaglia_navale_smash/index.html'));
});

/* ============================================================
   AVVIO SERVER
============================================================ */

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n╔════════════════════════════════════════╗`);
  console.log(`║  BATTAGLIA NAVALE SMASH - Backend     ║`);
  console.log(`║  Server in ascolto su porta ${PORT}       ║`);
  console.log(`║  Ambiente: ${(process.env.NODE_ENV || 'development').padEnd(14)}          ║`);
  console.log(`╚════════════════════════════════════════╝\n`);
});

// Gestione errori non catturati
process.on('uncaughtException', (err) => {
  console.error('[ERROR] Errore non gestito:', err.message);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[ERROR] Promise rejection non gestita:', reason);
});
