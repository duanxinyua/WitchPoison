const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { createClient } = require('redis');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// Redis: one client for commands, one for pubsub
const redis = createClient({ url: REDIS_URL });
const redisSub = redis.duplicate();

// Connection bookkeeping
const connections = new Map(); // ws -> { roomId, playerId }
const roomSockets = new Map(); // roomId -> Set<ws>

const server = http.createServer(async (req, res) => {
  if (req.url && req.url.startsWith('/suggest-room')) {
    return handleSuggestRoom(req, res);
  }
  return serveStatic(req, res);
});
const wss = new WebSocketServer({ server });

async function start() {
  await redis.connect();
  await redisSub.connect();
  await redisSub.pSubscribe('room:*:events', handlePubSub);
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
}

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});

// --- WebSocket handlers ---
wss.on('connection', (ws) => {
  ws.on('message', async (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (e) {
      return send(ws, { type: 'error', message: 'Invalid message' });
    }
    await handleMessage(ws, msg);
  });

  ws.on('close', () => handleDisconnect(ws));
  ws.on('error', () => handleDisconnect(ws));
});

async function handleMessage(ws, msg) {
  switch (msg.type) {
    case 'join_room':
      return handleJoin(ws, msg);
    case 'place_poison':
      return handlePlacePoison(ws, msg);
    case 'start_game':
      return handleStartGame(ws, msg);
    case 'reveal_cell':
      return handleReveal(ws, msg);
    case 'restart_game':
      return handleRestart(ws, msg);
    case 'leave_room':
      return handleLeave(ws, msg);
    default:
      return send(ws, { type: 'error', message: 'Unknown message type' });
  }
}

async function handleJoin(ws, msg) {
  const roomId = (msg.roomId || '').trim();
  const roomKey = (msg.roomKey || '').trim();
  const name = ((msg.name || 'Player').trim() || 'Player').slice(0, 20);
  const emoji = ((msg.emoji || '🪄').trim() || '🪄').slice(0, 4);
  const boardSizeRaw = msg.boardSize;
  const hasBoardSize = boardSizeRaw !== undefined && boardSizeRaw !== null && boardSizeRaw !== '';
  let boardSize = hasBoardSize ? Number(boardSizeRaw) : NaN;
  if (!roomId) return send(ws, { type: 'error', message: '房间号不能为空' });

  let room = await loadRoom(roomId);
  if (!room) {
    if (!hasBoardSize) {
      return send(ws, { type: 'error', message: '房间不存在或已被清理，请先创建房间' });
    }
    if (Number.isNaN(boardSize) || boardSize < 5 || boardSize > 10) {
      return send(ws, { type: 'error', message: '创建房间需提供 5-10 的棋盘大小' });
    }
    room = createRoom(roomId, boardSize, roomKey);
  } else if (room.roomKey && room.roomKey !== roomKey) {
    return send(ws, { type: 'error', message: '房间口令不正确' });
  } else {
    boardSize = room.boardSize; // ignore client size when joining existing
  }
  if (room.started) return send(ws, { type: 'error', message: '本局已开始，无法加入' });
  if (room.players.length >= 5) return send(ws, { type: 'error', message: '房间人数已满 (5)' });

  const playerId = crypto.randomUUID();
  room.players.push({ id: playerId, name, emoji, poison: null, alive: true, connected: true });
  if (!room.hostId) room.hostId = playerId;
  room.version += 1;
  const saved = await saveRoom(room, room.version - 1);
  if (!saved) return send(ws, { type: 'error', message: '房间状态更新冲突，请重试加入' });
  addConnection(ws, roomId, playerId);
  send(ws, { type: 'joined', roomId, playerId, host: room.hostId === playerId });
  await publishRoom(room);
  await broadcastLocal(room);
}

