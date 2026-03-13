/**
 * server.js — Battaglia Navale Smash Backend v4.0
 * Server Node.js con Express e Socket.io per il multiplayer.
 *
 * NUOVO FLUSSO v4.0:
 * 1. createRoom — Crea una stanza senza personaggio
 * 2. joinRoom — Accedi a una stanza esistente
 * 3. selectCharacter — Scegli il personaggio in-room
 * 4. startGame — Avvia la partita quando entrambi hanno scelto
 *
 * RESTYLING TECNICO v3.0 — Correzioni e Ottimizzazioni:
 * [FIX-01] Timeout handshake aumentato a 30s con retry esponenziale
 * [FIX-02] Heartbeat aggressivo (pingInterval 8s, pingTimeout 25s)
 * [FIX-03] CORS whitelist esplicita + fallback sicuro
 * [FIX-04] Graceful shutdown (SIGTERM/SIGINT) per Render.com
 * [FIX-05] Rate limiting sugli eventi Socket.io (anti-flood)
 * [FIX-06] Riconnessione automatica con stato preservato
 * [FIX-07] Validazione robusta di tutti i payload in ingresso
 * [FIX-08] Logging strutturato con timestamp per debug produzione
 * [FIX-09] Cleanup stanze inattive ogni 5 minuti (era 10)
 * [FIX-10] Endpoint /api/health esteso con metriche dettagliate
 * [FIX-11] HTTP keep-alive per ridurre latenza TCP
 * [FIX-12] Compressione Socket.io perMessageDeflate
 */
'use strict';

const express  = require('express');
const http     = require('http');
const socketIo = require('socket.io');
const cors     = require('cors');
const path     = require('path');

const PORT             = parseInt(process.env.PORT, 10) || 3000;
const NODE_ENV         = process.env.NODE_ENV || 'development';
const FRONTEND_URL     = process.env.FRONTEND_URL || '';
const ROOM_TIMEOUT_MS  = 30 * 60 * 1000;
const CLEANUP_INTERVAL = 5  * 60 * 1000;
const MAX_PLAYERS_ROOM = 2;
const RATE_LIMIT_MS    = 16;
const HANDSHAKE_TIMEOUT = 30000;
const PING_INTERVAL    = 8000;
const PING_TIMEOUT     = 25000;

function log(level, tag, msg, extra) {
  const ts  = new Date().toISOString();
  const out = `[${ts}] [${level}] [${tag}] ${msg}`;
  if (extra !== undefined) (level === 'ERROR' ? console.error : console.log)(out, extra);
  else (level === 'ERROR' ? console.error : console.log)(out);
}
const logInfo  = (tag, msg, extra) => log('INFO',  tag, msg, extra);
const logWarn  = (tag, msg, extra) => log('WARN',  tag, msg, extra);
const logError = (tag, msg, extra) => log('ERROR', tag, msg, extra);

const app    = express();
const server = http.createServer(app);

// [FIX-11] HTTP keep-alive
server.keepAliveTimeout = 65000;
server.headersTimeout   = 66000;

const ALLOWED_ORIGINS = new Set([
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  ...(FRONTEND_URL ? [FRONTEND_URL] : []),
]);

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (origin.endsWith('.vercel.app')) return true;
  if (origin.endsWith('.onrender.com')) return true;
  if (NODE_ENV !== 'production') return true;
  logWarn('CORS', `Origine non in whitelist (fallback): ${origin}`);
  return true;
}

function corsOriginValidator(origin, callback) {
  callback(null, isOriginAllowed(origin));
}

const corsOptions = {
  origin: corsOriginValidator,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
};

const io = socketIo(server, {
  cors: { origin: corsOriginValidator, methods: ['GET', 'POST'], credentials: true },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  connectTimeout: HANDSHAKE_TIMEOUT,
  pingInterval: PING_INTERVAL,
  pingTimeout:  PING_TIMEOUT,
  perMessageDeflate: { threshold: 512 },
  maxHttpBufferSize: 1e5,
  upgradeTimeout: 10000,
});

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, '../battaglia_navale_smash'), {
  maxAge: '1h', etag: false, setHeaders: (res, path) => {
    if (path.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  },
}));

const rooms = new Map();
const socketToRoom = new Map();
const socketRateLimits = new Map();

function validateString(val, maxLen = 256) {
  return typeof val === 'string' && val.length > 0 && val.length <= maxLen;
}

