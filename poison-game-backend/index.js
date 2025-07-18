const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const DEBUG = true;

function debugLog(...args) {
  if (DEBUG) console.log(...args);
}

function debugWarn(...args) {
  if (DEBUG) console.warn(...args);
}

function debugError(...args) {
  if (DEBUG) console.error(...args);
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

class Game {
  constructor(roomId, boardSize, playerCount) {
    this.roomId = roomId;
    this.boardSize = boardSize;
    this.board = Array(boardSize).fill().map(() => Array(boardSize).fill(null));
    this.players = [];
    this.currentPlayerIndex = 0;
    this.playerCount = playerCount;
    // 玩家头像emoji数组 - 确保每个头像都不重复，支持更多玩家
    this.emojis = ['😺', '🐶', '🐰', '🦅', '🐘', '🐸', '🦊', '🐯', '🐨', '🐼'];
    this.gameStarted = false;
    this.status = 'waiting';
  }

  addPlayer(id, name) {
    debugLog('尝试加入房间:', { 
      roomId: this.roomId, 
      playerId: id, 
      playerName: name,
      currentStatus: this.status,
      gameStarted: this.gameStarted,
      currentPlayers: this.players.length,
      maxPlayers: this.playerCount
    });
    // 修复：如果游戏已开始但处于等待重启状态，允许原玩家重新加入
    if (this.players.length >= this.playerCount && this.status !== 'waitingForRestart') {
      return { success: false, message: '房间已满' };
    }
    if (this.gameStarted && this.status !== 'waitingForRestart' && this.status !== 'ended') {
      debugLog('拒绝加入 - 游戏进行中:', { 
        gameStarted: this.gameStarted, 
        status: this.status, 
        roomId: this.roomId, 
        playerId: id,
        playerName: name
      });
      return { success: false, message: '游戏进行中，无法加入' };
    }
    if (!id || !name || typeof name !== 'string' || name.length > 20) {
      return { success: false, message: '无效的玩家ID或昵称' };
    }
    
    // 检查是否已存在相同 clientId
    if (this.players.some(p => p.id === id)) {
      return { success: false, message: '玩家已在房间中' };
    }
    
    // 如果房间在等待重启状态或游戏结束状态且人数不满，重置为等待状态
    if ((this.status === 'waitingForRestart' || this.status === 'ended') && this.players.length < this.playerCount) {
      this.status = 'waiting';
      this.gameStarted = false; // 重要：重置游戏开始标志
      debugLog('房间状态重置为等待:', { roomId: this.roomId, playersCount: this.players.length, gameStarted: this.gameStarted, oldStatus: this.status });
    }
    
    const emoji = this.emojis[this.players.length % this.emojis.length];
    this.players.push({ id, name, emoji, poisonPos: null, isOut: false, clientId: id });
    
    // 更新房间状态逻辑
    if (this.players.length === this.playerCount) {
      if (this.status === 'waiting' || this.status === 'waitingForRestart') {
        this.status = 'settingPoison';
        this.currentPlayerIndex = 0;
      }
    }
    
    debugLog('玩家加入:', { id, name, roomId: this.roomId, players: this.players.length, status: this.status });
    return { success: true };
  }

  setPoison(playerId, x, y) {
    if (this.status !== 'settingPoison') {
      return { success: false, message: '当前不可设置毒药' };
    }
    const player = this.players.find(p => p.id === playerId);
    if (!player) {
      return { success: false, message: '玩家不存在' };
    }
    if (player.poisonPos) {
      return { success: false, message: '玩家已设置毒药' };
    }
    if (x < 0 || x >= this.boardSize || y < 0 || y >= this.boardSize) {
      return { success: false, message: '无效的毒药位置' };
    }
    player.poisonPos = { x, y };
    debugLog('毒药设置成功:', { playerId, x, y, roomId: this.roomId, players: this.players });

    let nextIndex = (this.currentPlayerIndex + 1) % this.players.length;
    while (this.players[nextIndex].poisonPos && !this.allPoisonsSet()) {
      nextIndex = (nextIndex + 1) % this.players.length;
    }
    this.currentPlayerIndex = this.allPoisonsSet() ? 0 : nextIndex;
    debugLog('更新当前玩家:', { currentPlayerIndex: this.currentPlayerIndex, currentPlayerId: this.players[this.currentPlayerIndex]?.id });

    return { success: true, playerId };
  }

  allPoisonsSet() {
    const allSet = this.players.every(p => p.poisonPos !== null);
    debugLog('检查毒药设置状态:', { roomId: this.roomId, allSet, players: this.players.map(p => ({ id: p.id, poisonPos: p.poisonPos })) });
    return allSet;
  }

  flipTile(playerId, x, y) {
    if (this.status !== 'playing') {
      debugWarn('翻转格子失败，非游戏状态:', { playerId, roomId: this.roomId, status: this.status });
      return { success: false, message: '游戏未在进行中' };
    }
    const currentPlayer = this.players[this.currentPlayerIndex];
    if (!currentPlayer) {
      debugWarn('翻转格子失败，无当前玩家:', { playerId, roomId: this.roomId });
      return { success: false, message: '无当前玩家' };
    }
    if (playerId !== currentPlayer.id) {
      debugWarn('翻转格子失败，非当前玩家:', { playerId, currentPlayerId: currentPlayer.id });
      return { success: false, message: '非你的回合' };
    }
    if (currentPlayer.isOut) {
      debugWarn('翻转格子失败，玩家已出局:', { playerId });
      return { success: false, message: '你已出局' };
    }
    if (this.board[x][y] !== null) {
      debugWarn('翻转格子失败，格子已翻转:', { playerId, x, y });
      return { success: false, message: '格子已翻转' };
    }
    if (x < 0 || x >= this.boardSize || y < 0 || y >= this.boardSize) {
      debugWarn('翻转格子失败，无效位置:', { playerId, x, y });
      return { success: false, message: '无效的格子位置' };
    }

    const isPoison = this.players.some(p => p.poisonPos && p.poisonPos.x === x && p.poisonPos.y === y);
    if (isPoison) {
      currentPlayer.isOut = true;
      this.board[x][y] = 'poison';
    } else {
      this.board[x][y] = currentPlayer.emoji;
    }

    this.nextTurn();

    const result = this.checkGameEnd();
    if (result) {
      this.status = 'ended';
      this.gameStarted = false; // 重要：游戏结束时重置gameStarted标志
      debugLog('游戏结束，重置gameStarted:', { roomId: this.roomId, result, gameStarted: this.gameStarted });
    }

    debugLog('翻转格子成功:', { playerId, x, y, isPoison, roomId: this.roomId });
    return { success: true, board: this.board, isPoison, currentPlayer: this.players[this.currentPlayerIndex], gameResult: result };
  }

  nextTurn() {
    let nextIndex = (this.currentPlayerIndex + 1) % this.players.length;
    while (this.players[nextIndex].isOut && this.players.some(p => !p.isOut)) {
      nextIndex = (nextIndex + 1) % this.players.length;
    }
    this.currentPlayerIndex = nextIndex;
    debugLog('切换到下一玩家:', { currentPlayerIndex: this.currentPlayerIndex, currentPlayerId: this.players[this.currentPlayerIndex]?.id });
  }

  checkGameEnd() {
    const activePlayers = this.players.filter(p => !p.isOut);
    if (activePlayers.length === 1) {
      return { status: 'win', winner: activePlayers[0].name };
    }

    const unopenedTiles = this.board.flat().filter(tile => tile === null).length;
    if (unopenedTiles === activePlayers.length && activePlayers.every(p => this.board[p.poisonPos.x][p.poisonPos.y] === null)) {
      return { status: 'draw' };
    }
    return null;
  }

  restart() {
    this.board = Array(this.boardSize).fill().map(() => Array(this.boardSize).fill(null));
    this.currentPlayerIndex = 0;
    this.gameStarted = false;
    this.status = this.players.length === this.playerCount ? 'settingPoison' : 'waiting';
    this.players.forEach(player => {
      player.poisonPos = null;
      player.isOut = false;
    });
    debugLog('游戏重启:', { roomId: this.roomId, players: this.players });
    return true;
  }

  removePlayer(clientId) {
    const initialLength = this.players.length;
    this.players = this.players.filter(p => p.id !== clientId);
    if (this.players.length === 0) return null;
    
    // 处理不同状态下的玩家移除逻辑
    if (this.status === 'settingPoison' && this.players.length < this.playerCount) {
      this.status = 'waiting';
      this.currentPlayerIndex = 0;
    }
    
    if (this.status === 'playing' && this.players[this.currentPlayerIndex]?.id === clientId) {
      this.nextTurn();
    }
    
    // 修复：等待重启状态下的玩家移除逻辑
    if (this.status === 'waitingForRestart') {
      // 如果还有足够玩家，保持waitingForRestart状态；否则重置为waiting
      if (this.players.length < this.playerCount) {
        this.status = 'waiting';
        this.gameStarted = false; // 重要：重置游戏开始标志
        // 清除该房间的重启请求记录
        debugLog('清除重启请求记录，重置游戏状态:', { roomId: this.roomId, gameStarted: this.gameStarted });
      }
    }
    
    // 修复：游戏结束状态下人数不足时重置为等待
    if (this.status === 'ended' && this.players.length < this.playerCount) {
      this.status = 'waiting';
      this.gameStarted = false; // 重要：重置游戏开始标志
      debugLog('游戏结束状态重置为等待:', { roomId: this.roomId, playersCount: this.players.length, gameStarted: this.gameStarted });
    }
    
    debugLog('玩家移除:', { clientId, roomId: this.roomId, remainingPlayers: this.players.length, newStatus: this.status });
    return initialLength > this.players.length ? this.getState() : false;
  }

  getState() {
    return {
      roomId: this.roomId,
      board: this.board,
      players: this.players,
      currentPlayerIndex: this.currentPlayerIndex,
      gameStarted: this.gameStarted,
      status: this.status,
      playerCount: this.playerCount,
      boardSize: this.boardSize,
    };
  }

  startGame() {
    if (this.allPoisonsSet()) {
      this.gameStarted = true;
      this.status = 'playing';
      this.currentPlayerIndex = 0;
      debugLog('游戏开始:', { roomId: this.roomId, players: this.players, currentPlayerIndex: this.currentPlayerIndex });
      return true;
    }
    debugLog('无法开始游戏，毒药未全部设置:', { roomId: this.roomId, players: this.players });
    return false;
  }
}

const games = new Map();
const clients = new Map();
const restartRequests = new Map();

wss.on('connection', (ws, req) => {
  let clientId;
  try {
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    clientId = urlParams.get('clientId');
    if (!clientId) {
      debugError('无效客户端ID，拒绝连接', { url: req.url });
      ws.close(4000, 'Missing clientId');
      return;
    }
  } catch (error) {
    debugError('解析 clientId 失败', { error: error.message, url: req.url });
    ws.close(4000, 'Invalid clientId format');
    return;
  }

  if (clients.has(clientId)) {
    debugWarn('重复的 clientId，关闭旧连接', { clientId });
    const oldWs = clients.get(clientId);
    oldWs.close(4001, 'Duplicate clientId');
  }

  debugLog('客户端连接:', { clientId });
  ws.clientId = clientId;
  ws.isAlive = true;
  clients.set(clientId, ws);

  send(clientId, { type: 'connected', clientId });

  ws.on('pong', () => {
    debugLog('收到 pong:', { clientId });
    ws.isAlive = true;
  });

  ws.on('message', (message) => {
    try {
      const msgStr = message.toString();
      if (!msgStr || msgStr === 'undefined') {
        debugWarn('收到无效消息:', { clientId, message: msgStr });
        send(clientId, { type: 'error', message: '无效消息' });
        return;
      }

      let data;
      try {
        data = JSON.parse(msgStr);
        debugLog('解析消息成功:', { clientId, data });
      } catch (parseError) {
        debugError('消息解析失败:', { clientId, error: parseError.message, rawMessage: msgStr });
        send(clientId, { type: 'error', message: '消息格式错误' });
        return;
      }

      debugLog('收到消息:', { clientId, data });
      const action = data.action || data.type;
      const { roomId, x, y, boardSize, playerCount, name } = data;
      let game = games.get(roomId);

      if (!data.clientId || data.clientId !== clientId) {
        debugWarn('clientId 不匹配:', { clientId, messageClientId: data.clientId });
        send(clientId, { type: 'error', message: 'clientId 不匹配' });
        return;
      }

      if (action === 'create') {
        debugLog('处理 create 请求:', { clientId, boardSize, playerCount, name });
        if (boardSize < 5 || boardSize > 10 || playerCount < 2 || playerCount > 5 || !name) {
          debugWarn('创建房间失败，无效参数:', { clientId, boardSize, playerCount, name });
          send(clientId, { type: 'error', message: '无效的棋盘、玩家数或昵称' });
          return;
        }
        const newRoomId1 = uuidv4();
        const newRoomId = Math.floor(1000 + Math.random() * 9000).toString();
        game = new Game(newRoomId, boardSize, playerCount);
        const addResult = game.addPlayer(clientId, name);
        if (!addResult.success) {
          debugWarn('添加玩家失败:', { clientId, message: addResult.message });
          send(clientId, { type: 'error', message: addResult.message });
          return;
        }
        games.set(newRoomId, game);
        debugLog('创建房间成功:', { roomId: newRoomId, boardSize, playerCount, clientId });
        const state = game.getState();
        const message = { type: 'gameCreated', roomId: newRoomId, boardSize, playerCount, state, players: game.players };
        broadcast(newRoomId, message);
        debugLog('广播 gameCreated:', { roomId: newRoomId, clientId, message });
      } else if (action === 'join') {
        if (!game) {
          debugWarn('加入房间失败，房间不存在:', { clientId, roomId });
          send(clientId, { type: 'error', message: '房间不存在' });
          return;
        }
        const addResult = game.addPlayer(clientId, name);
        if (!addResult.success) {
          debugWarn('添加玩家失败:', { clientId, message: addResult.message });
          send(clientId, { type: 'error', message: addResult.message });
          return;
        }
        debugLog('玩家加入:', { clientId, roomId, name });
        broadcast(roomId, { type: 'playerJoined', success: true, state: game.getState(), players: game.players });
      } else if (action === 'setPoison') {
        if (!game) {
          debugWarn('设置毒药失败，房间不存在:', { clientId, roomId });
          send(clientId, { type: 'error', message: '房间不存在' });
          return;
        }
        const result = game.setPoison(clientId, x, y);
        if (!result.success) {
          debugWarn('设置毒药失败:', { clientId, message: result.message });
          send(clientId, { type: 'error', message: result.message });
          return;
        }
        debugLog('毒药设置成功，广播消息:', { clientId, x, y, roomId, players: game.players });
        const state = game.getState();
        broadcast(roomId, { type: 'poisonSet', success: true, state, players: game.players, playerId: result.playerId });
        if (game.allPoisonsSet()) {
          game.startGame();
          debugLog('所有毒药设置完成，游戏开始:', { roomId, players: game.players });
          broadcast(roomId, { type: 'gameStarted', success: true, state: game.getState(), players: game.players });
        }
      } else if (action === 'flipTile') {
        if (!game) {
          debugWarn('翻转格子失败，房间不存在:', { clientId, roomId });
          send(clientId, { type: 'error', message: '房间不存在' });
          return;
        }
        const result = game.flipTile(clientId, x, y);
        debugLog('flipTile 处理结果:', { clientId, x, y, roomId, result });
        broadcast(roomId, { type: 'tileFlipped', state: game.getState(), players: game.players, ...result });
      } else if (action === 'restart') {
        if (!game) {
          debugWarn('重启游戏失败，房间不存在:', { clientId, roomId });
          send(clientId, { type: 'error', message: '房间不存在' });
          return;
        }
        let roomRequests = restartRequests.get(roomId) || new Set();
        if (roomRequests.has(clientId)) {
          debugLog('重复的重启请求，忽略:', { clientId, roomId });
          return;
        }
        roomRequests.add(clientId);
        restartRequests.set(roomId, roomRequests);
        debugLog('玩家请求重启:', { clientId, roomId, restartCount: roomRequests.size });

        game.status = 'waitingForRestart';
        game.gameStarted = false; // 重要：重置游戏开始标志，允许玩家重新加入
        debugLog('重启请求：设置状态为waitingForRestart', { 
          roomId: roomId, 
          gameStarted: game.gameStarted, 
          status: game.status,
          playersCount: game.players.length
        });
        broadcast(roomId, {
          type: 'restartRequest',
          restartCount: roomRequests.size,
          state: game.getState(),
          players: game.players,
        });

        if (roomRequests.size >= game.players.length) {
          game.restart();
          debugLog('游戏重启:', { roomId });
          restartRequests.delete(roomId);
          broadcast(roomId, { type: 'gameRestarted', state: game.getState(), players: game.players });
        }
      } else if (action === 'leaveRoom') {
        debugLog('处理 leaveRoom:', { clientId, roomId });
        if (!game) {
          debugWarn('房间不存在:', { roomId, clientId });
          send(clientId, { type: 'leftRoom', success: true });
          clients.delete(clientId);
          ws.close(1000, 'normal closure');
          return;
        }
        const state = game.removePlayer(clientId);
        if (state) {
          let roomRequests = restartRequests.get(roomId);
          if (roomRequests) {
            roomRequests.delete(clientId);
            // 如果游戏状态重置为waiting，清空重启请求
            if (game.status === 'waiting') {
              restartRequests.delete(roomId);
              debugLog('游戏状态重置为waiting，清空重启请求:', { roomId });
            } else {
              restartRequests.set(roomId, roomRequests);
            }
          }
          broadcast(roomId, { type: 'playerLeft', state, players: game.players });
          if (game.players.length === 0) {
            debugLog('房间无人，删除:', { roomId });
            games.delete(roomId);
            restartRequests.delete(roomId);
          }
        }
        send(clientId, { type: 'leftRoom', success: true });
        clients.delete(clientId);
        ws.close(1000, 'normal closure');
      } else if (action === 'ping') {
        debugLog('收到 ping:', { clientId });
        send(clientId, { type: 'pong' });
      } else {
        debugWarn('未知动作:', { action, clientId });
        send(clientId, { type: 'error', message: '未知动作' });
      }
    } catch (error) {
      debugError('消息处理错误:', { clientId, error: error.message });
      send(clientId, { type: 'error', message: '服务器内部错误' });
    }
  });

  ws.on('close', (code, reason) => {
    debugLog('客户端关闭:', { clientId, code, reason: reason.toString() });
    clients.delete(clientId);
    handleClientDisconnect(clientId);
  });

  ws.on('error', (error) => {
    debugError('WebSocket 错误:', { clientId, error: error.message });
    clients.delete(clientId);
    handleClientDisconnect(clientId);
  });
});

setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) {
      debugLog('客户端无响应，断开:', { clientId: ws.clientId });
      ws.terminate();
      clients.delete(ws.clientId);
      handleClientDisconnect(ws.clientId);
      return;
    }
    ws.isAlive = false;
    ws.ping();
    debugLog('发送 ping:', { clientId: ws.clientId });
  });
}, 30000);