async function handlePlacePoison(ws, msg) {
  const ctx = connections.get(ws);
  if (!ctx) return send(ws, { type: 'error', message: '请先加入房间' });
  const room = await loadRoom(ctx.roomId);
  if (!room) return send(ws, { type: 'error', message: '房间不存在' });
  if (room.started) return send(ws, { type: 'error', message: '游戏已开始，不能更改毒药' });
  const coords = parseCell(msg.cell);
  if (!coords) return send(ws, { type: 'error', message: '非法坐标' });
  if (!inBounds(coords, room.boardSize)) return send(ws, { type: 'error', message: '超出棋盘范围' });
  const player = room.players.find((p) => p.id === ctx.playerId);
  if (!player) return send(ws, { type: 'error', message: '未加入房间' });
  if (room.players.length === 2) {
    const conflict = room.players.find((p) => p.id !== player.id && p.poison && p.poison.r === coords.r && p.poison.c === coords.c);
    if (conflict) {
      // 清空双方毒药，避免信息泄露
      conflict.poison = null;
      player.poison = null;
      room.version += 1;
      const savedConflict = await saveRoom(room, room.version - 1);
      if (savedConflict) {
        await publishRoom(room);
        await broadcastLocal(room);
      }
      return send(ws, { type: 'error', message: '两人对局毒药不能重叠，双方需重新放置' });
    }
  }
  player.poison = coords;
  room.version += 1;
  const saved = await saveRoom(room, room.version - 1);
  if (!saved) return send(ws, { type: 'error', message: '房间状态更新冲突，请重试放置' });
  await publishRoom(room);
  await broadcastLocal(room);
}

async function handleStartGame(ws, msg) {
  const ctx = connections.get(ws);
  if (!ctx) return send(ws, { type: 'error', message: '请先加入房间' });
  const room = await loadRoom(ctx.roomId);
  if (!room) return send(ws, { type: 'error', message: '房间不存在' });
  if (room.started) return send(ws, { type: 'error', message: '游戏已开始' });
  if (room.hostId !== ctx.playerId) return send(ws, { type: 'error', message: '仅主持人可开始' });
  if (room.players.length < 2) return send(ws, { type: 'error', message: '至少需要 2 名玩家' });
  const allReady = room.players.every((p) => !!p.poison);
  if (!allReady) return send(ws, { type: 'error', message: '有人未放置毒药' });

  room.started = true;
  room.currentTurnIndex = 0;
  room.finished = false;
  room.version += 1;
  const saved = await saveRoom(room, room.version - 1);
  if (!saved) return send(ws, { type: 'error', message: '房间状态更新冲突，请重试开始' });
  await publishRoom(room);
  await broadcastLocal(room);
}

async function handleReveal(ws, msg) {
  const ctx = connections.get(ws);
  if (!ctx) return send(ws, { type: 'error', message: '请先加入房间' });
  const room = await loadRoom(ctx.roomId);
  if (!room) return send(ws, { type: 'error', message: '房间不存在' });
  if (!room.started) return send(ws, { type: 'error', message: '游戏未开始' });
  const player = room.players.find((p) => p.id === ctx.playerId);
  if (!player || !player.alive) return send(ws, { type: 'error', message: '你已出局或未加入' });
  const currentPlayer = room.players[room.currentTurnIndex];
  if (!currentPlayer || currentPlayer.id !== player.id) return send(ws, { type: 'error', message: '尚未轮到你' });

  const coords = parseCell(msg.cell);
  if (!coords) return send(ws, { type: 'error', message: '非法坐标' });
  if (!inBounds(coords, room.boardSize)) return send(ws, { type: 'error', message: '超出棋盘范围' });
  const key = `${coords.r},${coords.c}`;
  if (room.reveals[key] || room.poisonHits.includes(key)) return send(ws, { type: 'error', message: '此格已翻开' });

  const poisonOwner = room.players.find((p) => p.poison && p.poison.r === coords.r && p.poison.c === coords.c);
  if (poisonOwner) {
    room.poisonHits.push(key);
    player.alive = false;
  } else {
    room.reveals[key] = { by: player.id };
  }

  const winner = computeWinner(room);
  const draw = computeDraw(room);
  if (!winner && !draw) {
    let nextIndex = room.currentTurnIndex;
    for (let i = 0; i < room.players.length; i++) {
      nextIndex = (nextIndex + 1) % room.players.length;
      const np = room.players[nextIndex];
      if (np && np.alive && np.connected) break;
    }
    room.currentTurnIndex = nextIndex;
  } else {
    room.finished = true;
  }

  room.version += 1;
  const saved = await saveRoom(room, room.version - 1);
  if (!saved) return send(ws, { type: 'error', message: '房间状态更新冲突，请重试翻格' });
  await publishRoom(room);
  await broadcastLocal(room);
}