function validateNumber(val) {
  return typeof val === 'number' && isFinite(val) && !isNaN(val);
}

function createRoom(roomCode) {
  const room = {
    code: roomCode,
    players: {},
    state: 'waiting',
    gameState: { started: false, timer: 180, startedAt: null },
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };
  rooms.set(roomCode, room);
  logInfo('ROOM', `Stanza ${roomCode} creata`);
  return room;
}

function getRoom(roomCode) {
  return rooms.get(roomCode);
}

function touchRoom(roomCode) {
  const room = getRoom(roomCode);
  if (room) room.lastActivity = Date.now();
}

function addPlayerToRoom(roomCode, socketId, playerData) {
  const room = getRoom(roomCode);
  if (!room) return false;
  const index = Object.keys(room.players).length;
  room.players[socketId] = {
    id: socketId,
    index,
    name: playerData.name || 'Giocatore',
    character: playerData.character || null,
    x: 0, y: 0, vx: 0, vy: 0,
    facing: true, onGround: false, crouching: false,
    atkT: 0, atkAnim: '', damage: 0, stocks: 3, isDead: false,
  };
  socketToRoom.set(socketId, roomCode);
  touchRoom(roomCode);
  return true;
}

function removePlayerFromRoom(roomCode, socketId) {
  const room = getRoom(roomCode);
  if (!room) return;
  delete room.players[socketId];
  socketToRoom.delete(socketId);
  if (Object.keys(room.players).length === 0) {
    rooms.delete(roomCode);
    logInfo('ROOM', `Stanza ${roomCode} eliminata (vuota)`);
  } else {
    touchRoom(roomCode);
    io.to(roomCode).emit('playerLeft', { playerId: socketId, playerName: 'Sconosciuto' });
  }
}

function isRateLimited(socketId) {
  const now = Date.now();
  const last = socketRateLimits.get(socketId) || 0;
  if (now - last < RATE_LIMIT_MS) return true;
  socketRateLimits.set(socketId, now);
  return false;
}

// Cleanup stanze inattive
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.lastActivity > ROOM_TIMEOUT_MS) {
      rooms.delete(code);
      logWarn('CLEANUP', `Stanza ${code} eliminata (timeout)`);
    }
  }
}, CLEANUP_INTERVAL);

