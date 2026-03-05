/**
 * server.js — Battaglia Navale Smash Backend
 * Server Node.js con Express e Socket.io per il multiplayer
 * Gestisce stanze, sincronizzazione giocatori e abilità
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
// CORS: usa FRONTEND_URL da variabile d'ambiente Render, oppure permetti tutto in development
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:5173']
  : '*';

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});

// Middleware — CORS configurato con variabile d'ambiente FRONTEND_URL
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
}));
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
    gameState: {
      timer: 180,
      started: false,
    },
  };
  rooms[roomCode] = room;
  return room;
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

/* ============================================================
   SOCKET.IO EVENTS
============================================================ */

io.on('connection', (socket) => {
  console.log(`[CONNECT] Socket ${socket.id} connesso`);

  /**
   * Evento: joinRoom
   * Client richiede di unirsi a una stanza
   * Payload: { roomCode, playerName, character }
   */
  socket.on('joinRoom', (data, callback) => {
    const { roomCode, playerName, character } = data;
    
    if (!roomCode || !playerName || !character) {
      callback({ success: false, message: 'Dati mancanti' });
      return;
    }

    let room = getRoom(roomCode);
    if (!room) {
      room = createRoom(roomCode);
    }

    const playerCount = Object.keys(room.players).length;
    if (playerCount >= 2) {
      callback({ success: false, message: 'Stanza piena' });
      return;
    }

    // Aggiungi il giocatore
    const success = addPlayerToRoom(roomCode, socket.id, {
      name: playerName,
      character,
    });

    if (!success) {
      callback({ success: false, message: 'Errore aggiunta giocatore' });
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

    console.log(`[JOIN] ${playerName} (${character}) in stanza ${roomCode}`);

    // Se la stanza è piena, notifica per iniziare
    if (Object.keys(room.players).length === 2) {
      io.to(roomCode).emit('roomReady', {
        players: Object.values(room.players),
      });
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
      socket.emit('error', { message: 'Attendere il secondo giocatore' });
      return;
    }

    room.state = 'playing';
    room.gameState.started = true;
    room.gameState.timer = 180;

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
  socket.on('disconnect', () => {
    const roomCode = socketToRoom[socket.id];
    if (roomCode) {
      const room = getRoom(roomCode);
      if (room) {
        const playerName = room.players[socket.id]?.name || 'Unknown';
        removePlayerFromRoom(roomCode, socket.id);
        
        // Notifica gli altri giocatori
        io.to(roomCode).emit('playerLeft', {
          playerId: socket.id,
          playerName,
        });

        console.log(`[DISCONNECT] ${playerName} da stanza ${roomCode}`);
      }
    }
    console.log(`[DISCONNECT] Socket ${socket.id} disconnesso`);
  });

  /**
   * Evento: ping
   * Health check per verificare la connessione
   */
  socket.on('ping', (callback) => {
    callback({ pong: true, timestamp: Date.now() });
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
  });
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
server.listen(PORT, () => {
  console.log(`\n╔════════════════════════════════════════╗`);
  console.log(`║  BATTAGLIA NAVALE SMASH - Backend     ║`);
  console.log(`║  Server in ascolto su porta ${PORT}       ║`);
  console.log(`║  Ambiente: ${process.env.NODE_ENV || 'development'}              ║`);
  console.log(`╚════════════════════════════════════════╝\n`);
});

// Gestione errori
process.on('uncaughtException', (err) => {
  console.error('[ERROR] Errore non gestito:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[ERROR] Promise rejection:', reason);
});