async function handleDisconnect(ws) {
  const ctx = connections.get(ws);
  if (!ctx) return;
  await removePlayer(ws, ctx.roomId, ctx.playerId, { markDead: true });
}

async function handleLeave(ws, msg) {
  const ctx = connections.get(ws);
  if (!ctx) return send(ws, { type: 'error', message: '未在房间中' });
  await removePlayer(ws, ctx.roomId, ctx.playerId, { markDead: true });
  send(ws, { type: 'left' });
}

async function removePlayer(ws, roomId, playerId, { markDead }) {
  connections.delete(ws);
  const set = roomSockets.get(roomId);
  if (set) set.delete(ws);

  const room = await loadRoom(roomId);
  if (!room) return;
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return;

  player.connected = false;
  if (markDead) player.alive = false;
  room.version += 1;
  await saveRoom(room, room.version - 1);
  await publishRoom(room);
  await broadcastLocal(room);
  await cleanupRoom(room);
}

// --- Redis helpers ---
async function loadRoom(roomId) {
  const key = `room:${roomId}`;
  const raw = await redis.get(key);
  if (!raw) return null;
  return JSON.parse(raw);
}

async function saveRoom(room, expectedVersion) {
  const key = `room:${room.id}`;
  const serialized = JSON.stringify(room);
  // optimistic locking with WATCH/MULTI
  for (let i = 0; i < 3; i++) {
    await redis.watch(key);
    const currentRaw = await redis.get(key);
    if (currentRaw) {
      const current = JSON.parse(currentRaw);
      if (typeof expectedVersion === 'number' && current.version !== expectedVersion) {
        await redis.unwatch();
        return false;
      }
    }
    const multi = redis.multi();
    multi.set(key, serialized);
    multi.expire(key, 86400); // 保留 1 天，防止误删
    const execResult = await multi.exec();
    if (execResult !== null) return true; // success
  }
  return false;
}

async function publishRoom(room) {
  const channel = `room:${room.id}:events`;
  await redis.publish(channel, JSON.stringify({ type: 'state', room }));
}

async function handlePubSub(message, channel) {
  try {
    const payload = JSON.parse(message);
    if (payload.type !== 'state' || !payload.room) return;
    await broadcastLocal(payload.room);
  } catch (e) {
    console.error('PubSub parse error', e);
  }
}

async function cleanupRoom(room) {
  const hasConnected = room.players.some((p) => p.connected);
  if (!hasConnected) {
    // 不立刻删除，保留一段时间，便于重连/误断线后加入
    await redis.expire(`room:${room.id}`, 3600); // 1 小时
  }
}

// --- State helpers ---
function createRoom(roomId, boardSize, roomKey = '') {
  return {
    id: roomId,
    boardSize,
    roomKey,
    players: [],
    started: false,
    reveals: {}, // key -> {by}
    poisonHits: [],
    currentTurnIndex: 0,
    hostId: null,
    version: 0,
    finished: false,
  };
}

function computeWinner(room) {
  const alivePlayers = room.players.filter((p) => p.alive && p.connected);
  if (room.started && alivePlayers.length === 1) return alivePlayers[0].id;
  return null;
}

function computeDraw(room) {
  if (!room.started) return false;
  const alivePlayers = room.players.filter((p) => p.alive && p.connected);
  if (alivePlayers.length === 0) return false;
  const poisonCells = new Set();
  for (const p of room.players) {
    if (p.poison) poisonCells.add(`${p.poison.r},${p.poison.c}`);
  }
  let unopened = 0;
  let hasSafe = false;
  for (let r = 0; r < room.boardSize; r++) {
    for (let c = 0; c < room.boardSize; c++) {
      const key = `${r},${c}`;
      if (room.reveals[key] || room.poisonHits.includes(key)) continue;
      unopened += 1;
      if (!poisonCells.has(key)) {
        hasSafe = true;
      }
    }
  }
  // 平局：未翻格数量等于存活人数，且未翻格全为毒药（无安全格）
  return !hasSafe && unopened === alivePlayers.length;
}

