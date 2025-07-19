<template>
  <view class="game">
    <view class="room-info">房间 ID: {{ roomId }}</view>
    <view class="player-info">
      <view class="current-player">
        <text>{{ getCurrentPlayerName() }}</text>
      </view>
    </view>
    <view class="status">
      <text v-if="status === 'waiting'">等待玩家加入（{{ players.length }}/{{ playerCount }}）</text>
      <text v-else-if="status === 'settingPoison'">请设置毒药位置</text>
      <text v-else-if="status === 'playing' && currentPlayer">当前回合：{{ currentPlayer.name }} ({{ currentPlayer.emoji }})</text>
      <text v-else-if="status === 'ended'">游戏结束！{{ gameResult ? (gameResult.status === 'win' ? `胜利者：${gameResult.winner}` : '平局') : '' }}</text>
      <text v-else-if="status === 'waitingForRestart'">等待其他玩家同意重启（{{ restartCount }}/{{ playerCount }}）</text>
    </view>
    <GameGrid
      :board="board"
      :game-started="gameStarted"
      :poison-set="!!players.find(p => p.id === clientId)?.poisonPos"
      :game-result="gameResult"
      :current-player-poison="getCurrentPlayerPoisonPos()"
      :status="status"
      @cell-click="handleCellClick"
    />
    <view class="actions" v-if="status === 'ended' || status === 'waiting' || status === 'waitingForRestart'">
      <button v-if="status === 'ended' || status === 'waitingForRestart'" @click="restartGame" :disabled="restartRequested">重新开始</button>
      <button @click="goBackHome">返回首页</button>
    </view>
  </view>
</template>

<script>
import { connect, sendMessage, onMessage, isConnected, closeWebSocket } from '../../utils/websocket';
import GameGrid from '../../components/GameGrid.vue';

