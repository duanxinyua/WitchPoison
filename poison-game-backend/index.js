/**
 * 女巫的毒药 - 游戏后端服务器
 * 创建时间: 2025-07-25
 * 最后修改: 2025-07-25 by Claude
 * 功能: 提供多人在线游戏的WebSocket服务和HTTP接口
 * 技术栈: Node.js + Express + WebSocket
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// 2025-07-25: 引入数据库和认证模块
const { initDatabase, closeDatabase } = require('./config/database');
const authRoutes = require('./routes/auth');

// 调试开关 - 控制日志输出详细程度
// 2025-07-25: 保持开启状态用于开发调试
const DEBUG = true;

/**
 * 调试日志函数 - 普通信息
 * @param {...any} args - 需要输出的参数
 */
function debugLog(...args) {
  if (DEBUG) console.log(`[${new Date().toISOString()}] [LOG]`, ...args);
}

/**
 * 调试警告函数 - 警告信息
 * @param {...any} args - 需要输出的参数
 */
function debugWarn(...args) {
  if (DEBUG) console.warn(`[${new Date().toISOString()}] [WARN]`, ...args);
}

/**
 * 调试错误函数 - 错误信息
 * @param {...any} args - 需要输出的参数
 */
function debugError(...args) {
  if (DEBUG) console.error(`[${new Date().toISOString()}] [ERROR]`, ...args);
}

// Express应用实例
const app = express();

// 2025-07-25: 配置Express中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2025-07-25: 配置CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// 2025-07-25: 注册认证路由
app.use('/api/auth', authRoutes);

// HTTP服务器实例
const server = http.createServer(app);
// WebSocket服务器实例
const wss = new WebSocket.Server({ server });

/**
 * Game类 - 游戏核心逻辑管理
 * 创建时间: 2025-07-25
 * 功能: 管理单个游戏房间的状态、玩家和游戏逻辑
 * 
 * 游戏状态流程:
 * waiting -> settingPoison -> playing -> ended -> waitingForRestart
 */
class Game {
  /**
   * Game类构造函数
   * @param {string} roomId - 房间唯一标识符
   * @param {number} boardSize - 棋盘大小 (5-10)
   * @param {number} playerCount - 房间最大玩家数量 (2-5)
   */
  constructor(roomId, boardSize, playerCount) {
    // 房间基本信息
    this.roomId = roomId;                    // 房间ID
    this.boardSize = boardSize;              // 棋盘尺寸
    this.playerCount = playerCount;          // 房间容量
    
    // 游戏状态管理
    this.board = Array(boardSize).fill().map(() => Array(boardSize).fill(null)); // 棋盘状态二维数组
    this.players = [];                       // 玩家列表
    this.currentPlayerIndex = 0;             // 当前回合玩家索引
    this.gameStarted = false;                // 游戏是否已开始
    this.status = 'waiting';                 // 游戏当前状态
    
    // 玩家头像emoji数组 - 2025-07-25: 确保每个头像都不重复，支持更多玩家
    this.emojis = ['😺', '🐶', '🐰', '🦅', '🐘', '🐸', '🦊', '🐯', '🐨', '🐼'];
  }