function buildClientState(room, viewerId) {
  const viewer = room.players.find((p) => p.id === viewerId);
  const revealsArray = Object.entries(room.reveals).map(([cell, info]) => ({ cell, by: info.by }));
  return {
    type: 'state',
    roomId: room.id,
    boardSize: room.boardSize,
    started: room.started,
    currentPlayerId: room.players[room.currentTurnIndex]?.id || null,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji,
      alive: p.alive,
      ready: !!p.poison,
      connected: p.connected,
      host: room.hostId === p.id,
    })),
    reveals: revealsArray,
    poisonHits: room.poisonHits,
    winnerId: computeWinner(room),
    draw: computeDraw(room),
    finished: room.finished,
    version: room.version,
    yourId: viewerId,
    yourPoison: viewer && viewer.poison ? `${viewer.poison.r},${viewer.poison.c}` : null,
  };
}

async function broadcastLocal(room) {
  const set = roomSockets.get(room.id);
  if (!set || set.size === 0) return;
  for (const ws of set) {
    if (ws.readyState !== ws.OPEN) continue;
    const ctx = connections.get(ws);
    if (!ctx) continue;
    send(ws, buildClientState(room, ctx.playerId));
  }
}

function addConnection(ws, roomId, playerId) {
  connections.set(ws, { roomId, playerId });
  if (!roomSockets.has(roomId)) roomSockets.set(roomId, new Set());
  roomSockets.get(roomId).add(ws);
}

function send(ws, obj) {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(obj));
}

// --- Room ID suggestion ---
async function handleSuggestRoom(req, res) {
  try {
    const roomId = await generateUniqueRoomId();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ roomId }));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: '无法生成房间号，请稍后再试' }));
  }
}

async function generateUniqueRoomId() {
  for (let i = 0; i < 10; i++) {
    const id = String(Math.floor(100000 + Math.random() * 900000)); // 6 位数字
    const exists = await redis.exists(`room:${id}`);
    if (!exists) return id;
  }
  // Fallback with UUID tail
  return crypto.randomUUID().replace(/\\D/g, '').slice(0, 6) || '999999';
}

function parseCell(cell) {
  if (typeof cell !== 'string') return null;
  const parts = cell.split(',').map((v) => parseInt(v, 10));
  if (parts.length !== 2 || parts.some(Number.isNaN)) return null;
  return { r: parts[0], c: parts[1] };
}

function inBounds(coords, size) {
  return coords.r >= 0 && coords.c >= 0 && coords.r < size && coords.c < size;
}

// --- Static files ---
function serveStatic(req, res) {
  let filePath = req.url.split('?')[0];
  if (filePath === '/' || filePath === '') filePath = '/index.html';
  const safePath = path.normalize(filePath).replace(/^\/+/, '');
  const absPath = path.join(PUBLIC_DIR, safePath);
  if (!absPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(absPath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(absPath).toLowerCase();
    const type = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
    }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
}
async function handleRestart(ws, msg) {
  const ctx = connections.get(ws);
  if (!ctx) return send(ws, { type: 'error', message: '请先加入房间' });
  const room = await loadRoom(ctx.roomId);
  if (!room) return send(ws, { type: 'error', message: '房间不存在' });
  if (!room.started || !room.finished) return send(ws, { type: 'error', message: '本局未结束，不能重开' });
  if (room.hostId !== ctx.playerId) return send(ws, { type: 'error', message: '仅主持人可重开' });

  // reset state but keep players/host/board
  room.started = false;
  room.finished = false;
  room.reveals = {};
  room.poisonHits = [];
  room.currentTurnIndex = 0;
  room.players = room.players.map((p) => ({
    ...p,
    poison: null,
    alive: true,
    connected: true,
  }));
  room.version += 1;
  const saved = await saveRoom(room, room.version - 1);
  if (!saved) return send(ws, { type: 'error', message: '房间状态更新冲突，请重试重开' });
  await publishRoom(room);
  await broadcastLocal(room);
}
