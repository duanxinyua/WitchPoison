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
import { ref, reactive, nextTick, onMounted, onUnmounted } from 'vue';
import { connect, sendMessage, onMessage, isConnected, closeWebSocket } from '../../utils/websocket';
import GameGrid from '../../components/GameGrid.vue';

export default {
  components: {
    GameGrid,
  },
  setup() {
    // 响应式数据
    const roomId = ref('');
    const clientId = ref('');
    const board = ref([]);
    const players = ref([]);
    const currentPlayer = ref(null);
    const gameStarted = ref(false);
    const status = ref('waiting');
    const playerCount = ref(0);
    const boardSize = ref(5);
    const gameResult = ref(null);
    const removeMessageCallback = ref(null);
    const leaveTimeout = ref(null);
    const isRestarting = ref(false);
    const isSettingPoison = ref(false);
    const restartRequested = ref(false);
    const restartCount = ref(0);
    const isFlipping = ref(false);
    const setPoisonTimeout = ref(null);
    const flipTileTimeout = ref(null);
    const hasJoined = ref(false);

    // 方法
    const init = async () => {
      clientId.value = uni.getStorageSync('clientId');
      console.log('game.vue clientId:', clientId.value);
      if (!clientId.value) {
        console.error('客户端 ID 缺失');
        uni.showToast({ title: '客户端 ID 缺失', icon: 'error' });
        cleanupAndGoHome();
        return;
      }
      // 初始化空棋盘时不要强制创建，等待从服务器获取正确的尺寸
      if (!board.value.length && boardSize.value > 0) {
        board.value = Array(boardSize.value).fill().map(() => Array(boardSize.value).fill(null));
        console.log('初始化空棋盘:', { boardSize: boardSize.value, board: board.value });
      }
      if (hasJoined.value || players.value.some(p => p.id === clientId.value)) {
        console.log('玩家已加入房间，跳过 join 请求:', { clientId: clientId.value, roomId: roomId.value });
        registerMessageHandler();
        return;
      }
      if (!isConnected()) {
        try {
          await connect(clientId.value);
          console.log('WebSocket 连接成功');
          await new Promise(resolve => setTimeout(resolve, 2000));
          registerMessageHandler();
          sendJoinMessage();
        } catch (error) {
          console.error('WebSocket 初始化失败:', error);
          uni.showToast({ title: '无法连接服务器，请稍后重试', icon: 'none' });
          uni.hideLoading();
          cleanupAndGoHome();
        }
      } else {
        console.log('WebSocket 已连接');
        registerMessageHandler();
        sendJoinMessage();
      }
    };

    const sendJoinMessage = () => {
      const joinMessage = { action: 'join', roomId: roomId.value, clientId: clientId.value, name: uni.getStorageSync('nickname') || `Player${Date.now()}` };
      const sent = sendMessage(joinMessage);
      if (sent) {
        console.log('发送加入房间请求:', joinMessage);
        uni.showLoading({ title: '加入房间中...' });
        hasJoined.value = true;
      } else {
        console.error('发送加入房间请求失败:', joinMessage);
        uni.showToast({ title: '网络未连接，加入失败', icon: 'error' });
        uni.hideLoading();
        cleanupAndGoHome();
      }
    };

    const registerMessageHandler = () => {
      if (removeMessageCallback.value) {
        removeMessageCallback.value();
        console.log('移除旧消息回调');
      }
      removeMessageCallback.value = onMessage((data) => {
        console.log('游戏页面收到消息:', data);
        try {
          if (!data || !data.type) {
            console.error('无效消息:', data);
            uni.showToast({ title: '无效消息', icon: 'error' });
            uni.hideLoading();
            return;
          }
          if (data.type === 'gameCreated') {
            roomId.value = data.roomId;
            uni.hideLoading();
            uni.showToast({ title: '房间创建成功', icon: 'success' });
            updateGameState(data);
          } else if (data.type === 'playerJoined') {
            console.log('处理 playerJoined，检查是否需要重置游戏状态:', {
              status: data.state.status,
              gameStarted: data.state.gameStarted,
              playersCount: data.state.players?.length,
              currentBoard: board.value?.length
            });
            
            // 如果状态回到 waiting，确保完全重置游戏状态
            if (data.state.status === 'waiting' && status.value !== 'waiting') {
              console.log('状态从', status.value, '变为 waiting，强制重置游戏状态');
              // 重置所有游戏相关状态
              gameResult.value = null;
              isFlipping.value = false;
              isSettingPoison.value = false;
              restartRequested.value = false;
              restartCount.value = 0;
            }
            
            updateGameState(data);
            uni.showToast({ title: '玩家加入房间', icon: 'success' });
            uni.hideLoading();
            if (data.state.status === 'settingPoison') {
              console.log('进入设置毒药阶段');
            }
          } else if (data.type === 'gameStarted') {
            gameStarted.value = true;
            isFlipping.value = false;
            updateGameState(data);
            uni.showToast({ title: '游戏开始！', icon: 'success' });
            uni.hideLoading();
          } else if (data.type === 'poisonSet') {
            isSettingPoison.value = false;
            if (setPoisonTimeout.value) {
              clearTimeout(setPoisonTimeout.value);
              setPoisonTimeout.value = null;
            }
            updateGameState(data);
            uni.hideLoading();
            uni.showToast({ title: data.success ? '毒药设置成功' : (data.message || '毒药设置失败'), icon: data.success ? 'success' : 'error' });
          } else if (data.type === 'tileFlipped') {
            isFlipping.value = false;
            if (flipTileTimeout.value) {
              clearTimeout(flipTileTimeout.value);
              flipTileTimeout.value = null;
            }
            console.log('收到 tileFlipped 消息，更新 board:', JSON.parse(JSON.stringify(data.state.board)));
            updateGameState(data);
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
            restartCount.value = data.restartCount || 0;
            status.value = 'waitingForRestart';
            uni.showToast({ title: `等待其他玩家同意重启 (${data.restartCount}/${playerCount.value})`, icon: 'none' });
            uni.hideLoading();
          } else if (data.type === 'gameRestarted') {
            console.log('收到 gameRestarted 消息，开始重置游戏状态:', data);
            isRestarting.value = false;
            restartRequested.value = false;
            restartCount.value = 0;
            isFlipping.value = false;
            isSettingPoison.value = false;
            gameResult.value = null; // 重置 gameResult
            hasJoined.value = true;
            
            // 首先从消息中获取正确的棋盘尺寸
            const correctBoardSize = data.state.boardSize || data.boardSize || boardSize.value;
            if (correctBoardSize !== boardSize.value) {
              console.log('gameRestarted: 更新棋盘尺寸:', boardSize.value, '->', correctBoardSize);
              boardSize.value = correctBoardSize;
            }
            
            // 强制重置棋盘为空，使用正确的尺寸
            console.log('重置前棋盘状态:', { size: board.value.length, board: JSON.parse(JSON.stringify(board.value)) });
            board.value = Array(correctBoardSize).fill().map(() => Array(correctBoardSize).fill(null));
            console.log('重置后棋盘状态:', { size: correctBoardSize, board: JSON.parse(JSON.stringify(board.value)) });
            
            updateGameState(data);
            uni.hideLoading();
            uni.showToast({ title: '游戏已重启', icon: 'success' });
            nextTick(() => {
              console.log('强制刷新 UI 后状态:', { 
                status: status.value, 
                board: JSON.parse(JSON.stringify(board.value)),
                players: players.value.map(p => ({ id: p.id, name: p.name, poisonPos: p.poisonPos, isOut: p.isOut }))
              });
            });
          } else if (data.type === 'playerLeft') {
            updateGameState(data);
            uni.showToast({ title: '玩家已离开房间', icon: 'none' });
            uni.hideLoading();
          } else if (data.type === 'leftRoom') {
            uni.hideLoading();
            if (leaveTimeout.value) {
              clearTimeout(leaveTimeout.value);
              leaveTimeout.value = null;
            }
            console.log('收到 leftRoom 响应:', data);
            cleanupAndGoHome();
          } else if (data.type === 'pong') {
            console.log('收到心跳响应:', data);
          } else if (data.type === 'error') {
            console.error('后端错误:', data.message);
            uni.showToast({ title: data.message || '服务器错误', icon: 'error' });
            uni.hideLoading();
            isRestarting.value = false;
            restartRequested.value = false;
            isSettingPoison.value = false;
            isFlipping.value = false;
            if (setPoisonTimeout.value) {
              clearTimeout(setPoisonTimeout.value);
              setPoisonTimeout.value = null;
            }
            if (flipTileTimeout.value) {
              clearTimeout(flipTileTimeout.value);
              flipTileTimeout.value = null;
            }
            if (data.message === '玩家已在房间中') {
              console.log('玩家已加入，跳过重复 join:', { clientId: clientId.value });
              hasJoined.value = true;
            }
          } else {
            console.warn('未处理的消息类型:', data.type);
            uni.hideLoading();
          }
        } catch (error) {
          console.error('处理游戏消息失败:', error);
          uni.showToast({ title: '消息处理失败', icon: 'error' });
          uni.hideLoading();
          isFlipping.value = false;
          isSettingPoison.value = false;
          if (setPoisonTimeout.value) {
            clearTimeout(setPoisonTimeout.value);
            setPoisonTimeout.value = null;
          }
          if (flipTileTimeout.value) {
            clearTimeout(flipTileTimeout.value);
            flipTileTimeout.value = null;
          }
        }
      });
      console.log('注册新消息回调');
    };

    const updateGameState = (data) => {
      console.log('更新游戏状态，收到数据:', data);
      if (!data || !data.state) {
        console.error('状态数据缺失:', data);
        uni.showToast({ title: '状态数据缺失', icon: 'error' });
        uni.hideLoading();
        return;
      }
      // 首先更新 boardSize，这样后续的棋盘创建会使用正确的尺寸
      const newBoardSize = data.state.boardSize || data.boardSize || boardSize.value;
      if (newBoardSize !== boardSize.value) {
        console.log('更新棋盘尺寸:', boardSize.value, '->', newBoardSize);
        boardSize.value = newBoardSize;
      }
      
      // 强制重置棋盘：只在重启和等待状态时清空棋盘，设置毒药阶段保持棋盘状态
      const shouldResetBoard = data.type === 'gameRestarted' || 
                              data.state.status === 'waiting';
      
      const newBoard = shouldResetBoard 
        ? Array(newBoardSize).fill().map(() => Array(newBoardSize).fill(null))
        : (Array.isArray(data.state.board) && data.state.board.every(row => Array.isArray(row))
            ? JSON.parse(JSON.stringify(data.state.board))
            : Array(newBoardSize).fill().map(() => Array(newBoardSize).fill(null)));
      board.value = newBoard;
      // 强制重置玩家状态：只在重启和等待状态下重置，设置毒药阶段需要保留玩家的毒药位置
      const shouldResetPlayerStates = data.type === 'gameRestarted' || 
                                     data.state.status === 'waiting';
      
      players.value = Array.isArray(data.state.players) ? data.state.players.map(p => ({
        ...p,
        id: p.clientId || p.id,
        poisonPos: shouldResetPlayerStates ? null : (p.poisonPos || null),
        isOut: shouldResetPlayerStates ? false : (p.isOut || false)
      })) : [];
      const currentPlayerIndex = data.state.currentPlayerIndex >= 0 ? data.state.currentPlayerIndex : 0;
      currentPlayer.value = players.value[currentPlayerIndex] || null;
      gameStarted.value = data.state.gameStarted || false;
      status.value = data.state.status || 'waiting';
      playerCount.value = data.state.playerCount || data.playerCount || players.value.length;
      if (data.gameResult) {
        gameResult.value = data.gameResult;
      } else if (data.type === 'gameRestarted') {
        gameResult.value = null; // 确保重置
      }
      console.log('状态更新后:', {
        updateType: data.type,
        status: status.value,
        gameStarted: gameStarted.value,
        shouldResetBoard: shouldResetBoard,
        shouldResetPlayerStates: shouldResetPlayerStates,
        players: players.value.map(p => ({ id: p.id, name: p.name, poisonPos: p.poisonPos, isOut: p.isOut })),
        playerCount: playerCount.value,
        boardRows: board.value.length,
        boardCols: board.value.length ? board.value[0].length : 0,
        currentPlayer: currentPlayer.value?.id,
        currentPlayerName: currentPlayer.value?.name,
        clientId: clientId.value,
        board: JSON.parse(JSON.stringify(board.value)),
        gameResult: gameResult.value
      });
      nextTick(() => {
        // Vue 3 不需要 $forceUpdate，响应式系统会自动更新
      });
    };

    const handleCellClick = ({ row, col }) => {
      console.log('game.vue 收到 cell-click:', { row, col, status: status.value, currentPlayer: currentPlayer.value?.id, isSettingPoison: isSettingPoison.value });
      if (isFlipping.value || isSettingPoison.value) {
        console.log('操作进行中，忽略重复点击', { isFlipping: isFlipping.value, isSettingPoison: isSettingPoison.value });
        return;
      }
      if (!isConnected()) {
        console.error('WebSocket 未连接，无法发送请求');
        uni.showToast({ title: '网络未连接，请检查网络', icon: 'error' });
        return;
      }
      if (status.value === 'settingPoison') {
        const player = players.value.find(p => p.id === clientId.value);
        if (!player) {
          console.error('玩家未找到:', { clientId: clientId.value, players: players.value });
          uni.showToast({ title: '玩家未找到', icon: 'error' });
          return;
        }
        if (player.poisonPos) {
          console.log('玩家已设置毒药:', { clientId: clientId.value });
          uni.showToast({ title: '你已设置毒药', icon: 'none' });
          return;
        }
        isSettingPoison.value = true;
        const message = { action: 'setPoison', roomId: roomId.value, x: row, y: col, clientId: clientId.value };
        const sent = sendMessage(message);
        if (sent) {
          console.log('发送设置毒药请求:', message);
          uni.showLoading({ title: '设置毒药中...' });
          setPoisonTimeout.value = setTimeout(() => {
            console.error('设置毒药超时，未收到响应');
            uni.hideLoading();
            uni.showToast({ title: '设置毒药超时，请重试', icon: 'error' });
            isSettingPoison.value = false;
            setPoisonTimeout.value = null;
          }, 5000);
        } else {
          console.error('发送设置毒药失败:', message);
          uni.showToast({ title: '网络未连接，设置失败', icon: 'error' });
          uni.hideLoading();
          isSettingPoison.value = false;
        }
      } else if (status.value === 'playing' && currentPlayer.value && currentPlayer.value.id === clientId.value) {
        const currentPlayerData = players.value.find(p => p.id === clientId.value);
        console.log('翻转格子前玩家状态检查:', {
          clientId: clientId.value,
          currentPlayer: currentPlayer.value,
          currentPlayerData: currentPlayerData,
          isMyTurn: currentPlayer.value?.id === clientId.value,
          playerIsOut: currentPlayerData?.isOut,
          status: status.value
        });
        isFlipping.value = true;
        const message = { action: 'flipTile', roomId: roomId.value, x: row, y: col, clientId: clientId.value };
        const sent = sendMessage(message);
        if (sent) {
          console.log('发送翻转格子请求:', message);
          uni.showLoading({ title: '翻转格子中...' });
          flipTileTimeout.value = setTimeout(() => {
            console.error('翻转格子超时，未收到响应');
            uni.hideLoading();
            uni.showToast({ title: '翻转格子超时，请重试', icon: 'error' });
            isFlipping.value = false;
            flipTileTimeout.value = null;
          }, 5000);
        } else {
          console.error('发送翻转格子失败:', message);
          uni.showToast({ title: '网络未连接，请检查网络', icon: 'error' });
          uni.hideLoading();
          isFlipping.value = false;
        }
      } else {
        console.log('无效操作', { status: status.value, currentPlayerId: currentPlayer.value?.id, clientId: clientId.value });
        uni.showToast({ title: '当前无法操作，请等待你的回合', icon: 'none' });
      }
    };

    const restartGame = () => {
      if (isRestarting.value || restartRequested.value) {
        console.log('重启操作进行中，忽略重复点击');
        return;
      }
      if (!isConnected()) {
        console.error('WebSocket 未连接，无法发送重启请求');
        uni.showToast({ title: '网络未连接，请检查网络', icon: 'error' });
        return;
      }
      isRestarting.value = true;
      restartRequested.value = true;
      const message = { action: 'restart', roomId: roomId.value, clientId: clientId.value };
      const sent = sendMessage(message);
      if (sent) {
        console.log('发送重启请求:', message);
        uni.showLoading({ title: '请求重启中...' });
      } else {
        console.error('发送重启请求失败:', message);
        uni.showToast({ title: '网络未连接，无法重启', icon: 'error' });
        uni.hideLoading();
        isRestarting.value = false;
        restartRequested.value = false;
      }
    };

    const goBackHome = () => {
      console.log('触发返回首页');
      if (!isConnected()) {
        console.warn('WebSocket 未连接，直接返回首页');
        cleanupAndGoHome();
        return;
      }
      const message = { action: 'leaveRoom', roomId: roomId.value, clientId: clientId.value };
      const sent = sendMessage(message);
      if (!sent) {
        console.warn('发送退出房间消息失败，直接返回首页');
        cleanupAndGoHome();
        return;
      }
      console.log('发送退出房间请求:', message);
      uni.showLoading({ title: '正在退出房间...' });
      leaveTimeout.value = setTimeout(() => {
        console.warn('退出房间超时，直接返回首页');
        uni.hideLoading();
        cleanupAndGoHome();
      }, 2000);
    };

    const cleanupAndGoHome = () => {
      console.log('清理资源并返回首页');
      if (removeMessageCallback.value) {
        removeMessageCallback.value();
        removeMessageCallback.value = null;
      }
      if (leaveTimeout.value) {
        clearTimeout(leaveTimeout.value);
        leaveTimeout.value = null;
      }
      if (setPoisonTimeout.value) {
        clearTimeout(setPoisonTimeout.value);
        setPoisonTimeout.value = null;
      }
      if (flipTileTimeout.value) {
        clearTimeout(flipTileTimeout.value);
        flipTileTimeout.value = null;
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
    };

    const getCurrentPlayerName = () => {
      const player = players.value.find(p => p.id === clientId.value);
      return player ? `${player.name} (${player.emoji})` : '未知玩家';
    };

    const getCurrentPlayerPoisonPos = () => {
      const player = players.value.find(p => p.id === clientId.value);
      return player ? player.poisonPos : null;
    };

    // 返回给模板使用的数据和方法
    return {
      roomId,
      clientId,
      board,
      players,
      currentPlayer,
      gameStarted,
      status,
      playerCount,
      boardSize,
      gameResult,
      restartRequested,
      restartCount,
      hasJoined,
      handleCellClick,
      restartGame,
      goBackHome,
      getCurrentPlayerName,
      getCurrentPlayerPoisonPos,
      init,
      updateGameState,
      cleanupAndGoHome
    };
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
    this.cleanupAndGoHome();
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