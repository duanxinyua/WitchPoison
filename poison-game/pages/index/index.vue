<template>
  <view class="index">
    <view class="title">女巫的毒药</view>
    <view class="nickname-section">
      <view v-if="nicknameSaved" class="nickname-display">
        <text>欢迎，{{ nickname }}</text>
      </view>
      <view v-else class="nickname-input">
        <input v-model="nickname" placeholder="请输入你的昵称" class="input" />
        <button @click="saveNickname">保存昵称</button>
      </view>
    </view>
    <view v-if="nicknameSaved" class="room-section">
      <view class="room-actions">
        <button :disabled="isCreating" @click="openCreateRoomModal">创建房间</button>
        <button @click="openJoinRoomModal">加入房间</button>
      </view>
    </view>

    <!-- 创建房间模态框 -->
    <view v-if="showCreateRoomModal" class="modal-overlay">
      <view class="create-form">
        <view class="form-title">创建房间</view>
        <view class="form-item">
          <text class="form-label">棋盘尺寸</text>
          <view class="number-input">
            <button @click="updateBoardSize(-1)">-</button>
            <input v-model.number="boardSize" type="number" disabled class="number-field" />
            <button @click="updateBoardSize(1)">+</button>
          </view>
        </view>
        <view class="form-item">
          <text class="form-label">玩家人数</text>
          <view class="number-input">
            <button @click="updatePlayerCount(-1)">-</button>
            <input v-model.number="playerCount" type="number" disabled class="number-field" />
            <button @click="updatePlayerCount(1)">+</button>
          </view>
        </view>
        <view class="form-actions">
          <button :disabled="isCreating" @click="createRoom">创建房间</button>
          <button @click="showCreateRoomModal = false" :disabled="isCreating">取消</button>
        </view>
      </view>
    </view>

    <!-- 加入房间模态框 -->
    <view v-if="showJoinRoomModal" class="modal-overlay">
      <view class="join-form">
        <view class="form-title">加入房间</view>
        <view class="form-item">
          <input v-model="roomId" placeholder="请输入房间ID" class="input-field" />
        </view>
        <view class="form-actions">
          <button @click="joinRoom">确定</button>
          <button @click="showJoinRoomModal = false">取消</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { connect, sendMessage, onMessage, isConnected, closeWebSocket } from '../../utils/websocket';