function send(clientId, message) {
  const ws = clients.get(clientId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(message));
      debugLog('发送消息成功:', { clientId, message });
    } catch (error) {
      debugError('发送消息失败:', { clientId, error: error.message, message });
      clients.delete(clientId);
      ws.close(1000, 'send failed');
    }
  } else {
    debugWarn('发送失败，客户端未连接:', { clientId, message });
  }
}

function broadcast(roomId, message) {
  const game = games.get(roomId);
  if (!game) {
    debugWarn('广播失败，房间不存在:', { roomId });
    return;
  }
  debugLog('广播消息:', { roomId, message, playerCount: game.players.length });
  game.players.forEach(player => {
    debugLog('发送给玩家:', { playerId: player.id, message });
    send(player.id, message);
  });
}

function handleClientDisconnect(clientId) {
  for (const [roomId, game] of games) {
    const state = game.removePlayer(clientId);
    if (state === null) {
      debugLog('房间为空，删除:', { roomId });
      games.delete(roomId);
      restartRequests.delete(roomId);
    } else if (state) {
      let roomRequests = restartRequests.get(roomId);
      if (roomRequests) {
        roomRequests.delete(clientId);
        // 如果游戏状态重置为waiting，清空重启请求
        if (game.status === 'waiting') {
          restartRequests.delete(roomId);
          debugLog('游戏状态重置为waiting，清空重启请求:', { roomId });
        } else {
          restartRequests.set(roomId, roomRequests);
        }
      }
      broadcast(roomId, { type: 'playerLeft', state, players: game.players });
    }
  }
}

app.get('/health', (req, res) => res.send('OK'));

server.listen(3000, () => {
  debugLog('服务器运行在 http://localhost:3000');
});