export default {
  components: {
    GameGrid,
  },
  data() {
    return {
      roomId: '',
      clientId: '',
      board: [],
      players: [],
      currentPlayer: null,
      gameStarted: false,
      status: 'waiting',
      playerCount: 0,
      boardSize: 5,
      gameResult: null,
      removeMessageCallback: null,
      leaveTimeout: null,
      isRestarting: false,
      isSettingPoison: false,
      restartRequested: false,
      restartCount: 0,
      isFlipping: false,
      setPoisonTimeout: null,
      flipTileTimeout: null,
      hasJoined: false,
    };
  },
  methods: {
    async init() {
      this.clientId = uni.getStorageSync('clientId');
      console.log('game.vue clientId:', this.clientId);
      if (!this.clientId) {
        console.error('客户端 ID 缺失');
        uni.showToast({ title: '客户端 ID 缺失', icon: 'error' });
        this.cleanupAndGoHome();
        return;
      }
      // 初始化空棋盘时不要强制创建，等待从服务器获取正确的尺寸
      if (!this.board.length && this.boardSize > 0) {
        this.$set(this, 'board', Array(this.boardSize).fill().map(() => Array(this.boardSize).fill(null)));
        console.log('初始化空棋盘:', { boardSize: this.boardSize, board: this.board });
      }
      if (this.hasJoined || this.players.some(p => p.id === this.clientId)) {
        console.log('玩家已加入房间，跳过 join 请求:', { clientId: this.clientId, roomId: this.roomId });
        this.registerMessageHandler();
        return;
      }
      if (!isConnected()) {
        try {
          await connect(this.clientId);
          console.log('WebSocket 连接成功');
          await new Promise(resolve => setTimeout(resolve, 2000));
          this.registerMessageHandler();
          this.sendJoinMessage();
        } catch (error) {
          console.error('WebSocket 初始化失败:', error);
          uni.showToast({ title: '无法连接服务器，请稍后重试', icon: 'none' });
          uni.hideLoading();
          this.cleanupAndGoHome();
        }
      } else {
        console.log('WebSocket 已连接');
        this.registerMessageHandler();
        this.sendJoinMessage();
      }
    },
    sendJoinMessage() {
      const joinMessage = { action: 'join', roomId: this.roomId, clientId: this.clientId, name: uni.getStorageSync('nickname') || `Player${Date.now()}` };
      const sent = sendMessage(joinMessage);
      if (sent) {
        console.log('发送加入房间请求:', joinMessage);
        uni.showLoading({ title: '加入房间中...' });
        this.hasJoined = true;
      } else {
        console.error('发送加入房间请求失败:', joinMessage);
        uni.showToast({ title: '网络未连接，加入失败', icon: 'error' });
        uni.hideLoading();
        this.cleanupAndGoHome();
      }
    },
    registerMessageHandler() {
      if (this.removeMessageCallback) {
        this.removeMessageCallback();
        console.log('移除旧消息回调');
      }
      this.removeMessageCallback = onMessage((data) => {
        console.log('游戏页面收到消息:', data);
        try {
          if (!data || !data.type) {
            console.error('无效消息:', data);
            uni.showToast({ title: '无效消息', icon: 'error' });
            uni.hideLoading();
            return;
          }
          if (data.type === 'gameCreated') {
            this.roomId = data.roomId;
            uni.hideLoading();
            uni.showToast({ title: '房间创建成功', icon: 'success' });
            this.updateGameState(data);
          } else if (data.type === 'playerJoined') {
            console.log('处理 playerJoined，检查是否需要重置游戏状态:', {
              status: data.state.status,
              gameStarted: data.state.gameStarted,
              playersCount: data.state.players?.length,
              currentBoard: this.board?.length
            });
            
            // 如果状态回到 waiting，确保完全重置游戏状态
            if (data.state.status === 'waiting' && this.status !== 'waiting') {
              console.log('状态从', this.status, '变为 waiting，强制重置游戏状态');
              // 重置所有游戏相关状态
              this.gameResult = null;
              this.isFlipping = false;
              this.isSettingPoison = false;
              this.restartRequested = false;
              this.restartCount = 0;
            }
            
            this.updateGameState(data);
            uni.showToast({ title: '玩家加入房间', icon: 'success' });
            uni.hideLoading();
            if (data.state.status === 'settingPoison') {
              console.log('进入设置毒药阶段');
            }
          } else if (data.type === 'gameStarted') {
            this.gameStarted = true;
            this.isFlipping = false;
            this.updateGameState(data);
            uni.showToast({ title: '游戏开始！', icon: 'success' });
            uni.hideLoading();
          } else if (data.type === 'poisonSet') {
            this.isSettingPoison = false;
            if (this.setPoisonTimeout) {
              clearTimeout(this.setPoisonTimeout);
              this.setPoisonTimeout = null;
            }
            this.updateGameState(data);
            uni.hideLoading();
            uni.showToast({ title: data.success ? '毒药设置成功' : (data.message || '毒药设置失败'), icon: data.success ? 'success' : 'error' });
          } else if (data.type === 'tileFlipped') {
            this.isFlipping = false;
            if (this.flipTileTimeout) {
              clearTimeout(this.flipTileTimeout);
              this.flipTileTimeout = null;
            }
            console.log('收到 tileFlipped 消息，更新 board:', JSON.parse(JSON.stringify(data.state.board)));
            this.updateGameState(data);
            uni.hideLoading();
            if (data.success) {
              if (data.isPoison) {
                uni.showToast({ title: '翻到毒药！', icon: 'none' });
              }
            } else {
              uni.showToast({ title: data.message || '翻转失败', icon: 'error' });
            }
            if (data.gameResult) {
              uni.showToast({ title: data.gameResult.status === 'win' ? `胜利者：${data.gameResult.winner}` : '平局', icon: 'success' });
            }
          } else if (data.type === 'restartRequest') {
            this.restartCount = data.restartCount || 0;
            this.status = 'waitingForRestart';
            uni.showToast({ title: `等待其他玩家同意重启 (${data.restartCount}/${this.playerCount})`, icon: 'none' });
            uni.hideLoading();
          } else if (data.type === 'gameRestarted') {
            console.log('收到 gameRestarted 消息，开始重置游戏状态:', data);
            this.isRestarting = false;
            this.restartRequested = false;
            this.restartCount = 0;
            this.isFlipping = false;
            this.isSettingPoison = false;
            this.gameResult = null; // 重置 gameResult
            this.hasJoined = true;
            
            // 首先从消息中获取正确的棋盘尺寸
            const correctBoardSize = data.state.boardSize || data.boardSize || this.boardSize;
            if (correctBoardSize !== this.boardSize) {
              console.log('gameRestarted: 更新棋盘尺寸:', this.boardSize, '->', correctBoardSize);
              this.$set(this, 'boardSize', correctBoardSize);
            }
            
            // 强制重置棋盘为空，使用正确的尺寸
            console.log('重置前棋盘状态:', { size: this.board.length, board: JSON.parse(JSON.stringify(this.board)) });
            this.$set(this, 'board', Array(correctBoardSize).fill().map(() => Array(correctBoardSize).fill(null)));
            console.log('重置后棋盘状态:', { size: correctBoardSize, board: JSON.parse(JSON.stringify(this.board)) });
            
            this.updateGameState(data);
            uni.hideLoading();
            uni.showToast({ title: '游戏已重启', icon: 'success' });
            this.$nextTick(() => {
              this.$forceUpdate();
              console.log('强制刷新 UI 后状态:', { 
                status: this.status, 
                board: JSON.parse(JSON.stringify(this.board)),
                players: this.players.map(p => ({ id: p.id, name: p.name, poisonPos: p.poisonPos, isOut: p.isOut }))
              });
            });
          } else if (data.type === 'playerLeft') {
            this.updateGameState(data);
            uni.showToast({ title: '玩家已离开房间', icon: 'none' });
            uni.hideLoading();
          } else if (data.type === 'leftRoom') {
            uni.hideLoading();
            if (this.leaveTimeout) {
              clearTimeout(this.leaveTimeout);
              this.leaveTimeout = null;
            }
            console.log('收到 leftRoom 响应:', data);
            this.cleanupAndGoHome();
          } else if (data.type === 'pong') {
            console.log('收到心跳响应:', data);
          } else if (data.type === 'error') {
            console.error('后端错误:', data.message);
            uni.showToast({ title: data.message || '服务器错误', icon: 'error' });
            uni.hideLoading();
            this.isRestarting = false;
            this.restartRequested = false;
            this.isSettingPoison = false;
            this.isFlipping = false;
            if (this.setPoisonTimeout) {
              clearTimeout(this.setPoisonTimeout);
              this.setPoisonTimeout = null;
            }
            if (this.flipTileTimeout) {
              clearTimeout(this.flipTileTimeout);
              this.flipTileTimeout = null;
            }
            if (data.message === '玩家已在房间中') {
              console.log('玩家已加入，跳过重复 join:', { clientId: this.clientId });
              this.hasJoined = true;
            }
          } else {
            console.warn('未处理的消息类型:', data.type);
            uni.hideLoading();
          }
        } catch (error) {
          console.error('处理游戏消息失败:', error);
          uni.showToast({ title: '消息处理失败', icon: 'error' });
          uni.hideLoading();
          this.isFlipping = false;
          this.isSettingPoison = false;
          if (this.setPoisonTimeout) {
            clearTimeout(this.setPoisonTimeout);
            this.setPoisonTimeout = null;
          }
          if (this.flipTileTimeout) {
            clearTimeout(this.flipTileTimeout);
            this.flipTileTimeout = null;
          }
        }
      });
      console.log('注册新消息回调');
    },
    updateGameState(data) {
      console.log('更新游戏状态，收到数据:', data);
      if (!data || !data.state) {
        console.error('状态数据缺失:', data);
        uni.showToast({ title: '状态数据缺失', icon: 'error' });
        uni.hideLoading();
        return;
      }
      // 首先更新 boardSize，这样后续的棋盘创建会使用正确的尺寸
      const newBoardSize = data.state.boardSize || data.boardSize || this.boardSize;
      if (newBoardSize !== this.boardSize) {
        console.log('更新棋盘尺寸:', this.boardSize, '->', newBoardSize);
        this.$set(this, 'boardSize', newBoardSize);
      }
      
      // 强制重置棋盘：在waiting、settingPoison状态或gameRestarted时清空棋盘
      const shouldResetBoard = data.type === 'gameRestarted' || 
                              data.state.status === 'waiting' || 
                              data.state.status === 'settingPoison';
      
      const newBoard = shouldResetBoard 
        ? Array(newBoardSize).fill().map(() => Array(newBoardSize).fill(null))
        : (Array.isArray(data.state.board) && data.state.board.every(row => Array.isArray(row))
            ? JSON.parse(JSON.stringify(data.state.board))
            : Array(newBoardSize).fill().map(() => Array(newBoardSize).fill(null)));
      this.$set(this, 'board', newBoard);
      // 强制重置玩家状态：在重启、等待或设置毒药状态下完全清理玩家状态
      const shouldResetPlayerStates = data.type === 'gameRestarted' || 
                                     data.state.status === 'waiting' || 
                                     data.state.status === 'settingPoison';
      
      this.$set(this, 'players', Array.isArray(data.state.players) ? data.state.players.map(p => ({
        ...p,
        id: p.clientId || p.id,
        poisonPos: shouldResetPlayerStates ? null : (p.poisonPos || null),
        isOut: shouldResetPlayerStates ? false : (p.isOut || false)
      })) : []);
      const currentPlayerIndex = data.state.currentPlayerIndex >= 0 ? data.state.currentPlayerIndex : 0;
      this.$set(this, 'currentPlayer', this.players[currentPlayerIndex] || null);
      this.$set(this, 'gameStarted', data.state.gameStarted || false);
      this.$set(this, 'status', data.state.status || 'waiting');
      this.$set(this, 'playerCount', data.state.playerCount || data.playerCount || this.players.length);
      if (data.gameResult) {
        this.$set(this, 'gameResult', data.gameResult);
      } else if (data.type === 'gameRestarted') {
        this.$set(this, 'gameResult', null); // 确保重置
      }
      console.log('状态更新后:', {
        updateType: data.type,
        status: this.status,
        gameStarted: this.gameStarted,
        shouldResetBoard: shouldResetBoard,
        shouldResetPlayerStates: shouldResetPlayerStates,
        players: this.players.map(p => ({ id: p.id, name: p.name, poisonPos: p.poisonPos, isOut: p.isOut })),
        playerCount: this.playerCount,
        boardRows: this.board.length,
        boardCols: this.board.length ? this.board[0].length : 0,
        currentPlayer: this.currentPlayer?.id,
        currentPlayerName: this.currentPlayer?.name,
        clientId: this.clientId,
        board: JSON.parse(JSON.stringify(this.board)),
        gameResult: this.gameResult
      });
      this.$nextTick(() => {
        this.$forceUpdate();
      });
    },
    handleCellClick({ row, col }) {
      console.log('game.vue 收到 cell-click:', { row, col, status: this.status, currentPlayer: this.currentPlayer?.id, isSettingPoison: this.isSettingPoison });
      if (this.isFlipping || this.isSettingPoison) {
        console.log('操作进行中，忽略重复点击', { isFlipping: this.isFlipping, isSettingPoison: this.isSettingPoison });
        return;
      }
      if (!isConnected()) {
        console.error('WebSocket 未连接，无法发送请求');
        uni.showToast({ title: '网络未连接，请检查网络', icon: 'error' });
        return;
      }
      if (this.status === 'settingPoison') {
        const player = this.players.find(p => p.id === this.clientId);
        if (!player) {
          console.error('玩家未找到:', { clientId: this.clientId, players: this.players });
          uni.showToast({ title: '玩家未找到', icon: 'error' });
          return;
        }
        if (player.poisonPos) {
          console.log('玩家已设置毒药:', { clientId: this.clientId });
          uni.showToast({ title: '你已设置毒药', icon: 'none' });
          return;
        }
        this.isSettingPoison = true;
        const message = { action: 'setPoison', roomId: this.roomId, x: row, y: col, clientId: this.clientId };
        const sent = sendMessage(message);
        if (sent) {
          console.log('发送设置毒药请求:', message);
          uni.showLoading({ title: '设置毒药中...' });
          this.setPoisonTimeout = setTimeout(() => {
            console.error('设置毒药超时，未收到响应');
            uni.hideLoading();
            uni.showToast({ title: '设置毒药超时，请重试', icon: 'error' });
            this.isSettingPoison = false;
            this.setPoisonTimeout = null;
          }, 5000);
        } else {
          console.error('发送设置毒药失败:', message);
          uni.showToast({ title: '网络未连接，设置失败', icon: 'error' });
          uni.hideLoading();
          this.isSettingPoison = false;
        }
      } else if (this.status === 'playing' && this.currentPlayer && this.currentPlayer.id === this.clientId) {
        const currentPlayerData = this.players.find(p => p.id === this.clientId);
        console.log('翻转格子前玩家状态检查:', {
          clientId: this.clientId,
          currentPlayer: this.currentPlayer,
          currentPlayerData: currentPlayerData,
          isMyTurn: this.currentPlayer?.id === this.clientId,
          playerIsOut: currentPlayerData?.isOut,
          status: this.status
        });
        this.isFlipping = true;
        const message = { action: 'flipTile', roomId: this.roomId, x: row, y: col, clientId: this.clientId };
        const sent = sendMessage(message);
        if (sent) {
          console.log('发送翻转格子请求:', message);
          uni.showLoading({ title: '翻转格子中...' });
          this.flipTileTimeout = setTimeout(() => {
            console.error('翻转格子超时，未收到响应');
            uni.hideLoading();
            uni.showToast({ title: '翻转格子超时，请重试', icon: 'error' });
            this.isFlipping = false;
            this.flipTileTimeout = null;
          }, 5000);
        } else {
          console.error('发送翻转格子失败:', message);
          uni.showToast({ title: '网络未连接，请检查网络', icon: 'error' });
          uni.hideLoading();
          this.isFlipping = false;
        }
      } else {
        console.log('无效操作', { status: this.status, currentPlayerId: this.currentPlayer?.id, clientId: this.clientId });
        uni.showToast({ title: '当前无法操作，请等待你的回合', icon: 'none' });
      }
    },
    restartGame() {
      if (this.isRestarting || this.restartRequested) {
        console.log('重启操作进行中，忽略重复点击');
        return;
      }
      if (!isConnected()) {
        console.error('WebSocket 未连接，无法发送重启请求');
        uni.showToast({ title: '网络未连接，请检查网络', icon: 'error' });
        return;
      }
      this.isRestarting = true;
      this.restartRequested = true;
      const message = { action: 'restart', roomId: this.roomId, clientId: this.clientId };
      const sent = sendMessage(message);
      if (sent) {
        console.log('发送重启请求:', message);
        uni.showLoading({ title: '请求重启中...' });
      } else {
        console.error('发送重启请求失败:', message);
        uni.showToast({ title: '网络未连接，无法重启', icon: 'error' });
        uni.hideLoading();
        this.isRestarting = false;
        this.restartRequested = false;
      }
    },
    goBackHome() {
      console.log('触发返回首页');
      if (!isConnected()) {
        console.warn('WebSocket 未连接，直接返回首页');
        this.cleanupAndGoHome();
        return;
      }
      const message = { action: 'leaveRoom', roomId: this.roomId, clientId: this.clientId };
      const sent = sendMessage(message);
      if (!sent) {
        console.warn('发送退出房间消息失败，直接返回首页');
        this.cleanupAndGoHome();
        return;
      }
      console.log('发送退出房间请求:', message);
      uni.showLoading({ title: '正在退出房间...' });
      this.leaveTimeout = setTimeout(() => {
        console.warn('退出房间超时，直接返回首页');
        uni.hideLoading();
        this.cleanupAndGoHome();
      }, 2000);
    },
    cleanupAndGoHome() {
      console.log('清理资源并返回首页');
      if (this.removeMessageCallback) {
        this.removeMessageCallback();
        this.removeMessageCallback = null;
      }
      if (this.leaveTimeout) {
        clearTimeout(this.leaveTimeout);
        this.leaveTimeout = null;
      }
      if (this.setPoisonTimeout) {
        clearTimeout(this.setPoisonTimeout);
        this.setPoisonTimeout = null;
      }
      if (this.flipTileTimeout) {
        clearTimeout(this.flipTileTimeout);
        this.flipTileTimeout = null;
      }
      closeWebSocket();
      uni.reLaunch({
        url: '/pages/index/index',
        success: () => {
          console.log('返回首页成功');
          uni.hideLoading();
        },
        fail: (err) => {
          console.error('reLaunch 失败:', err);
          uni.navigateTo({
            url: '/pages/index/index',
            success: () => console.log('navigateTo 首页成功'),
            fail: (err2) => {
              console.error('navigateTo 失败:', err2);
              uni.showToast({ title: '跳转首页失败', icon: 'error' });
            },
          });
        },
      });
    },
    getCurrentPlayerName() {
      const currentPlayer = this.players.find(p => p.id === this.clientId);
      return currentPlayer ? `${currentPlayer.name} (${currentPlayer.emoji})` : '未知玩家';
    },
    getCurrentPlayerPoisonPos() {
      const currentPlayer = this.players.find(p => p.id === this.clientId);
      return currentPlayer ? currentPlayer.poisonPos : null;
    },
  },
  onLoad(options) {
    console.log('游戏页面加载:', options);
    this.roomId = decodeURIComponent(options.roomId || '');
    this.clientId = decodeURIComponent(options.clientId || uni.getStorageSync('clientId') || '');
    if (!this.roomId) {
      console.error('房间 ID 缺失');
      uni.showToast({ title: '房间 ID 缺失', icon: 'error' });
      this.cleanupAndGoHome();
      return;
    }
    if (!this.clientId) {
      console.error('客户端 ID 缺失');
      uni.showToast({ title: '客户端 ID 缺失', icon: 'error' });
      this.cleanupAndGoHome();
      return;
    }
    uni.setStorageSync('clientId', this.clientId);
    if (options.gameState) {
      try {
        const gameState = JSON.parse(decodeURIComponent(options.gameState));
        console.log('处理初始 gameState:', gameState);
        this.updateGameState(gameState);
        if (gameState.state.players.some(p => p.id === this.clientId)) {
          this.hasJoined = true;
        }
      } catch (error) {
        console.error('解析初始 gameState 失败:', error);
        uni.showToast({ title: '游戏状态解析失败', icon: 'error' });
      }
    }
    this.init();
  },
  onReady() {
    console.log('游戏页面已准备');
  },
  onUnload() {
    console.log('游戏页面卸载');
    if (this.removeMessageCallback) {
      this.removeMessageCallback();
      this.removeMessageCallback = null;
    }
    if (this.leaveTimeout) {
      clearTimeout(this.leaveTimeout);
      this.leaveTimeout = null;
    }
    if (this.setPoisonTimeout) {
      clearTimeout(this.setPoisonTimeout);
      this.setPoisonTimeout = null;
    }
    if (this.flipTileTimeout) {
      clearTimeout(this.flipTileTimeout);
      this.flipTileTimeout = null;
    }
    closeWebSocket();
  },
  onBackPress() {
    // 拦截返回按钮，直接返回首页
    console.log('拦截返回按钮');
    this.goBackHome();
    return true; // 阻止默认返回行为
  },
};
</script>