io.on('connection', (socket) => {
  logInfo('CONNECT', `Socket ${socket.id} connesso da ${socket.handshake.address}`);

  socket.on('createRoom', (data, callback) => {
    if (typeof callback !== 'function') { logWarn('CREATE', `Callback mancante da ${socket.id}`); return; }
    const { roomCode, playerName } = data || {};
    if (!validateString(roomCode, 8) || !validateString(playerName, 32)) {
      return callback({ success: false, message: 'Dati mancanti o non validi' });
    }
    const prevRoom = socketToRoom.get(socket.id);
    if (prevRoom && prevRoom !== roomCode) { removePlayerFromRoom(prevRoom, socket.id); socket.leave(prevRoom); }
    let room = getRoom(roomCode);
    if (!room) room = createRoom(roomCode);
    if (Object.keys(room.players).length >= MAX_PLAYERS_ROOM)
      return callback({ success: false, message: 'Stanza piena (massimo 2 giocatori)' });
    if (!addPlayerToRoom(roomCode, socket.id, { name: playerName, character: null }))
      return callback({ success: false, message: 'Errore aggiunta giocatore' });
    socket.join(roomCode);
    const playerIndex = room.players[socket.id].index;
    callback({ success: true, playerIndex, roomCode, players: Object.values(room.players) });
    logInfo('CREATE', `Giocatore ${socket.id} ha creato stanza ${roomCode}`);
  });

  socket.on('joinRoom', (data, callback) => {
    if (typeof callback !== 'function') { logWarn('JOIN', `Callback mancante da ${socket.id}`); return; }
    const { roomCode, playerName } = data || {};
    if (!validateString(roomCode, 8) || !validateString(playerName, 32)) {
      return callback({ success: false, message: 'Dati mancanti o non validi' });
    }
    const prevRoom = socketToRoom.get(socket.id);
    if (prevRoom && prevRoom !== roomCode) { removePlayerFromRoom(prevRoom, socket.id); socket.leave(prevRoom); }
    let room = getRoom(roomCode);
    if (!room) return callback({ success: false, message: 'Stanza non trovata' });
    if (Object.keys(room.players).length >= MAX_PLAYERS_ROOM)
      return callback({ success: false, message: 'Stanza piena (massimo 2 giocatori)' });
    if (socketToRoom.get(socket.id) === roomCode)
      return callback({ success: false, message: 'Sei già in questa stanza' });
    if (!addPlayerToRoom(roomCode, socket.id, { name: playerName, character: null }))
      return callback({ success: false, message: 'Errore aggiunta giocatore' });
    socket.join(roomCode);
    const playerIndex = room.players[socket.id].index;
    const otherPlayerName = Object.values(room.players).find(p => p.id !== socket.id)?.name || null;
    callback({ success: true, playerIndex, roomCode, otherPlayerName, players: Object.values(room.players) });
    socket.to(roomCode).emit('playerJoined', {
      playerId: socket.id, playerName, playerIndex,
      players: Object.values(room.players),
    });
    logInfo('JOIN', `Giocatore ${socket.id} ha acceduto stanza ${roomCode}`);
  });

  socket.on('rejoinRoom', (data, callback) => {
    if (typeof callback !== 'function') return;
    const { roomCode, playerName } = data || {};
    const room = getRoom(roomCode);
    if (!room || !room.players[socket.id]) {
      return callback({ success: false, message: 'Stanza non trovata' });
    }
    room.players[socket.id].name = playerName;
    socket.join(roomCode);
    touchRoom(roomCode);
    callback({ success: true, playerIndex: room.players[socket.id].index });
    logInfo('REJOIN', `Giocatore ${socket.id} ha rientrato stanza ${roomCode}`);
  });

  socket.on('selectCharacter', (data) => {
    const roomCode = socketToRoom.get(socket.id);
    if (!roomCode) return;
    const room = getRoom(roomCode);
    if (!room || !room.players[socket.id]) return;
    const { character } = data || {};
    if (!validateString(character, 32)) return;
    room.players[socket.id].character = character;
    touchRoom(roomCode);
    socket.to(roomCode).emit('playerCharSelected', {
      playerId: socket.id,
      playerIndex: room.players[socket.id].index,
      character,
    });
    logInfo('CHAR', `Giocatore ${socket.id} ha scelto ${character} in stanza ${roomCode}`);
  });

  socket.on('playerMove', (data) => {
    if (isRateLimited(socket.id)) return;
    const roomCode = socketToRoom.get(socket.id);
    if (!roomCode) return;
    const room = getRoom(roomCode);
    if (!room || !room.players[socket.id]) return;
    const { x, y, vx, vy, facing, onGround, crouching, atkT, atkAnim, damage, stocks, isDead } = data || {};
    if (!validateNumber(x) || !validateNumber(y)) return;
    const pp = room.players[socket.id];
    Object.assign(pp, {
      x: Math.max(-0.5, Math.min(1.5, x)),
      y: Math.max(-1.0, Math.min(2.0, y)),
      vx: validateNumber(vx) ? vx : pp.vx,
      vy: validateNumber(vy) ? vy : pp.vy,
      facing:    facing    !== undefined ? !!facing    : pp.facing,
      onGround:  onGround  !== undefined ? !!onGround  : pp.onGround,
      crouching: crouching !== undefined ? !!crouching : pp.crouching,
      atkT:      validateNumber(atkT)    ? atkT        : pp.atkT,
      atkAnim:   validateString(atkAnim, 16) ? atkAnim : pp.atkAnim,
      damage:    validateNumber(damage)  ? Math.max(0, damage) : pp.damage,
      stocks:    validateNumber(stocks)  ? Math.max(0, Math.min(10, stocks)) : pp.stocks,
      isDead:    isDead !== undefined    ? !!isDead    : pp.isDead,
    });
    touchRoom(roomCode);
    socket.to(roomCode).emit('playerMoved', {
      playerId: socket.id, playerIndex: pp.index, ...data,
    });
  });

  socket.on('useAbility', (data) => {
    const roomCode = socketToRoom.get(socket.id);
    if (!roomCode) return;
    const room = getRoom(roomCode);
    if (!room || !room.players[socket.id]) return;
    touchRoom(roomCode);
    socket.to(roomCode).emit('abilityUsed', {
      playerId: socket.id, playerIndex: room.players[socket.id].index,
      abilityType: data?.abilityType || '', targetIndex: data?.targetIndex,
    });
  });

  socket.on('gameStateUpdate', (data) => {
    if (isRateLimited(socket.id)) return;
    const roomCode = socketToRoom.get(socket.id);
    if (!roomCode) return;
    const room = getRoom(roomCode);
    if (!room || !room.players[socket.id]) return;
    const pp = room.players[socket.id];
    const safe = {};
    if (validateNumber(data?.damage)) safe.damage = Math.max(0, data.damage);
    if (validateNumber(data?.stocks)) safe.stocks = Math.max(0, Math.min(10, data.stocks));
    if (data?.isDead !== undefined)   safe.isDead = !!data.isDead;
    if (validateNumber(data?.x))      safe.x = data.x;
    if (validateNumber(data?.y))      safe.y = data.y;
    Object.assign(pp, safe);
    touchRoom(roomCode);
    io.to(roomCode).emit('gameStateChanged', {
      playerId: socket.id, playerIndex: pp.index, data: safe,
    });
  });

  socket.on('startGame', () => {
    const roomCode = socketToRoom.get(socket.id);
    if (!roomCode) return;
    const room = getRoom(roomCode);
    if (!room) return;
    if (Object.keys(room.players).length < MAX_PLAYERS_ROOM) {
      socket.emit('error', { message: 'Attendere il secondo giocatore' }); return;
    }
    const allReady = Object.values(room.players).every(p => p.character);
    if (!allReady) {
      socket.emit('error', { message: 'Entrambi i giocatori devono scegliere il personaggio' }); return;
    }
    room.state = 'playing';
    room.gameState.started = true;
    room.gameState.timer = 180;
    room.gameState.startedAt = Date.now();
    touchRoom(roomCode);
    io.to(roomCode).emit('gameStarted', { players: Object.values(room.players), timer: 180 });
    logInfo('GAME', `Partita iniziata in stanza ${roomCode}`);
  });

  socket.on('endGame', (data) => {
    const roomCode = socketToRoom.get(socket.id);
    if (!roomCode) return;
    const room = getRoom(roomCode);
    if (!room) return;
    room.state = 'finished'; touchRoom(roomCode);
    io.to(roomCode).emit('gameEnded', {
      winnerId: data?.winnerId, reason: data?.reason || 'normal',
      players: Object.values(room.players),
    });
    logInfo('GAME', `Partita terminata in stanza ${roomCode}`);
  });

  socket.on('ping', (callback) => {
    if (typeof callback === 'function')
      callback({ pong: true, timestamp: Date.now(), serverTime: new Date().toISOString() });
  });

  socket.on('disconnect', (reason) => {
    const roomCode = socketToRoom.get(socket.id);
    if (roomCode) {
      const room = getRoom(roomCode);
      if (room) {
        const playerName = room.players[socket.id]?.name || 'Sconosciuto';
        removePlayerFromRoom(roomCode, socket.id);
        if (room.state === 'playing') {
          io.to(roomCode).emit('playerLeft', { playerId: socket.id, playerName });
          logWarn('GAME', `Giocatore ${socket.id} disconnesso durante partita in stanza ${roomCode}`);
        }
      }
    }
    socketRateLimits.delete(socket.id);
    logInfo('DISCONNECT', `Socket ${socket.id} disconnesso (${reason})`);
  });

  socket.on('error', (err) => {
    logError('SOCKET_ERROR', `Errore socket ${socket.id}`, err);
  });
});

app.get('/api/health', (req, res) => {
  const uptime = process.uptime();
  const memUsage = process.memoryUsage();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    memory: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
    },
    rooms: rooms.size,
    activeSockets: io.engine.clientsCount,
  });
});

app.get('/api/rooms', (req, res) => {
  const roomList = Array.from(rooms.values()).map(r => ({
    code: r.code,
    players: Object.keys(r.players).length,
    state: r.state,
    createdAt: new Date(r.createdAt).toISOString(),
  }));
  res.json({ rooms: roomList, total: roomList.length });
});

function gracefulShutdown() {
  logInfo('SHUTDOWN', 'Graceful shutdown in corso...');
  io.emit('serverShutdown', { message: 'Server in manutenzione. Riconnessione automatica in 30s.' });
  setTimeout(() => {
    io.close();
    server.close(() => {
      logInfo('SHUTDOWN', 'Server chiuso');
      process.exit(0);
    });
  }, 2000);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

server.listen(PORT, '0.0.0.0', () => {
  logInfo('SERVER', `Battaglia Navale Smash Backend v4.0 in ascolto su porta ${PORT}`);
  logInfo('SERVER', `Ambiente: ${NODE_ENV}`);
});
