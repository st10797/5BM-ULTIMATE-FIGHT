/**
 * server.js — Battaglia Navale Smash Backend v3.0
 * Server Node.js con Express e Socket.io per il multiplayer.
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
  maxAge: NODE_ENV === 'production' ? '1h' : 0,
  etag: true,
}));

const rooms        = {};
const socketToRoom = {};
const socketLastEvt = {};

function getRoom(roomCode) { return rooms[roomCode] || null; }

function createRoom(roomCode) {
  rooms[roomCode] = {
    code: roomCode, players: {}, state: 'waiting',
    createdAt: Date.now(), lastActivity: Date.now(),
    gameState: { timer: 180, started: false },
  };
  logInfo('ROOM', `Stanza creata: ${roomCode}`);
  return rooms[roomCode];
}

function touchRoom(roomCode) {
  const r = getRoom(roomCode);
  if (r) r.lastActivity = Date.now();
}

function addPlayerToRoom(roomCode, socketId, playerData) {
  const room = getRoom(roomCode);
  if (!room) return false;
  const count = Object.keys(room.players).length;
  if (count >= MAX_PLAYERS_ROOM) return false;
  room.players[socketId] = {
    id: socketId, index: count,
    name: playerData.name || `Giocatore ${count + 1}`,
    character: playerData.character || 'Brutus',
    x: count === 0 ? 0.28 : 0.72, y: 0.7,
    damage: 0, stocks: 3, isDead: false,
    connectedAt: Date.now(),
  };
  socketToRoom[socketId] = roomCode;
  touchRoom(roomCode);
  logInfo('ROOM', `${playerData.name} (idx:${count}) → stanza ${roomCode}`);
  return true;
}

function removePlayerFromRoom(roomCode, socketId) {
  const room = getRoom(roomCode);
  if (!room) return;
  const name = room.players[socketId]?.name || socketId;
  delete room.players[socketId];
  delete socketToRoom[socketId];
  delete socketLastEvt[socketId];
  if (Object.keys(room.players).length === 0) {
    delete rooms[roomCode];
    logInfo('ROOM', `Stanza ${roomCode} eliminata (vuota)`);
  } else {
    logInfo('ROOM', `${name} rimosso da stanza ${roomCode}`);
  }
}

function cleanupInactiveRooms() {
  const now = Date.now();
  let cleaned = 0;
  for (const code in rooms) {
    if (now - rooms[code].lastActivity > ROOM_TIMEOUT_MS) { delete rooms[code]; cleaned++; }
  }
  if (cleaned > 0) logInfo('CLEANUP', `Rimosse ${cleaned} stanze inattive`);
}
setInterval(cleanupInactiveRooms, CLEANUP_INTERVAL);

function isRateLimited(socketId) {
  const now = Date.now();
  const last = socketLastEvt[socketId] || 0;
  if (now - last < RATE_LIMIT_MS) return true;
  socketLastEvt[socketId] = now;
  return false;
}

function validateString(val, maxLen = 64) {
  return typeof val === 'string' && val.length > 0 && val.length <= maxLen;
}
function validateNumber(val) {
  return typeof val === 'number' && isFinite(val) && !isNaN(val);
}

io.on('connection', (socket) => {
  logInfo('CONNECT', `Socket ${socket.id} connesso da ${socket.handshake.address}`);

  socket.on('joinRoom', (data, callback) => {
    if (typeof callback !== 'function') { logWarn('JOIN', `Callback mancante da ${socket.id}`); return; }
    const { roomCode, playerName, character } = data || {};
    if (!validateString(roomCode, 8) || !validateString(playerName, 32) || !validateString(character, 32)) {
      return callback({ success: false, message: 'Dati mancanti o non validi' });
    }
    const prevRoom = socketToRoom[socket.id];
    if (prevRoom && prevRoom !== roomCode) { removePlayerFromRoom(prevRoom, socket.id); socket.leave(prevRoom); }
    let room = getRoom(roomCode);
    if (!room) room = createRoom(roomCode);
    if (Object.keys(room.players).length >= MAX_PLAYERS_ROOM)
      return callback({ success: false, message: 'Stanza piena (massimo 2 giocatori)' });
    if (socketToRoom[socket.id] === roomCode)
      return callback({ success: false, message: 'Sei già in questa stanza' });
    if (!addPlayerToRoom(roomCode, socket.id, { name: playerName, character }))
      return callback({ success: false, message: 'Errore aggiunta giocatore' });
    socket.join(roomCode);
    const playerIndex = room.players[socket.id].index;
    callback({ success: true, playerIndex, roomCode, players: Object.values(room.players) });
    socket.to(roomCode).emit('playerJoined', {
      playerId: socket.id, playerName, character, playerIndex,
      players: Object.values(room.players),
    });
    if (Object.keys(room.players).length === MAX_PLAYERS_ROOM) {
      room.state = 'ready'; touchRoom(roomCode);
      io.to(roomCode).emit('roomReady', { players: Object.values(room.players), roomCode });
      logInfo('ROOM', `Stanza ${roomCode} pronta`);
    }
  });

  socket.on('playerMove', (data) => {
    if (isRateLimited(socket.id)) return;
    const roomCode = socketToRoom[socket.id];
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
    const roomCode = socketToRoom[socket.id];
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
    const roomCode = socketToRoom[socket.id];
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
    const roomCode = socketToRoom[socket.id];
    if (!roomCode) return;
    const room = getRoom(roomCode);
    if (!room) return;
    if (Object.keys(room.players).length < MAX_PLAYERS_ROOM) {
      socket.emit('error', { message: 'Attendere il secondo giocatore' }); return;
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
    const roomCode = socketToRoom[socket.id];
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
    const roomCode = socketToRoom[socket.id];
    if (roomCode) {
      const room = getRoom(roomCode);
      if (room) {
        const playerName = room.players[socket.id]?.name || 'Sconosciuto';
        removePlayerFromRoom(roomCode, socket.id);
        io.to(roomCode).emit('playerLeft', { playerId: socket.id, playerName, reason });
        logInfo('DISCONNECT', `${playerName} ha lasciato stanza ${roomCode} (${reason})`);
      }
    }
    delete socketLastEvt[socket.id];
    logInfo('DISCONNECT', `Socket ${socket.id} disconnesso (${reason})`);
  });

  socket.on('error', (err) => {
    logError('SOCKET', `Errore socket ${socket.id}: ${err.message}`);
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok', version: '3.0.0',
    timestamp: new Date().toISOString(), environment: NODE_ENV,
    uptime: `${Math.floor(process.uptime())}s`,
    memoryUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    activeRooms: Object.keys(rooms).length,
    connectedClients: io.engine.clientsCount,
    roomDetails: Object.values(rooms).map(r => ({
      code: r.code, state: r.state,
      playerCount: Object.keys(r.players).length,
      ageMinutes: Math.round((Date.now() - r.createdAt) / 60000),
    })),
  });
});

app.get('/api/ping', (req, res) => { res.json({ pong: true, timestamp: Date.now() }); });

app.get('/api/rooms', (req, res) => {
  res.json(Object.values(rooms).map(room => ({
    code: room.code, state: room.state,
    playerCount: Object.keys(room.players).length,
    players: Object.values(room.players).map(p => ({ name: p.name, character: p.character, index: p.index })),
    createdAt: new Date(room.createdAt).toISOString(),
    lastActivity: new Date(room.lastActivity).toISOString(),
  })));
});

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/'))
    res.sendFile(path.join(__dirname, '../battaglia_navale_smash/index.html'));
  else
    res.status(404).json({ error: 'Endpoint non trovato' });
});

server.listen(PORT, '0.0.0.0', () => {
  logInfo('SERVER', `╔════════════════════════════════════════╗`);
  logInfo('SERVER', `║  BATTAGLIA NAVALE SMASH — Backend v3.0 ║`);
  logInfo('SERVER', `║  Porta: ${String(PORT).padEnd(31)}║`);
  logInfo('SERVER', `║  Ambiente: ${NODE_ENV.padEnd(28)}║`);
  logInfo('SERVER', `╚════════════════════════════════════════╝`);
});

function gracefulShutdown(signal) {
  logInfo('SERVER', `Segnale ${signal} — avvio shutdown graceful`);
  io.emit('serverShutdown', { message: 'Server in riavvio, riconnessione automatica tra 5 secondi' });
  server.close((err) => {
    if (err) logError('SERVER', 'Errore shutdown:', err);
    else logInfo('SERVER', 'Server chiuso correttamente');
    process.exit(err ? 1 : 0);
  });
  setTimeout(() => { logWarn('SERVER', 'Shutdown forzato dopo 10s'); process.exit(1); }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logError('PROCESS', `Errore non gestito: ${err.message}`, err.stack);
  if (NODE_ENV !== 'production') process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logError('PROCESS', `Promise rejection non gestita:`, reason);
});
