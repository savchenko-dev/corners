import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createGame, applyMove, WHITE, BLACK } from './game.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const ROOM_TTL_MS = 1000 * 60 * 60 * 6; // drop empty rooms after 6h

const rooms = new Map(); // code -> { game, players: { [WHITE]: ws|null, [BLACK]: ws|null }, spectators: Set, lastActive }

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
  }
  // Any non-asset path serves the SPA (room codes live in the URL hash).
  let file = url.pathname === '/' ? '/index.html' : url.pathname;
  const resolved = path.normalize(path.join(PUBLIC_DIR, file));
  if (!resolved.startsWith(PUBLIC_DIR) || !fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
    file = '/index.html';
  }
  const finalPath = path.join(PUBLIC_DIR, file);
  const ext = path.extname(finalPath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(finalPath).pipe(res);
});

const wss = new WebSocketServer({ server });

function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  } while (rooms.has(code));
  return code;
}

function getRoom(code) {
  let room = rooms.get(code);
  if (!room) {
    room = { code, game: createGame(), players: { [WHITE]: null, [BLACK]: null }, spectators: new Set(), lastActive: Date.now() };
    rooms.set(code, room);
  }
  return room;
}

function send(ws, msg) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function stateMsg(room) {
  return {
    type: 'state',
    code: room.code,
    board: room.game.board,
    turn: room.game.turn,
    winner: room.game.winner,
    moves: room.game.moves,
    connected: { [WHITE]: !!room.players[WHITE], [BLACK]: !!room.players[BLACK] },
  };
}

function broadcast(room, msg) {
  send(room.players[WHITE], msg);
  send(room.players[BLACK], msg);
  for (const s of room.spectators) send(s, msg);
}

function joinRoom(ws, code) {
  const room = getRoom(code);
  room.lastActive = Date.now();
  let color = 0;
  if (!room.players[WHITE]) color = WHITE;
  else if (!room.players[BLACK]) color = BLACK;
  if (color) room.players[color] = ws;
  else room.spectators.add(ws);
  ws.room = room;
  ws.color = color;
  send(ws, { type: 'joined', code, color });
  broadcast(room, stateMsg(room));
}

function leaveRoom(ws) {
  const room = ws.room;
  if (!room) return;
  if (ws.color && room.players[ws.color] === ws) room.players[ws.color] = null;
  room.spectators.delete(ws);
  ws.room = null;
  room.lastActive = Date.now();
  broadcast(room, stateMsg(room));
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return send(ws, { type: 'error', error: 'Bad JSON' });
    }
    const room = ws.room;
    switch (msg.type) {
      case 'create': {
        leaveRoom(ws);
        joinRoom(ws, makeCode());
        break;
      }
      case 'join': {
        const code = String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
        if (!code) return send(ws, { type: 'error', error: 'Room code required' });
        leaveRoom(ws);
        joinRoom(ws, code);
        break;
      }
      case 'move': {
        if (!room) return send(ws, { type: 'error', error: 'Not in a room' });
        if (!ws.color) return send(ws, { type: 'error', error: 'Spectators cannot move' });
        const res = applyMove(room.game, ws.color, msg.from, msg.to);
        if (!res.ok) return send(ws, { type: 'error', error: res.error });
        room.lastActive = Date.now();
        broadcast(room, { type: 'moved', from: msg.from, to: msg.to, path: res.path, by: ws.color });
        broadcast(room, stateMsg(room));
        break;
      }
      case 'restart': {
        if (!room || !ws.color) return;
        room.game = createGame();
        room.lastActive = Date.now();
        broadcast(room, { type: 'restarted', by: ws.color });
        broadcast(room, stateMsg(room));
        break;
      }
      default:
        send(ws, { type: 'error', error: 'Unknown message' });
    }
  });

  ws.on('close', () => leaveRoom(ws));
  ws.on('error', () => leaveRoom(ws));
});

// Keepalive so proxies (Traefik in Coolify) don't drop idle sockets.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

// Garbage-collect abandoned rooms.
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const empty = !room.players[WHITE] && !room.players[BLACK] && room.spectators.size === 0;
    if (empty && now - room.lastActive > ROOM_TTL_MS) rooms.delete(code);
  }
}, 60000);

server.listen(PORT, () => {
  console.log(`Corners listening on port ${PORT}`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  });
}