<style>
/* 游戏主界面容器 - 清新轻松的背景色调 */
.game {
  min-height: 100vh;
  background: linear-gradient(135deg, #e8f5e8 0%, #f0f8ff 50%, #fff5f5 100%);
  padding: 30rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 房间信息卡片 - 添加阴影和圆角效果 */
.room-info {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10rpx);
  font-size: 36rpx;
  font-weight: 600;
  color: #2c3e50;
  padding: 20rpx 40rpx;
  border-radius: 25rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.1);
  letter-spacing: 2rpx;
}

/* 玩家信息容器 - 简化设计 */
.player-info {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10rpx);
  border-radius: 20rpx;
  padding: 20rpx 30rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.1);
  text-align: center;
}

/* 当前玩家显示 */
.current-player {
  font-size: 32rpx;
  font-weight: 600;
  color: #007aff;
  padding: 10rpx 20rpx;
  border-radius: 15rpx;
  background: linear-gradient(90deg, rgba(0, 122, 255, 0.1), rgba(88, 86, 214, 0.1));
  display: inline-block;
}

/* 游戏状态显示 - 更醒目的设计 */
.status {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10rpx);
  font-size: 34rpx;
  font-weight: 500;
  color: #2c3e50;
  padding: 25rpx 40rpx;
  border-radius: 20rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 6rpx 25rpx rgba(0, 0, 0, 0.1);
  text-align: center;
  min-width: 400rpx;
}

