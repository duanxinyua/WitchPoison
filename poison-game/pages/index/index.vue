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
.index {
  padding: 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.title {
  font-size: 48rpx;
  margin-bottom: 40rpx;
}
.nickname-section {
  width: 80%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 60rpx;
}
.nickname-display {
  width: 100%;
  text-align: center;
}
.nickname-display text {
  font-size: 36rpx;
  color: #333;
}
.nickname-input {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.input {
  border: 2rpx solid #ccc;
  padding: 20rpx;
  border-radius: 10rpx;
  height: 80rpx;
  line-height: 80rpx;
  font-size: 32rpx;
  width: 100%;
}
.input-field {
  border: 2rpx solid #ccc;
  padding: 20rpx;
  border-radius: 10rpx;
  height: 80rpx;
  line-height: 80rpx;
  font-size: 32rpx;
  width: 100%;
}
.room-section {
  width: 80%;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.room-actions {
  display: flex;
  gap: 20rpx;
  justify-content: center;
}
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.create-form {
  background-color: #fff;
  padding: 40rpx;
  border-radius: 20rpx;
  width: 600rpx;
  display: flex;
  flex-direction: column;
  gap: 30rpx;
}
.join-form {
  background-color: #fff;
  padding: 40rpx;
  border-radius: 20rpx;
  width: 500rpx;
  display: flex;
  flex-direction: column;
  gap: 30rpx;
}
.form-title {
  font-size: 36rpx;
  text-align: center;
  margin-bottom: 20rpx;
}
.form-item {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  width: 100%;
}
.form-label {
  font-size: 32rpx;
  color: #333;
  width: 200rpx;
}
.number-input {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10rpx;
}
.number-input button {
  width: 80rpx;
  height: 80rpx;
  line-height: 80rpx;
  font-size: 32rpx;
  padding: 0;
}
.number-field {
  width: 100rpx;
  height: 80rpx;
  line-height: 80rpx;
  text-align: center;
  font-size: 32rpx;
  border: 2rpx solid #ccc;
  border-radius: 10rpx;
}
.form-actions {
  display: flex;
  flex-direction: row;
  justify-content: center;
  gap: 20rpx;
  margin-top: 20rpx;
}
button {
  padding: 20rpx 40rpx;
  background-color: #007aff;
  color: white;
  border-radius: 10rpx;
  font-size: 32rpx;
}
button:disabled {
  background-color: #ccc;
}
</style>