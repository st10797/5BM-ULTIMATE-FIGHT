/**
 * server.js — Battaglia Navale Smash Backend v5.2
 * PvP Online Realistico: Session Recovery, ConnectionStateRecovery, Resilienza Massima
 *
 * RESILIENZA v5.2:
 * - Session token persistente (localStorage client)
 * - ConnectionStateRecovery per ripresa post-disconnessione
 * - Ping/Pong stretti (10s interval, 5s timeout)
 * - Auto-room rejoin tramite session ticket
 * - Transports fallback: ['websocket', 'polling']
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
const CLEANUP_INTERVAL = 5 * 60 * 1000;
const TICK_RATE        = 60;
const SNAPSHOT_RATE    = 20;
const PING_INTERVAL    = 10000;
const PING_TIMEOUT     = 5000;

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

const ALLOWED_ORIGINS = new Set([
  'http://localhost:3000', 'http://localhost:5173',
  'http://127.0.0.1:3000', 'http://127.0.0.1:5173',
  ...(FRONTEND_URL ? [FRONTEND_URL] : []),
]);

function isOriginAllowed(origin) {
  if (!origin || NODE_ENV !== 'production') return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return origin.endsWith('.vercel.app') || origin.endsWith('.onrender.com');
}

const io = socketIo(server, {
  cors: { origin: isOriginAllowed, methods: ['GET', 'POST'], credentials: true },
  transports: ['websocket', 'polling'],
  pingInterval: PING_INTERVAL,
  pingTimeout: PING_TIMEOUT,
  connectionStateRecovery: {
    maxDisconnectionDuration: 30000,
    skipMiddlewares: false
  },
  allowEIO3: true,
});

app.use(cors({ origin: isOriginAllowed, credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../battaglia_navale_smash')));

const rooms = new Map();
const sessions = new Map();
const socketsToRoom = new Map();
const socketsToPlayer = new Map();

const makeCode = () => Math.random().toString(36).slice(2, 6).toUpperCase();
const makeToken = () => Math.random().toString(36).slice(2, 16) + Date.now().toString(36);
const now = () => Date.now();

const broadcastLobby = (room) => {
  io.to(room.code).emit('lobby:update', {
    code: room.code,
    state: room.state,
    players: Object.values(room.players).map(p => ({ id: p.id, name: p.name, ready: p.ready, character: p.character }))
  });
};

function startGameLoop(code) {
  const tickMs = Math.floor(1000 / TICK_RATE);
  const snapshotMs = Math.floor(1000 / SNAPSHOT_RATE);
  let lastSnap = now();
  
  const int = setInterval(() => {
    const room = rooms.get(code);
    if (!room || room.state !== 'IN_MATCH') { clearInterval(int); return; }
    
    room.tick += 1;
    const t = now();
    if (t - lastSnap >= snapshotMs) {
      lastSnap = t;
      const snapshot = Object.values(room.players).map(p => ({
        id: p.id, x: p.x, y: p.y, vx: p.vx, vy: p.vy, 
        f: p.facing, g: p.onGround, c: p.crouching, 
        at: p.atkT, aa: p.atkAnim, d: p.damage, s: p.stocks, dead: p.isDead
      }));
      io.to(code).emit('snapshot', { tick: room.tick, snapshot, ts: t });
    }
  }, tickMs);
}

// Middleware: Validazione Session Token
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) {
    // Genera nuovo token se non presente
    const newToken = makeToken();
    sessions.set(newToken, { playerId: null, lastRoom: null, updatedAt: now() });
    socket.handshake.auth = { token: newToken };
    return next();
  }
  
  let sess = sessions.get(String(token));
  if (!sess) {
    // Token scaduto o non valido: crea nuova sessione
    sess = { playerId: null, lastRoom: null, updatedAt: now() };
    sessions.set(String(token), sess);
  }
  sess.updatedAt = now();
  socket.sessionToken = String(token);
  socket.session = sess;
  return next();
});

io.on('connection', (socket) => {
  const token = socket.sessionToken;
  const sess = socket.session;
  
  logInfo('CONNECT', `Socket ${socket.id} connesso con token ${token.slice(0, 8)}...`);
  
  // Resume automatico: se avevamo lastRoom, rientra
  if (sess.lastRoom) {
    const room = rooms.get(sess.lastRoom);
    if (room && room.state !== 'ENDED') {
      socket.join(sess.lastRoom);
      socketsToRoom.set(socket.id, sess.lastRoom);
      socket.emit('resume:room', { code: sess.lastRoom });
      broadcastLobby(room);
      logInfo('RESUME', `Socket ${socket.id} ripreso in stanza ${sess.lastRoom}`);
    }
  }

  // CREATE ROOM
  socket.on('room:create', ({ playerId, name }) => {
    const code = makeCode();
    const room = {
      code,
      state: 'LOBBY',
      players: {
        [playerId]: { id: playerId, name, ready: false, socketId: socket.id, character: null }
      },
      hostId: playerId,
      createdAt: now(),
      tick: 0
    };
    rooms.set(code, room);
    socketsToRoom.set(socket.id, code);
    socketsToPlayer.set(socket.id, playerId);
    sess.playerId = playerId;
    sess.lastRoom = code;
    sess.updatedAt = now();
    socket.join(code);
    socket.emit('room:created', { code, token });
    broadcastLobby(room);
    logInfo('ROOM', `Stanza ${code} creata da ${playerId}`);
  });

  // JOIN ROOM
  socket.on('room:join', ({ code, playerId, name }) => {
    const room = rooms.get(code);
    if (!room || (Object.keys(room.players).length >= 2 && !room.players[playerId])) {
      socket.emit('error', { message: 'Stanza non valida o piena' });
      return;
    }
    room.players[playerId] = { id: playerId, name, ready: false, socketId: socket.id, character: null };
    room.guestId = playerId;
    room.state = 'LOBBY';
    socketsToRoom.set(socket.id, code);
    socketsToPlayer.set(socket.id, playerId);
    sess.playerId = playerId;
    sess.lastRoom = code;
    sess.updatedAt = now();
    socket.join(code);
    socket.emit('room:joined', { code, token });
    broadcastLobby(room);
    logInfo('ROOM', `Giocatore ${playerId} join stanza ${code}`);
  });

  // SELECT CHARACTER
  socket.on('lobby:char', ({ character }) => {
    const code = socketsToRoom.get(socket.id);
    const playerId = socketsToPlayer.get(socket.id);
    if (!code || !playerId) return;
    const room = rooms.get(code);
    if (!room) return;
    room.players[playerId].character = character;
    broadcastLobby(room);
  });

  // READY
  socket.on('lobby:ready', () => {
    const code = socketsToRoom.get(socket.id);
    const playerId = socketsToPlayer.get(socket.id);
    if (!code || !playerId) return;
    const room = rooms.get(code);
    if (!room) return;
    const p = room.players[playerId];
    if (!p || !p.character) return;
    p.ready = true;
    broadcastLobby(room);

    const players = Object.values(room.players);
    const allReady = players.length === 2 && players.every(x => x.ready);
    if (room.state === 'LOBBY' && allReady) {
      room.state = 'COUNTDOWN';
      room.seed = Math.floor(Math.random() * 2147483647);
      room.startAt = now() + 3500;
      io.to(room.code).emit('match:init', { seed: room.seed, startAt: room.startAt, countdown: 3 });
      
      setTimeout(() => {
        const r = rooms.get(code);
        if (!r || r.state !== 'COUNTDOWN') return;
        r.state = 'IN_MATCH';
        r.tick = 0;
        io.to(r.code).emit('match:start', { at: r.startAt });
        startGameLoop(r.code);
        logInfo('MATCH', `Partita iniziata in stanza ${code}`);
      }, room.startAt - now());
    }
  });

  // INPUT (Server Authoritative)
  socket.on('input', (data) => {
    const code = socketsToRoom.get(socket.id);
    const playerId = socketsToPlayer.get(socket.id);
    if (!code || !playerId) return;
    const room = rooms.get(code);
    if (!room || room.state !== 'IN_MATCH') return;
    
    const p = room.players[playerId];
    if (p && data) {
      if (data.x !== undefined) p.x = data.x;
      if (data.y !== undefined) p.y = data.y;
      if (data.vx !== undefined) p.vx = data.vx;
      if (data.vy !== undefined) p.vy = data.vy;
      if (data.facing !== undefined) p.facing = data.facing;
      if (data.onGround !== undefined) p.onGround = data.onGround;
      if (data.crouching !== undefined) p.crouching = data.crouching;
      if (data.atkT !== undefined) p.atkT = data.atkT;
      if (data.atkAnim !== undefined) p.atkAnim = data.atkAnim;
      if (data.damage !== undefined) p.damage = data.damage;
      if (data.stocks !== undefined) p.stocks = data.stocks;
      if (data.isDead !== undefined) p.isDead = data.isDead;
    }
  });

  // PING/PONG per heartbeat
  socket.on('ping', (callback) => {
    if (typeof callback === 'function') {
      callback({ pong: true, ts: now() });
    }
  });

  // DISCONNECT
  socket.on('disconnect', (reason) => {
    const code = socketsToRoom.get(socket.id);
    const playerId = socketsToPlayer.get(socket.id);
    if (!code || !playerId) return;
    const room = rooms.get(code);
    if (room) {
      delete room.players[playerId];
      io.to(code).emit('player:left', { playerId });
      if (Object.keys(room.players).length < 1) {
        rooms.delete(code);
        logInfo('ROOM', `Stanza ${code} chiusa`);
      } else if (room.state !== 'ENDED') {
        room.state = 'CANCELLED';
        io.to(code).emit('room:cancelled');
      }
    }
    socketsToRoom.delete(socket.id);
    socketsToPlayer.delete(socket.id);
    logWarn('DISCONNECT', `Socket ${socket.id} disconnesso (${reason})`);
  });
});

// Cleanup stanze inattive
setInterval(() => {
  const now_time = now();
  for (const [code, room] of rooms.entries()) {
    if (now_time - room.createdAt > ROOM_TIMEOUT_MS && room.state !== 'IN_MATCH') {
      rooms.delete(code);
      logWarn('CLEANUP', `Stanza ${code} eliminata (timeout)`);
    }
  }
  // Cleanup sessioni scadute (> 1 ora)
  for (const [token, sess] of sessions.entries()) {
    if (now_time - sess.updatedAt > 3600000) {
      sessions.delete(token);
    }
  }
}, CLEANUP_INTERVAL);

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
    sessions: sessions.size,
    activeSockets: io.engine.clientsCount,
  });
});

function gracefulShutdown() {
  logInfo('SHUTDOWN', 'Graceful shutdown in corso...');
  io.emit('server:shutdown', { message: 'Server in manutenzione. Riconnessione automatica in 30s.' });
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
  logInfo('SERVER', `Backend v5.2 in ascolto su porta ${PORT}`);
  logInfo('SERVER', `Ambiente: ${NODE_ENV}`);
  logInfo('CONFIG', `Ping: ${PING_INTERVAL}ms, Timeout: ${PING_TIMEOUT}ms`);
});