  /**
   * 添加玩家到房间
   * 2025-07-25: 处理玩家加入逻辑，包括重连和状态检查
   * @param {string} id - 玩家唯一ID
   * @param {string} name - 玩家昵称
   * @param {string} avatarEmoji - 玩家头像emoji（可选）
   * @returns {Object} - 操作结果 {success: boolean, message?: string}
   */
  addPlayer(id, name, avatarEmoji = null) {
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
        playerName: name,
        currentPlayers: this.players.map(p => ({ id: p.id, name: p.name }))
      });
      return { success: false, message: '游戏进行中，无法加入' };
    }
    if (!id || !name || typeof name !== 'string' || name.length > 20) {
      return { success: false, message: '无效的玩家ID或昵称' };
    }
    
    // 检查是否已存在相同 clientId
    if (this.players.some(p => p.id === id)) {
      debugLog('拒绝加入 - 玩家已在房间中:', { 
        playerId: id, 
        playerName: name,
        existingPlayers: this.players.map(p => ({ id: p.id, name: p.name })),
        roomId: this.roomId
      });
      return { success: false, message: '玩家已在房间中' };
    }
    
    // 检查是否已存在相同名字的玩家（可能是断线重连）
    const existingPlayerIndex = this.players.findIndex(p => p.name === name);
    if (existingPlayerIndex !== -1) {
      debugLog('发现同名玩家，替换旧记录:', { 
        playerId: id, 
        playerName: name,
        oldPlayerId: this.players[existingPlayerIndex].id,
        oldIsOut: this.players[existingPlayerIndex].isOut,
        roomId: this.roomId
      });
      // 替换旧的玩家记录，确保重置所有状态
      // 2025-07-25: 使用用户新传递的头像或保持原有头像
      const finalEmoji = avatarEmoji || this.players[existingPlayerIndex].emoji;
      this.players[existingPlayerIndex] = { id, name, emoji: finalEmoji, poisonPos: null, isOut: false, clientId: id };
      debugLog('玩家重新加入（替换旧记录）后状态:', { 
        id, 
        name, 
        roomId: this.roomId, 
        isOut: this.players[existingPlayerIndex].isOut,
        poisonPos: this.players[existingPlayerIndex].poisonPos,
        players: this.players.length, 
        status: this.status 
      });
      
      // 重要：替换记录后也需要检查房间状态是否需要更新
      // 如果房间在等待重启状态或游戏结束状态，重置游戏状态
      if (this.status === 'waitingForRestart' || this.status === 'ended') {
        this.status = 'waiting';
        this.gameStarted = false;
        // 重置棋盘
        this.board = Array(this.boardSize).fill().map(() => Array(this.boardSize).fill(null));
        // 重置所有玩家状态
        this.players.forEach(player => {
          player.poisonPos = null;
          player.isOut = false;
        });
        this.currentPlayerIndex = 0;
        debugLog('玩家重新加入时重置游戏状态:', { 
          roomId: this.roomId, 
          playersCount: this.players.length, 
          gameStarted: this.gameStarted, 
          status: this.status,
          boardReset: this.board.every(row => row.every(cell => cell === null))
        });
      }
      
      // 更新房间状态逻辑
      if (this.players.length === this.playerCount) {
        if (this.status === 'waiting') {
          this.status = 'settingPoison';
          this.currentPlayerIndex = 0;
          debugLog('替换记录后房间满员，切换到设置毒药阶段:', { roomId: this.roomId, status: this.status });
        }
        // 注意：如果状态是'waitingForRestart'，不应该自动转换为'settingPoison'
        // 因为游戏仍在等待重启确认
      }
      
      return { success: true };
    }
    
    // 如果房间在等待重启状态或游戏结束状态，重置游戏状态
    if (this.status === 'waitingForRestart' || this.status === 'ended') {
      this.status = 'waiting';
      this.gameStarted = false;
      // 重置棋盘
      this.board = Array(this.boardSize).fill().map(() => Array(this.boardSize).fill(null));
      // 重置所有玩家状态
      this.players.forEach(player => {
        player.poisonPos = null;
        player.isOut = false;
      });
      this.currentPlayerIndex = 0;
      debugLog('新玩家加入时重置游戏状态:', { 
        roomId: this.roomId, 
        playersCount: this.players.length, 
        gameStarted: this.gameStarted, 
        status: this.status,
        boardReset: this.board.every(row => row.every(cell => cell === null))
      });
    }
    
    // 2025-07-25: 优先使用用户自定义头像，否则分配默认头像
    let emoji;
    if (avatarEmoji) {
      // 使用用户传递的头像
      emoji = avatarEmoji;
      debugLog('使用用户自定义头像:', { playerId: id, customEmoji: emoji });
    } else {
      // 获取已使用的头像列表
      const usedEmojis = this.players.map(p => p.emoji);
      // 找到第一个未使用的头像
      emoji = this.emojis.find(e => !usedEmojis.includes(e));
      // 如果所有头像都被使用了，回到循环分配
      if (!emoji) {
        emoji = this.emojis[this.players.length % this.emojis.length];
      }
      debugLog('使用默认头像分配:', { playerId: id, defaultEmoji: emoji });
    }
    
    debugLog('为新玩家分配头像:', { 
      playerId: id, 
      playerName: name, 
      assignedEmoji: emoji, 
      usedEmojis, 
      availableEmojis: this.emojis 
    });
    
    this.players.push({ id, name, emoji, poisonPos: null, isOut: false, clientId: id });
    
    // 更新房间状态逻辑
    if (this.players.length === this.playerCount) {
      if (this.status === 'waiting') {
        this.status = 'settingPoison';
        this.currentPlayerIndex = 0;
        debugLog('房间满员，切换到设置毒药阶段:', { roomId: this.roomId, status: this.status });
      }
      // 注意：如果状态是'waitingForRestart'，不应该自动转换为'settingPoison'
      // 因为游戏仍在等待重启确认
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
      debugWarn('翻转格子失败，无当前玩家:', { playerId, roomId: this.roomId, currentPlayerIndex: this.currentPlayerIndex, playersCount: this.players.length });
      return { success: false, message: '无当前玩家' };
    }
    if (playerId !== currentPlayer.id) {
      debugWarn('翻转格子失败，非当前玩家:', { playerId, currentPlayerId: currentPlayer.id, currentPlayerIndex: this.currentPlayerIndex });
      return { success: false, message: '非你的回合' };
    }
    if (currentPlayer.isOut) {
      debugWarn('翻转格子失败，玩家已出局:', { 
        playerId, 
        playerName: currentPlayer.name,
        isOut: currentPlayer.isOut,
        currentPlayerIndex: this.currentPlayerIndex,
        allPlayers: this.players.map(p => ({ id: p.id, name: p.name, isOut: p.isOut })),
        roomId: this.roomId
      });
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
    // 确保当前玩家索引指向有效玩家
    if (this.players.length > 0) {
      this.currentPlayerIndex = 0;
    }
    debugLog('游戏重启后状态:', { 
      roomId: this.roomId, 
      players: this.players.map(p => ({ id: p.id, name: p.name, isOut: p.isOut, poisonPos: p.poisonPos })),
      currentPlayerIndex: this.currentPlayerIndex,
      status: this.status
    });
    return true;
  }

  removePlayer(clientId) {
    const initialLength = this.players.length;
    debugLog('开始移除玩家:', { 
      clientId, 
      roomId: this.roomId, 
      initialPlayersCount: initialLength,
      currentStatus: this.status,
      gameStarted: this.gameStarted,
      players: this.players.map(p => ({ id: p.id, name: p.name }))
    });
    this.players = this.players.filter(p => p.id !== clientId);
    if (this.players.length === 0) {
      debugLog('房间清空，返回null');
      return null;
    }
    
    // 处理不同状态下的玩家移除逻辑
    if (this.status === 'settingPoison' && this.players.length < this.playerCount) {
      this.status = 'waiting';
      this.currentPlayerIndex = 0;
    }
    
    if (this.status === 'playing') {
      // 检查是否需要重置游戏状态
      if (this.players.length < this.playerCount) {
        this.status = 'waiting';
        this.gameStarted = false;
        // 重置棋盘和玩家状态
        this.board = Array(this.boardSize).fill().map(() => Array(this.boardSize).fill(null));
        this.players.forEach(player => {
          player.poisonPos = null;
          player.isOut = false;
        });
        this.currentPlayerIndex = 0;
        debugLog('游戏中玩家退出导致人数不足，重置游戏状态:', { 
          roomId: this.roomId, 
          playersLeft: this.players.length, 
          requiredPlayers: this.playerCount,
          boardReset: this.board.every(row => row.every(cell => cell === null))
        });
      } else if (this.players[this.currentPlayerIndex]?.id === clientId) {
        this.nextTurn();
      }
    }
    
    // 修复：等待重启状态下的玩家移除逻辑
    if (this.status === 'waitingForRestart') {
      // 如果还有足够玩家，保持waitingForRestart状态；否则重置为waiting
      if (this.players.length < this.playerCount) {
        this.status = 'waiting';
        this.gameStarted = false;
        // 重置棋盘和玩家状态
        this.board = Array(this.boardSize).fill().map(() => Array(this.boardSize).fill(null));
        this.players.forEach(player => {
          player.poisonPos = null;
          player.isOut = false;
        });
        this.currentPlayerIndex = 0;
        debugLog('等待重启状态重置游戏:', { 
          roomId: this.roomId, 
          gameStarted: this.gameStarted,
          playersLeft: this.players.length,
          requiredPlayers: this.playerCount,
          boardReset: this.board.every(row => row.every(cell => cell === null))
        });
      }
    }
    
    // 修复：游戏结束状态下人数不足时重置为等待
    if (this.status === 'ended' && this.players.length < this.playerCount) {
      this.status = 'waiting';
      this.gameStarted = false;
      // 重置棋盘和玩家状态
      this.board = Array(this.boardSize).fill().map(() => Array(this.boardSize).fill(null));
      this.players.forEach(player => {
        player.poisonPos = null;
        player.isOut = false;
      });
      this.currentPlayerIndex = 0;
      debugLog('游戏结束状态重置为等待:', { 
        roomId: this.roomId, 
        playersCount: this.players.length, 
        gameStarted: this.gameStarted,
        boardReset: this.board.every(row => row.every(cell => cell === null))
      });
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
      // 确保第一个玩家状态正确
      if (this.players.length > 0) {
        this.players[0].isOut = false;
      }
      debugLog('游戏开始:', { 
        roomId: this.roomId, 
        players: this.players.map(p => ({ id: p.id, name: p.name, isOut: p.isOut, poisonPos: !!p.poisonPos })), 
        currentPlayerIndex: this.currentPlayerIndex,
        currentPlayer: this.players[this.currentPlayerIndex]
      });
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
      const { roomId, x, y, boardSize, playerCount, name, avatarEmoji } = data;
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
        // 2025-07-25: 修复房间ID重复问题 - 使用UUID确保唯一性，同时生成用户友好的短ID
        let newRoomId;
        let attempts = 0;
        const maxAttempts = 10;
        
        // 生成唯一的房间ID，避免重复
        do {
          // 生成6位数字ID，比4位更安全，比UUID更用户友好
          newRoomId = Math.floor(100000 + Math.random() * 900000).toString();
          attempts++;
        } while (games.has(newRoomId) && attempts < maxAttempts);
        
        // 如果短ID生成失败，使用UUID确保唯一性
        if (games.has(newRoomId)) {
          newRoomId = uuidv4().substring(0, 8).toUpperCase(); // 使用UUID前8位
          debugWarn('短ID生成失败，使用UUID:', { roomId: newRoomId, attempts });
        }
        game = new Game(newRoomId, boardSize, playerCount);
        const addResult = game.addPlayer(clientId, name, avatarEmoji);
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
        const addResult = game.addPlayer(clientId, name, avatarEmoji);
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
          const gameState = game.getState();
          debugLog('游戏重启完成，广播重启消息:', { 
            roomId,
            playersAfterRestart: game.players.map(p => ({ id: p.id, name: p.name, isOut: p.isOut, poisonPos: p.poisonPos })),
            currentPlayerIndex: game.currentPlayerIndex,
            status: game.status,
            boardAfterRestart: gameState.board,
            boardIsEmpty: gameState.board.every(row => row.every(cell => cell === null))
          });
          restartRequests.delete(roomId);
          broadcast(roomId, { type: 'gameRestarted', state: gameState, players: game.players });
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

// 2025-07-25: 服务器启动时初始化数据库
async function startServer() {
  try {
    // 初始化数据库连接
    debugLog('正在初始化数据库连接...');
    const dbInitialized = await initDatabase();
    
    if (!dbInitialized) {
      debugError('数据库初始化失败，服务器启动中止');
      process.exit(1);
    }
    
    debugLog('数据库连接初始化成功');
    
    // 启动HTTP服务器
    server.listen(3000, () => {
      debugLog('服务器运行在 http://localhost:3000');
      debugLog('WebSocket服务器已启动');
      debugLog('数据库持久化已启用');
    });
  } catch (error) {
    debugError('服务器启动失败:', error);
    process.exit(1);
  }
}

// 优雅关闭处理
process.on('SIGINT', async () => {
  debugLog('收到SIGINT信号，开始优雅关闭...');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  debugLog('收到SIGTERM信号，开始优雅关闭...');
  await closeDatabase();
  process.exit(0);
});

// 启动服务器
startServer();