/* 操作按钮容器 */
.actions {
  margin-top: 40rpx;
  display: flex;
  gap: 25rpx;
  flex-wrap: wrap;
  justify-content: center;
}

/* 按钮统一样式 - 现代化设计 */
button {
  padding: 25rpx 50rpx;
  background: linear-gradient(135deg, #007aff, #5856d6);
  color: white;
  border-radius: 25rpx;
  font-size: 32rpx;
  font-weight: 500;
  border: none;
  box-shadow: 0 8rpx 20rpx rgba(0, 122, 255, 0.3);
  transition: all 0.3s ease;
  letter-spacing: 1rpx;
  min-width: 180rpx;
}

/* 按钮悬停效果（适用于支持的平台） */
button:hover {
  transform: translateY(-2rpx);
  box-shadow: 0 12rpx 25rpx rgba(0, 122, 255, 0.4);
}

/* 按钮禁用状态 */
button:disabled {
  background: linear-gradient(135deg, #c8c9ca, #a8a9aa);
  box-shadow: 0 4rpx 10rpx rgba(0, 0, 0, 0.1);
  transform: none;
  opacity: 0.6;
}

/* 重启按钮特殊样式 */
button:first-child {
  background: linear-gradient(135deg, #28a745, #20c997);
  box-shadow: 0 8rpx 20rpx rgba(40, 167, 69, 0.3);
}

/* 返回按钮特殊样式 */
button:last-child {
  background: linear-gradient(135deg, #6c757d, #495057);
  box-shadow: 0 8rpx 20rpx rgba(108, 117, 125, 0.3);
}
</style>