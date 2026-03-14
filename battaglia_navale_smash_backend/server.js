/**
 * server.js — Battaglia Navale Smash Backend v5.1
 * PvP Online Realistico: Server-Authoritative, Tick Loop 60Hz, Lobby/Ready
 *
 * FLUSSO v5.1:
 * 1. room:create -> CREATED -> LOBBY (host)
 * 2. room:join -> LOBBY (guest) -> lobby:update (entrambi)
 * 3. lobby:ready -> allReady? -> COUNTDOWN -> match:init {seed, startAt}
 * 4. startAt -> IN_MATCH -> Tick Loop 60Hz -> snapshot 20Hz
 *
 * STATI: CREATED → WAITING_FOR_PLAYER → LOBBY → COUNTDOWN → IN_MATCH → ENDED|CANCELLED|TIMEOUT
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
});

app.use(cors({ origin: isOriginAllowed, credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../battaglia_navale_smash')));

const rooms = new Map();
const socketsToRoom = new Map();
const socketsToPlayer = new Map();

const makeCode = () => Math.random().toString(36).slice(2, 6).toUpperCase();
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
      // Snapshot minimale dello stato giocatori
      const snapshot = Object.values(room.players).map(p => ({
        id: p.id, x: p.x, y: p.y, vx: p.vx, vy: p.vy, 
        f: p.facing, g: p.onGround, c: p.crouching, 
        at: p.atkT, aa: p.atkAnim, d: p.damage, s: p.stocks, dead: p.isDead
      }));
      io.to(code).emit('snapshot', { tick: room.tick, snapshot, ts: t });
    }
  }, tickMs);
}

io.on('connection', (socket) => {
  logInfo('CONNECT', `Socket ${socket.id} connesso`);

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
    socket.join(code);
    socket.emit('room:created', { code });
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
    socket.join(code);
    socket.emit('room:joined', { code });
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
    
    // Aggiorna stato locale del player nel server (mock per ora, il loop userà questi dati)
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

  // DISCONNECT
  socket.on('disconnect', () => {
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
  });
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', rooms: rooms.size, clients: io.engine.clientsCount }));

server.listen(PORT, '0.0.0.0', () => logInfo('SERVER', `Backend v5.1 in ascolto su porta ${PORT}`));