export default {
  data() {
    return {
      nickname: uni.getStorageSync('nickname') || '',
      nicknameSaved: !!uni.getStorageSync('nickname'),
      showCreateRoomModal: false,
      showJoinRoomModal: false,
      roomId: '',
      boardSize: 5,
      playerCount: 2,
      isCreating: false,
      clientId: '',
      removeMessageCallback: null,
      createTimeout: null,
      hasNavigated: false,
    };
  },
  methods: {
    saveNickname() {
      if (!this.nickname.trim()) {
        uni.showToast({ title: '请输入昵称', icon: 'error' });
        return;
      }
      uni.setStorageSync('nickname', this.nickname.trim());
      this.nicknameSaved = true;
      this.initWebSocket();
    },
    openCreateRoomModal() {
      console.log('打开创建房间模态框');
      this.showCreateRoomModal = true;
      this.showJoinRoomModal = false;
    },
    openJoinRoomModal() {
      console.log('打开加入房间模态框');
      this.roomId = '';
      this.showJoinRoomModal = true;
      this.showCreateRoomModal = false;
    },
    updateBoardSize(delta) {
      this.boardSize = Math.max(5, Math.min(10, this.boardSize + delta));
    },
    updatePlayerCount(delta) {
      this.playerCount = Math.max(2, Math.min(5, this.playerCount + delta));
    },
    async initWebSocket() {
      if (!this.nicknameSaved) {
        console.log('昵称未保存，跳过 WebSocket 初始化');
        return;
      }
      this.clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      uni.setStorageSync('clientId', this.clientId);
      console.log('初始化 clientId:', this.clientId);
      try {
        await connect(this.clientId);
        console.log('WebSocket 连接成功，准备注册消息回调');
        this.registerMessageHandler();
      } catch (error) {
        console.error('WebSocket 初始化失败:', error);
        uni.showToast({ title: '无法连接服务器，请稍后重试', icon: 'none' });
        uni.hideLoading();
      }
    },
    async createRoom() {
      if (this.isCreating) return;
      if (!this.clientId) {
        console.error('clientId 缺失，尝试重新初始化');
        await this.initWebSocket();
        if (!this.clientId || !isConnected()) {
          uni.showToast({ title: '无法连接服务器，请稍后重试', icon: 'error' });
          uni.hideLoading();
          return;
        }
      }
      if (this.boardSize < 5 || this.boardSize > 10) {
        uni.showToast({ title: '棋盘尺寸应为 5-10', icon: 'error' });
        return;
      }
      if (this.playerCount < 2 || this.playerCount > 5) {
        uni.showToast({ title: '玩家人数应为 2-5', icon: 'error' });
        return;
      }
      this.isCreating = true;
      uni.showLoading({ title: '创建房间中...', mask: true });

      if (!isConnected()) {
        console.log('WebSocket 未连接，尝试重新连接');
        try {
          this.clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          uni.setStorageSync('clientId', this.clientId);
          console.log('生成新 clientId:', this.clientId);
          await connect(this.clientId);
          console.log('WebSocket 重新连接成功，注册消息回调');
          if (this.removeMessageCallback) {
            this.removeMessageCallback();
          }
          this.registerMessageHandler();
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (error) {
          console.error('WebSocket 重新连接失败:', error);
          uni.hideLoading();
          uni.showToast({ title: '无法连接服务器，请重试', icon: 'error' });
          this.isCreating = false;
          this.showCreateRoomModal = false;
          return;
        }
      }

      this.createTimeout = setTimeout(() => {
        if (this.isCreating) {
          console.error('创建房间超时，未收到 gameCreated 响应');
          uni.hideLoading();
          uni.showToast({ title: '创建房间超时，请重试', icon: 'error' });
          this.isCreating = false;
          this.showCreateRoomModal = false;
        }
        this.createTimeout = null;
      }, 10000);

      try {
        const createData = {
          action: 'create',
          boardSize: this.boardSize,
          playerCount: this.playerCount,
          name: this.nickname,
          clientId: this.clientId,
        };
        console.log('准备发送创建房间请求:', createData);
        const sent = sendMessage(createData);
        if (!sent) {
          console.error('发送创建房间消息失败');
          throw new Error('发送创建房间消息失败');
        }
        console.log('发送创建房间请求:', createData);
      } catch (error) {
        console.error('创建房间失败:', error);
        clearTimeout(this.createTimeout);
        this.createTimeout = null;
        uni.hideLoading();
        uni.showToast({ title: '创建房间失败，请重试', icon: 'error' });
        this.isCreating = false;
        this.showCreateRoomModal = false;
      }
    },
    async joinRoom() {
      if (this.hasNavigated) return;
      if (!this.roomId.trim()) {
        uni.showToast({ title: '请输入房间 ID', icon: 'error' });
        return;
      }
      if (!this.clientId) {
        console.error('clientId 缺失，尝试重新初始化');
        await this.initWebSocket();
        if (!this.clientId || !isConnected()) {
          uni.showToast({ title: '无法连接服务器，请稍后重试', icon: 'error' });
          uni.hideLoading();
          return;
        }
      }
      this.hasNavigated = true;
      uni.showLoading({ title: '加入房间中...', mask: true });
      try {
        if (!isConnected()) {
          console.log('WebSocket 未连接，尝试重新连接');
          this.clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          uni.setStorageSync('clientId', this.clientId);
          console.log('生成新 clientId:', this.clientId);
          await connect(this.clientId);
          console.log('WebSocket 重新连接成功，注册消息回调');
          if (this.removeMessageCallback) {
            this.removeMessageCallback();
          }
          this.registerMessageHandler();
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        const joinData = {
          action: 'join',
          roomId: this.roomId,
          name: this.nickname,
          clientId: this.clientId,
        };
        const sent = sendMessage(joinData);
        if (!sent) {
          console.error('发送加入房间消息失败');
          throw new Error('发送加入房间消息失败');
        }
        console.log('发送加入房间请求:', joinData);
      } catch (error) {
        console.error('加入房间错误:', error);
        uni.hideLoading();
        uni.showToast({ title: '加入房间失败，请重试', icon: 'error' });
        this.showJoinRoomModal = false;
        this.hasNavigated = false;
      }
    },
    registerMessageHandler() {
      if (this.removeMessageCallback) {
        this.removeMessageCallback();
        console.log('移除旧消息回调');
      }
      this.removeMessageCallback = onMessage((data) => {
        console.log('首页收到消息:', data);
        try {
          if (!data || !data.type) {
            console.error('无效消息:', data);
            uni.showToast({ title: '无效消息', icon: 'error' });
            if (this.isCreating) {
              clearTimeout(this.createTimeout);
              this.createTimeout = null;
              uni.hideLoading();
              this.isCreating = false;
            }
            return;
          }
          if (data.type === 'connected') {
            console.log('WebSocket 连接确认:', data);
          } else if (data.type === 'pong') {
            console.log('收到心跳响应:', data);
          } else if (data.type === 'gameCreated') {
            console.log('处理 gameCreated:', { roomId: data.roomId });
            clearTimeout(this.createTimeout);
            this.createTimeout = null;
            this.roomId = data.roomId;
            this.showCreateRoomModal = false;
            if (this.isCreating) {
              uni.hideLoading();
              this.isCreating = false;
            }
            uni.showToast({ title: '房间创建成功', icon: 'success' });
            const gameState = encodeURIComponent(JSON.stringify(data));
            const targetUrl = `/pages/game/game?roomId=${encodeURIComponent(this.roomId)}&gameState=${gameState}&clientId=${encodeURIComponent(this.clientId)}&create=true`;
            console.log('准备跳转到:', targetUrl);
            uni.navigateTo({
              url: targetUrl,
              success: () => {
                console.log('导航成功');
                this.hasNavigated = true; // 仅在导航成功时设置
              },
              fail: (err) => {
                console.error('导航失败:', err);
                uni.showToast({ title: '跳转失败', icon: 'error' });
                uni.hideLoading();
                this.isCreating = false;
                this.hasNavigated = false;
              },
            });
          } else if (data.type === 'playerJoined') {
            console.log('处理 playerJoined:', { roomId: data.state?.roomId });
            const roomId = this.roomId || data.state?.roomId;
            if (!roomId) {
              console.error('playerJoined 缺少 roomId:', data);
              uni.showToast({ title: '房间 ID 无效', icon: 'error' });
              uni.hideLoading();
              return;
            }
            if (data.state?.roomId === this.roomId && data.state?.players?.some(p => p.id === this.clientId)) {
              this.showJoinRoomModal = false;
              uni.hideLoading();
              uni.showToast({ title: '加入房间成功', icon: 'success' });
              const gameState = encodeURIComponent(JSON.stringify(data));
              const targetUrl = `/pages/game/game?roomId=${encodeURIComponent(roomId)}&gameState=${gameState}&clientId=${encodeURIComponent(this.clientId)}`;
              console.log('准备跳转到:', targetUrl);
              uni.navigateTo({
                url: targetUrl,
                success: () => {
                  console.log('导航成功');
                  this.hasNavigated = true; // 仅在导航成功时设置
                },
                fail: (err) => {
                  console.error('导航失败:', err);
                  uni.showToast({ title: '跳转失败', icon: 'error' });
                  uni.hideLoading();
                  this.hasNavigated = false;
                },
              });
            } else {
              console.log('忽略无关或重复的 playerJoined 消息:', data);
              uni.hideLoading();
            }
          } else if (data.type === 'error') {
            console.error('后端错误:', data.message);
            uni.showToast({ title: data.message || '未知错误', icon: 'error' });
            if (this.isCreating) {
              clearTimeout(this.createTimeout);
              this.createTimeout = null;
              uni.hideLoading();
              this.isCreating = false;
              this.showCreateRoomModal = false;
            }
            this.showJoinRoomModal = false;
            this.hasNavigated = false;
            if (data.message === 'clientId 不匹配' || data.message === '玩家已在房间中') {
              console.warn('clientId 无效，重新初始化 WebSocket');
              closeWebSocket();
              uni.removeStorageSync('clientId');
              this.clientId = '';
              this.initWebSocket();
            }
          } else if (data.type === 'leftRoom') {
            console.log('收到 leftRoom 确认:', data);
            this.roomId = '';
            this.isCreating = false;
            this.hasNavigated = false;
            uni.removeStorageSync('clientId');
            this.clientId = '';
            uni.hideLoading();
          } else {
            console.warn('忽略游戏相关消息:', data.type);
            uni.hideLoading();
          }
        } catch (error) {
          console.error('处理消息失败:', error);
          uni.showToast({ title: '消息处理失败', icon: 'error' });
          if (this.isCreating) {
            clearTimeout(this.createTimeout);
            this.createTimeout = null;
            uni.hideLoading();
            this.isCreating = false;
            this.showCreateRoomModal = false;
          }
          this.showJoinRoomModal = false;
          this.hasNavigated = false;
        }
      });
      console.log('注册新消息回调');
    },
  },
  onLoad() {
    console.log('首页加载');
    uni.removeStorageSync('clientId');
    this.clientId = '';
    if (!this.nicknameSaved) {
      uni.showToast({ title: '请先输入昵称', icon: 'error' });
    } else {
      this.initWebSocket();
    }
  },
  onUnload() {
    console.log('首页卸载');
    if (this.removeMessageCallback) {
      this.removeMessageCallback();
      console.log('清理消息回调');
    }
    if (this.createTimeout) {
      clearTimeout(this.createTimeout);
      console.log('清理超时计时器');
    }
    if (isConnected() && this.clientId && this.roomId) {
      sendMessage({ action: 'leaveRoom', clientId: this.clientId, roomId: this.roomId });
    }
    closeWebSocket();
    uni.removeStorageSync('clientId');
    this.clientId = '';
    this.hasNavigated = false;
    console.log('清理 clientId');
  },
  onReady() {
    console.log('首页已准备');
  },
};
</script>

<style>
/* 首页主容器 - 魔法主题渐变背景 */
.index {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 40rpx 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

/* 游戏标题 - 魔法风格设计 */
.title {
  font-size: 64rpx;
  font-weight: 700;
  background: linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1, #96ceb4);
  background-size: 400% 400%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 60rpx;
  text-align: center;
  animation: gradient 3s ease infinite;
  text-shadow: 0 0 30rpx rgba(255, 255, 255, 0.3);
  letter-spacing: 4rpx;
}

/* 渐变文字动画 */
@keyframes gradient {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

/* 昵称设置区域 - 卡片式设计 */
.nickname-section {
  width: 90%;
  max-width: 500rpx;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10rpx);
  border-radius: 25rpx;
  padding: 40rpx;
  margin-bottom: 50rpx;
  box-shadow: 0 15rpx 35rpx rgba(0, 0, 0, 0.1);
  border: 1rpx solid rgba(255, 255, 255, 0.2);
}

/* 昵称显示 */
.nickname-display {
  width: 100%;
  text-align: center;
  padding: 20rpx;
}

.nickname-display text {
  font-size: 40rpx;
  font-weight: 600;
  color: #2c3e50;
  text-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.1);
}

/* 昵称输入区域 */
.nickname-input {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 25rpx;
}

/* 输入框样式优化 */
.input, .input-field {
  border: 2rpx solid rgba(0, 122, 255, 0.2);
  background: rgba(255, 255, 255, 0.9);
  padding: 25rpx 20rpx;
  border-radius: 15rpx;
  height: 90rpx;
  line-height: 90rpx;
  font-size: 32rpx;
  width: 100%;
  transition: all 0.3s ease;
  box-shadow: 0 4rpx 10rpx rgba(0, 0, 0, 0.05);
}

.input:focus, .input-field:focus {
  border-color: #007aff;
  box-shadow: 0 6rpx 20rpx rgba(0, 122, 255, 0.15);
  transform: translateY(-2rpx);
}

/* 房间操作区域 */
.room-section {
  width: 90%;
  max-width: 500rpx;
  display: flex;
  flex-direction: column;
  gap: 30rpx;
}

/* 房间操作按钮组 */
.room-actions {
  display: flex;
  gap: 25rpx;
  justify-content: center;
  flex-wrap: wrap;
}

/* 模态框背景 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(5rpx);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* 创建房间表单 */
.create-form {
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(10rpx);
  padding: 50rpx;
  border-radius: 25rpx;
  width: 90%;
  max-width: 600rpx;
  display: flex;
  flex-direction: column;
  gap: 30rpx;
  box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.2);
  border: 1rpx solid rgba(255, 255, 255, 0.3);
  animation: slideUp 0.3s ease;
}

/* 加入房间表单 */
.join-form {
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(10rpx);
  padding: 50rpx;
  border-radius: 25rpx;
  width: 90%;
  max-width: 500rpx;
  display: flex;
  flex-direction: column;
  gap: 30rpx;
  box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.2);
  border: 1rpx solid rgba(255, 255, 255, 0.3);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(50rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 表单标题 */
.form-title {
  font-size: 40rpx;
  font-weight: 600;
  text-align: center;
  margin-bottom: 20rpx;
  color: #2c3e50;
  letter-spacing: 2rpx;
}

/* 表单项 */
.form-item {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 10rpx 0;
}

/* 表单标签 */
.form-label {
  font-size: 32rpx;
  font-weight: 500;
  color: #34495e;
  width: 200rpx;
}

/* 数字输入组件 */
.number-input {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 15rpx;
  background: rgba(247, 248, 249, 0.8);
  border-radius: 15rpx;
  padding: 10rpx;
}

.number-input button {
  width: 70rpx;
  height: 70rpx;
  line-height: 70rpx;
  font-size: 28rpx;
  font-weight: 600;
  padding: 0;
  border-radius: 50%;
  background: linear-gradient(135deg, #007aff, #5856d6);
  box-shadow: 0 4rpx 10rpx rgba(0, 122, 255, 0.2);
}

/* 数字输入框 */
.number-field {
  width: 100rpx;
  height: 70rpx;
  line-height: 70rpx;
  text-align: center;
  font-size: 32rpx;
  font-weight: 600;
  border: 2rpx solid rgba(0, 122, 255, 0.2);
  border-radius: 12rpx;
  background: rgba(255, 255, 255, 0.9);
  color: #2c3e50;
}

/* 表单操作按钮 */
.form-actions {
  display: flex;
  flex-direction: row;
  justify-content: center;
  gap: 25rpx;
  margin-top: 30rpx;
}

/* 按钮统一样式优化 */
button {
  padding: 25rpx 45rpx;
  background: linear-gradient(135deg, #007aff, #5856d6);
  color: white;
  border-radius: 25rpx;
  font-size: 32rpx;
  font-weight: 500;
  border: none;
  box-shadow: 0 8rpx 20rpx rgba(0, 122, 255, 0.3);
  transition: all 0.3s ease;
  letter-spacing: 1rpx;
  min-width: 160rpx;
}

/* 按钮悬停效果 */
button:hover {
  transform: translateY(-2rpx);
  box-shadow: 0 12rpx 25rpx rgba(0, 122, 255, 0.4);
}

/* 按钮点击效果 */
button:active {
  transform: translateY(0);
  box-shadow: 0 4rpx 10rpx rgba(0, 122, 255, 0.2);
}

/* 按钮禁用状态 */
button:disabled {
  background: linear-gradient(135deg, #bdc3c7, #95a5a6);
  box-shadow: 0 4rpx 10rpx rgba(0, 0, 0, 0.1);
  transform: none;
  opacity: 0.6;
}

/* 取消按钮特殊样式 */
button:last-child {
  background: linear-gradient(135deg, #6c757d, #495057);
  box-shadow: 0 8rpx 20rpx rgba(108, 117, 125, 0.3);
}
</style>