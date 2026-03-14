/**
 * server.js — Battaglia Navale Smash Backend v5.0
 * PvP Online Realistico: API REST + WebSocket, Stati Stanza, Timeout, Cleanup
 *
 * FLUSSO v5.0:
 * 1. POST /rooms → crea stanza (state=WAITING_FOR_PLAYER)
 * 2. WS /rooms/{code} → host subscribe immediata
 * 3. POST /rooms/{code}/join → guest join, state=READY, broadcast PLAYER_JOINED
 * 4. Transizione automatica → SelezionePersonaggi
 * 5. Lock-in personaggi → MATCH_READY
 * 6. Combattimento sincronizzato con client prediction
 *
 * STATI STANZA: CREATED → WAITING_FOR_PLAYER → READY → IN_SELECTION → IN_MATCH → CANCELLED|EXPIRED
 * TIMEOUT: 120s se nessun join
 * CLEANUP: stanze inattive ogni 5 minuti
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
const ROOM_TIMEOUT_MS  = 120 * 1000;
const ROOM_INACTIVITY_MS = 30 * 60 * 1000;
const CLEANUP_INTERVAL = 5 * 60 * 1000;
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

server.keepAliveTimeout = 65000;
server.headersTimeout   = 66000;

const ALLOWED_ORIGINS = new Set([
  'http://localhost:3000', 'http://localhost:5173',
  'http://127.0.0.1:3000', 'http://127.0.0.1:5173',
  ...(FRONTEND_URL ? [FRONTEND_URL] : []),
]);

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (origin.endsWith('.vercel.app')) return true;
  if (origin.endsWith('.onrender.com')) return true;
  if (NODE_ENV !== 'production') return true;
  return true;
}

function corsOriginValidator(origin, callback) {
  callback(null, isOriginAllowed(origin));
}

const corsOptions = {
  origin: corsOriginValidator,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
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
  pingTimeout: PING_TIMEOUT,
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

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

function validateString(val, maxLen = 256) {
  return typeof val === 'string' && val.length > 0 && val.length <= maxLen;
}

function validateNumber(val) {
  return typeof val === 'number' && isFinite(val) && !isNaN(val);
}

class Room {
  constructor(code, hostId) {
    this.code = code;
    this.state = 'CREATED';
    this.hostId = hostId;
    this.guestId = null;
    this.players = {};
    this.createdAt = new Date();
    this.expiresAt = new Date(Date.now() + ROOM_TIMEOUT_MS);
    this.lastActivity = Date.now();
    this.timeoutHandle = null;
    this.startTimeout();
  }

  startTimeout() {
    if (this.timeoutHandle) clearTimeout(this.timeoutHandle);
    this.timeoutHandle = setTimeout(() => {
      if (this.state === 'WAITING_FOR_PLAYER') {
        this.state = 'EXPIRED';
        io.to(this.code).emit('ROOM_TIMEOUT', { code: this.code, ts: new Date().toISOString() });
        logWarn('TIMEOUT', `Stanza ${this.code} scaduta (nessun join)`);
        rooms.delete(this.code);
      }
    }, ROOM_TIMEOUT_MS);
  }

  cancelTimeout() {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }

  addPlayer(playerId, playerName) {
    const index = Object.keys(this.players).length;
    this.players[playerId] = {
      id: playerId,
      index,
      name: playerName,
      character: null,
      ready: false,
      x: 0, y: 0, vx: 0, vy: 0,
      facing: true, onGround: false, crouching: false,
      atkT: 0, atkAnim: '', damage: 0, stocks: 3, isDead: false,
    };
    if (index === 1) this.guestId = playerId;
    this.lastActivity = Date.now();
  }

  removePlayer(playerId) {
    delete this.players[playerId];
    this.lastActivity = Date.now();
  }

  toJSON() {
    return {
      code: this.code,
      state: this.state,
      hostId: this.hostId,
      guestId: this.guestId,
      createdAt: this.createdAt.toISOString(),
      expiresAt: this.expiresAt.toISOString(),
      players: Object.values(this.players).map(p => ({
        id: p.id, index: p.index, name: p.name, character: p.character, ready: p.ready,
      })),
    };
  }
}

function createRoom(hostId, hostName) {
  let code;
  do { code = generateRoomCode(); } while (rooms.has(code));
  const room = new Room(code, hostId);
  room.addPlayer(hostId, hostName);
  room.state = 'WAITING_FOR_PLAYER';
  rooms.set(code, room);
  logInfo('CREATE', `Stanza ${code} creata da ${hostId}`);
  return room;
}

function getRoom(code) {
  return rooms.get(code);
}

function touchRoom(code) {
  const room = getRoom(code);
  if (room) room.lastActivity = Date.now();
}

function isRateLimited(socketId) {
  const now = Date.now();
  const last = socketRateLimits.get(socketId) || 0;
  if (now - last < RATE_LIMIT_MS) return true;
  socketRateLimits.set(socketId, now);
  return false;
}

// ============================================================
// API REST ENDPOINTS
// ============================================================

app.post('/rooms', (req, res) => {
  const { hostId, hostName } = req.body || {};
  if (!validateString(hostId, 64) || !validateString(hostName, 32)) {
    return res.status(400).json({ success: false, message: 'hostId e hostName obbligatori' });
  }
  const room = createRoom(hostId, hostName);
  res.status(201).json({
    success: true,
    code: room.code,
    room: room.toJSON(),
  });
});

app.post('/rooms/:code/join', (req, res) => {
  const { code } = req.params;
  const { guestId, guestName } = req.body || {};
  if (!validateString(code, 8) || !validateString(guestId, 64) || !validateString(guestName, 32)) {
    return res.status(400).json({ success: false, message: 'Parametri non validi' });
  }
  const room = getRoom(code);
  if (!room) return res.status(404).json({ success: false, message: 'Stanza non trovata' });
  if (room.state !== 'WAITING_FOR_PLAYER') {
    return res.status(409).json({ success: false, message: 'Stanza non disponibile' });
  }
  if (Object.keys(room.players).length >= MAX_PLAYERS_ROOM) {
    return res.status(409).json({ success: false, message: 'Stanza piena' });
  }
  room.addPlayer(guestId, guestName);
  room.state = 'READY';
  room.cancelTimeout();
  touchRoom(code);
  io.to(code).emit('PLAYER_JOINED', {
    type: 'PLAYER_JOINED',
    roomCode: code,
    payload: { playerId: guestId, playerName: guestName },
    ts: new Date().toISOString(),
  });
  logInfo('JOIN', `Giocatore ${guestId} ha acceduto stanza ${code}`);
  res.status(200).json({
    success: true,
    code: room.code,
    room: room.toJSON(),
  });
});

app.delete('/rooms/:code', (req, res) => {
  const { code } = req.params;
  const { hostId } = req.body || {};
  if (!validateString(code, 8) || !validateString(hostId, 64)) {
    return res.status(400).json({ success: false, message: 'Parametri non validi' });
  }
  const room = getRoom(code);
  if (!room) return res.status(404).json({ success: false, message: 'Stanza non trovata' });
  if (room.hostId !== hostId) {
    return res.status(403).json({ success: false, message: 'Non sei l\'host' });
  }
  room.state = 'CANCELLED';
  room.cancelTimeout();
  io.to(code).emit('ROOM_CANCELLED', {
    type: 'ROOM_CANCELLED',
    roomCode: code,
    ts: new Date().toISOString(),
  });
  rooms.delete(code);
  logInfo('CANCEL', `Stanza ${code} cancellata da host ${hostId}`);
  res.status(200).json({ success: true, message: 'Stanza cancellata' });
});

app.get('/rooms/:code', (req, res) => {
  const { code } = req.params;
  const room = getRoom(code);
  if (!room) return res.status(404).json({ success: false, message: 'Stanza non trovata' });
  res.status(200).json({ success: true, room: room.toJSON() });
});

// ============================================================
// WEBSOCKET HANDLERS
// ============================================================

io.on('connection', (socket) => {
  logInfo('CONNECT', `Socket ${socket.id} connesso da ${socket.handshake.address}`);

  socket.on('subscribe_room', (data, callback) => {
    if (typeof callback !== 'function') return;
    const { code } = data || {};
    if (!validateString(code, 8)) {
      return callback({ success: false, message: 'Codice stanza non valido' });
    }
    const room = getRoom(code);
    if (!room) return callback({ success: false, message: 'Stanza non trovata' });
    socket.join(code);
    socketToRoom.set(socket.id, code);
    touchRoom(code);
    callback({ success: true, room: room.toJSON() });
    logInfo('SUB', `Socket ${socket.id} sottoscritto a stanza ${code}`);
  });

  socket.on('select_character', (data) => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = getRoom(code);
    if (!room || !room.players[socket.id]) return;
    const { character } = data || {};
    if (!validateString(character, 32)) return;
    room.players[socket.id].character = character;
    room.players[socket.id].ready = true;
    touchRoom(code);
    socket.to(code).emit('PLAYER_CHAR_SELECTED', {
      type: 'PLAYER_CHAR_SELECTED',
      playerId: socket.id,
      playerIndex: room.players[socket.id].index,
      character,
      ts: new Date().toISOString(),
    });
    const allReady = Object.values(room.players).every(p => p.ready && p.character);
    if (allReady && room.state === 'READY') {
      room.state = 'IN_SELECTION';
      io.to(code).emit('MATCH_READY', {
        type: 'MATCH_READY',
        roomCode: code,
        players: Object.values(room.players).map(p => ({
          id: p.id, index: p.index, name: p.name, character: p.character,
        })),
        ts: new Date().toISOString(),
      });
      logInfo('READY', `Partita pronta in stanza ${code}`);
    }
  });

  socket.on('player_move', (data) => {
    if (isRateLimited(socket.id)) return;
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = getRoom(code);
    if (!room || !room.players[socket.id]) return;
    const { x, y, vx, vy, facing, onGround, crouching, atkT, atkAnim, damage, stocks, isDead } = data || {};
    if (!validateNumber(x) || !validateNumber(y)) return;
    const pp = room.players[socket.id];
    Object.assign(pp, {
      x: Math.max(-0.5, Math.min(1.5, x)),
      y: Math.max(-1.0, Math.min(2.0, y)),
      vx: validateNumber(vx) ? vx : pp.vx,
      vy: validateNumber(vy) ? vy : pp.vy,
      facing: facing !== undefined ? !!facing : pp.facing,
      onGround: onGround !== undefined ? !!onGround : pp.onGround,
      crouching: crouching !== undefined ? !!crouching : pp.crouching,
      atkT: validateNumber(atkT) ? atkT : pp.atkT,
      atkAnim: validateString(atkAnim, 16) ? atkAnim : pp.atkAnim,
      damage: validateNumber(damage) ? Math.max(0, damage) : pp.damage,
      stocks: validateNumber(stocks) ? Math.max(0, Math.min(10, stocks)) : pp.stocks,
      isDead: isDead !== undefined ? !!isDead : pp.isDead,
    });
    touchRoom(code);
    socket.to(code).emit('PLAYER_MOVED', {
      type: 'PLAYER_MOVED',
      playerId: socket.id,
      playerIndex: pp.index,
      data: { x: pp.x, y: pp.y, vx: pp.vx, vy: pp.vy, facing: pp.facing, onGround: pp.onGround, crouching: pp.crouching, atkT: pp.atkT, atkAnim: pp.atkAnim, damage: pp.damage, stocks: pp.stocks, isDead: pp.isDead },
      ts: new Date().toISOString(),
    });
  });

  socket.on('use_ability', (data) => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = getRoom(code);
    if (!room || !room.players[socket.id]) return;
    touchRoom(code);
    socket.to(code).emit('ABILITY_USED', {
      type: 'ABILITY_USED',
      playerId: socket.id,
      playerIndex: room.players[socket.id].index,
      abilityType: data?.abilityType || '',
      ts: new Date().toISOString(),
    });
  });

  socket.on('start_game', () => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = getRoom(code);
    if (!room) return;
    if (Object.keys(room.players).length < MAX_PLAYERS_ROOM) {
      socket.emit('ERROR', { message: 'Attendere il secondo giocatore' }); return;
    }
    room.state = 'IN_MATCH';
    touchRoom(code);
    io.to(code).emit('GAME_STARTED', {
      type: 'GAME_STARTED',
      roomCode: code,
      players: Object.values(room.players).map(p => ({
        id: p.id, index: p.index, name: p.name, character: p.character,
      })),
      ts: new Date().toISOString(),
    });
    logInfo('START', `Partita iniziata in stanza ${code}`);
  });

  socket.on('end_game', (data) => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = getRoom(code);
    if (!room) return;
    room.state = 'FINISHED';
    touchRoom(code);
    io.to(code).emit('GAME_ENDED', {
      type: 'GAME_ENDED',
      roomCode: code,
      winnerId: data?.winnerId,
      reason: data?.reason || 'normal',
      ts: new Date().toISOString(),
    });
    logInfo('END', `Partita terminata in stanza ${code}`);
  });

  socket.on('ping', (callback) => {
    if (typeof callback === 'function') {
      callback({ pong: true, timestamp: Date.now(), serverTime: new Date().toISOString() });
    }
  });

  socket.on('disconnect', (reason) => {
    const code = socketToRoom.get(socket.id);
    if (code) {
      const room = getRoom(code);
      if (room) {
        const playerName = room.players[socket.id]?.name || 'Sconosciuto';
        room.removePlayer(socket.id);
        if (Object.keys(room.players).length === 0) {
          room.cancelTimeout();
          rooms.delete(code);
          logInfo('CLEANUP', `Stanza ${code} eliminata (vuota)`);
        } else {
          io.to(code).emit('PLAYER_LEFT', {
            type: 'PLAYER_LEFT',
            playerId: socket.id,
            playerName,
            ts: new Date().toISOString(),
          });
          logWarn('DISCONNECT', `Giocatore ${socket.id} disconnesso da stanza ${code}`);
        }
      }
    }
    socketToRoom.delete(socket.id);
    socketRateLimits.delete(socket.id);
    logInfo('DISCONNECT', `Socket ${socket.id} disconnesso (${reason})`);
  });

  socket.on('error', (err) => {
    logError('SOCKET_ERROR', `Errore socket ${socket.id}`, err);
  });
});

// ============================================================
// CLEANUP PERIODICO
// ============================================================

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.lastActivity > ROOM_INACTIVITY_MS) {
      room.cancelTimeout();
      rooms.delete(code);
      logWarn('CLEANUP', `Stanza ${code} eliminata (inattiva)`);
    }
  }
}, CLEANUP_INTERVAL);

// ============================================================
// HEALTH CHECK
// ============================================================

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
    },
    rooms: rooms.size,
    activeSockets: io.engine.clientsCount,
  });
});

app.get('/api/rooms', (req, res) => {
  const roomList = Array.from(rooms.values()).map(r => r.toJSON());
  res.json({ rooms: roomList, total: roomList.length });
});

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

function gracefulShutdown() {
  logInfo('SHUTDOWN', 'Graceful shutdown in corso...');
  io.emit('SERVER_SHUTDOWN', { message: 'Server in manutenzione. Riconnessione automatica in 30s.' });
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
  logInfo('SERVER', `Battaglia Navale Smash Backend v5.0 in ascolto su porta ${PORT}`);
  logInfo('SERVER', `Ambiente: ${NODE_ENV}`);
});
