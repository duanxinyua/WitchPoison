<template>
  <view class="index">
    <view class="title">女巫的毒药</view>
    <view class="user-section">
      <view class="user-info">
        <view class="user-details">
          <view class="user-name-row">
            <text class="user-name">{{ nickname }}</text>
            <text class="user-avatar">{{ userAvatar }}</text>
          </view>
          <text class="user-status">{{ nicknameSaved ? '已设置昵称' : '游客模式' }}</text>
        </view>
        <button @click="openNicknameModal" class="customize-btn">个性化</button>
      </view>
    </view>
    <view class="room-section">
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
            <input :value="boardSize" type="number" disabled class="number-field" />
            <button @click="updateBoardSize(1)">+</button>
          </view>
        </view>
        <view class="form-item">
          <text class="form-label">玩家人数</text>
          <view class="number-input">
            <button @click="updatePlayerCount(-1)">-</button>
            <input :value="playerCount" type="number" disabled class="number-field" />
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
          <button @click="closeJoinRoomModal">取消</button>
        </view>
      </view>
    </view>

    <!-- 个性化设置模态框 -->
    <view v-if="showNicknameModal" class="modal-overlay">
      <view class="customize-form">
        <view class="form-title">个性化设置</view>
        <view class="form-item">
          <text class="form-label">昵称</text>
          <input v-model="tempNickname" placeholder="请输入你的昵称" class="input-field" />
        </view>
        <view class="form-item">
          <text class="form-label">头像</text>
          <view class="avatar-selector">
            <text class="current-avatar">{{ userAvatar }}</text>
            <button @click="goToAvatarPage" class="avatar-btn">选择头像</button>
          </view>
        </view>
        <view class="form-actions">
          <button @click="saveCustomization">保存设置</button>
          <button @click="closeNicknameModal">跳过</button>
        </view>
        <view class="form-tip">
          <text>💡 您可以先体验游戏，稍后再设置个性化信息</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { connect, sendMessage, onMessage, isConnected, closeWebSocket } from '../../utils/websocket';

export default {
  data() {
    // 初始化默认昵称和头像，确保第一次使用时就保存到本地
    let nickname = uni.getStorageSync('nickname');
    let userAvatar = uni.getStorageSync('userAvatar');
    let isFirstTime = false;
    
    // 检查是否手动设置过昵称
    const manuallySet = uni.getStorageSync('manuallySetNickname') === 'true';
    
    // 如果没有昵称，生成默认昵称并保存
    if (!nickname) {
      const adjectives = ['勇敢的', '聪明的', '幸运的', '神秘的', '敏捷的', '睿智的', '快乐的', '冷静的'];
      const nouns = ['探险者', '法师', '勇士', '游侠', '智者', '旅行者', '猎人', '学者'];
      const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
      const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
      const randomNum = Math.floor(Math.random() * 999) + 1;
      nickname = `${randomAdj}${randomNoun}${randomNum}`;
      uni.setStorageSync('nickname', nickname);
      isFirstTime = true;
    }
    
    // 如果没有头像，设置默认头像并保存
    if (!userAvatar) {
      userAvatar = '😺';
      uni.setStorageSync('userAvatar', userAvatar);
      isFirstTime = true;
    }
    
    return {
      nickname: nickname,
      nicknameSaved: manuallySet, // 根据是否手动设置过来标记
      userAvatar: userAvatar,
      showCreateRoomModal: false,
      showJoinRoomModal: false,
      showNicknameModal: false,
      roomId: '',
      boardSize: 5,
      playerCount: 2,
      isCreating: false,
      clientId: '',
      removeMessageCallback: null,
      createTimeout: null,
      hasNavigated: false,
      tempNickname: '', // 临时昵称输入
      isFirstTime: isFirstTime, // 标记是否首次使用
    };
  },
  methods: {
    generateGuestNickname() {
      const adjectives = ['勇敢的', '聪明的', '幸运的', '神秘的', '敏捷的', '睿智的', '快乐的', '冷静的'];
      const nouns = ['探险者', '法师', '勇士', '游侠', '智者', '旅行者', '猎人', '学者'];
      const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
      const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
      const randomNum = Math.floor(Math.random() * 999) + 1;
      return `${randomAdj}${randomNoun}${randomNum}`;
    },
    openNicknameModal() {
      this.$set(this, 'tempNickname', this.nickname);
      this.$set(this, 'showNicknameModal', true);
    },
    closeNicknameModal() {
      this.$set(this, 'showNicknameModal', false);
      this.$set(this, 'tempNickname', '');
    },
    saveCustomization() {
      if (!this.tempNickname.trim()) {
        uni.showToast({ title: '请输入昵称', icon: 'error' });
        return;
      }
      
      // 保存昵称和头像
      uni.setStorageSync('nickname', this.tempNickname.trim());
      uni.setStorageSync('userAvatar', this.userAvatar); // 确保头像也被保存
      uni.setStorageSync('manuallySetNickname', 'true'); // 标记为手动设置
      this.$set(this, 'nickname', this.tempNickname.trim());
      this.$set(this, 'nicknameSaved', true);
      this.$set(this, 'isFirstTime', false);
      
      // 关闭模态框
      this.closeNicknameModal();
      uni.showToast({ title: '个性化设置已保存', icon: 'success' });
      
      // 初始化WebSocket连接
      if (!this.clientId) {
        this.initWebSocket();
      }
    },
    saveNickname() {
      if (!this.nickname.trim()) {
        uni.showToast({ title: '请输入昵称', icon: 'error' });
        return;
      }
      uni.setStorageSync('nickname', this.nickname.trim());
      this.nicknameSaved = true;
      
      // 检查是否已选择头像，如果没有则提示选择
      if (!this.userAvatar || this.userAvatar === '😺') {
        uni.showModal({
          title: '选择头像',
          content: '请选择一个头像作为你的游戏形象',
          confirmText: '去选择',
          cancelText: '使用默认',
          success: (res) => {
            if (res.confirm) {
              this.goToAvatarPage();
            } else {
              uni.setStorageSync('userAvatar', '😺');
              this.userAvatar = '😺';
              this.initWebSocket();
            }
          }
        });
      } else {
        this.initWebSocket();
      }
    },
    goToAvatarPage() {
      console.log('跳转到头像页面');
      uni.navigateTo({
        url: '/pages/avatar/avatar',
        success: () => {
          console.log('跳转头像页面成功');
        },
        fail: (err) => {
          console.error('跳转头像页面失败:', err);
          uni.showToast({ title: '跳转失败，请重试', icon: 'error' });
        }
      });
    },
    editNickname() {
      this.nicknameSaved = false;
      this.nickname = '';
      uni.removeStorageSync('nickname');
    },
    openCreateRoomModal() {
      console.log('打开创建房间模态框');
      this.$set(this, 'showCreateRoomModal', true);
      this.$set(this, 'showJoinRoomModal', false);
    },
    openJoinRoomModal() {
      console.log('打开加入房间模态框');
      this.$set(this, 'roomId', '');
      this.$set(this, 'showJoinRoomModal', true);
      this.$set(this, 'showCreateRoomModal', false);
    },
    closeJoinRoomModal() {
      this.$set(this, 'showJoinRoomModal', false);
      this.$set(this, 'roomId', '');
    },
    updateBoardSize(delta) {
      const newSize = Math.max(5, Math.min(10, this.boardSize + delta));
      this.$set(this, 'boardSize', newSize);
      console.log('更新棋盘尺寸:', newSize);
    },
    updatePlayerCount(delta) {
      const newCount = Math.max(2, Math.min(5, this.playerCount + delta));
      this.$set(this, 'playerCount', newCount);
      console.log('更新玩家人数:', newCount);
    },
    async initWebSocket() {
      // 移除昵称检查，支持游客模式
      console.log('初始化 WebSocket 连接，当前昵称:', this.nickname);
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
      console.log('开始创建房间，当前状态:', {
        isCreating: this.isCreating,
        boardSize: this.boardSize,
        playerCount: this.playerCount,
        clientId: this.clientId
      });
      
      if (this.isCreating) {
        console.log('房间正在创建中，忽略重复请求');
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
      
      // 验证参数
      const boardSize = Number(this.boardSize) || 5;
      const playerCount = Number(this.playerCount) || 2;
      
      if (boardSize < 5 || boardSize > 10) {
        uni.showToast({ title: '棋盘尺寸应为 5-10', icon: 'error' });
        return;
      }
      if (playerCount < 2 || playerCount > 5) {
        uni.showToast({ title: '玩家人数应为 2-5', icon: 'error' });
        return;
      }
      
      this.$set(this, 'isCreating', true);
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
          boardSize: boardSize,
          playerCount: playerCount,
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
        if (this.createTimeout) {
          clearTimeout(this.createTimeout);
          this.createTimeout = null;
        }
        uni.hideLoading();
        uni.showToast({ title: '创建房间失败，请重试', icon: 'error' });
        this.$set(this, 'isCreating', false);
        this.$set(this, 'showCreateRoomModal', false);
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
            if (this.createTimeout) {
              clearTimeout(this.createTimeout);
              this.createTimeout = null;
            }
            this.$set(this, 'roomId', data.roomId);
            this.$set(this, 'showCreateRoomModal', false);
            if (this.isCreating) {
              uni.hideLoading();
              this.$set(this, 'isCreating', false);
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
              if (this.createTimeout) {
                clearTimeout(this.createTimeout);
                this.createTimeout = null;
              }
              uni.hideLoading();
              this.$set(this, 'isCreating', false);
              this.$set(this, 'showCreateRoomModal', false);
            }
            this.$set(this, 'showJoinRoomModal', false);
            this.$set(this, 'hasNavigated', false);
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
    
    // 如果是第一次使用，显示欢迎提示
    if (this.isFirstTime) {
      console.log('首次使用，已自动设置默认昵称和头像:', { nickname: this.nickname, avatar: this.userAvatar });
      setTimeout(() => {
        uni.showToast({ 
          title: '欢迎体验游戏！已为您设置默认信息', 
          icon: 'success',
          duration: 3000
        });
      }, 500);
    } else {
      console.log('用户信息已存在:', { nickname: this.nickname, avatar: this.userAvatar, nicknameSaved: this.nicknameSaved });
    }
    
    // 直接初始化WebSocket连接，无论是否设置了昵称
    this.initWebSocket();
  },
  onShow() {
    // 页面显示时更新头像（可能在头像选择页面更改了）
    const storedAvatar = uni.getStorageSync('userAvatar');
    if (storedAvatar && storedAvatar !== this.userAvatar) {
      this.$set(this, 'userAvatar', storedAvatar);
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
/* 首页主容器 - 清新轻松的背景色调 */
.index {
  min-height: 100vh;
  background: linear-gradient(135deg, #e3f2fd 0%, #f1f8e9 50%, #fff3e0 100%);
  padding: 40rpx 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

/* 游戏标题 - 清新活泼的设计 */
.title {
  font-size: 64rpx;
  font-weight: 700;
  background: linear-gradient(45deg, #42a5f5, #26c6da, #66bb6a, #ffa726);
  background-size: 400% 400%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 60rpx;
  text-align: center;
  animation: gradient 3s ease infinite;
  text-shadow: 0 0 20rpx rgba(255, 255, 255, 0.5);
  letter-spacing: 4rpx;
}

/* 渐变文字动画 */
@keyframes gradient {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

/* 用户信息区域 - 现代化设计 */
.user-section {
  width: 90%;
  max-width: 500rpx;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10rpx);
  border-radius: 25rpx;
  padding: 30rpx;
  margin-bottom: 40rpx;
  box-shadow: 0 15rpx 35rpx rgba(0, 0, 0, 0.1);
  border: 1rpx solid rgba(255, 255, 255, 0.2);
}

.user-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.user-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.user-name-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
}

.user-name {
  font-size: 36rpx;
  font-weight: 600;
  color: #2c3e50;
  text-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.1);
  text-align: center;
}

.user-avatar {
  font-size: 48rpx;
  line-height: 1;
}

.user-status {
  font-size: 22rpx;
  color: #7f8c8d;
  background: rgba(52, 152, 219, 0.1);
  padding: 4rpx 12rpx;
  border-radius: 12rpx;
  text-align: center;
}

.customize-btn {
  background: linear-gradient(135deg, #3498db, #2980b9);
  color: white;
  border: none;
  border-radius: 15rpx;
  padding: 12rpx 20rpx;
  font-size: 24rpx;
  font-weight: 500;
  box-shadow: 0 4rpx 10rpx rgba(52, 152, 219, 0.3);
  transition: all 0.3s ease;
  min-width: 80rpx;
  flex-shrink: 0;
}

.edit-btn {
  background: linear-gradient(135deg, #42a5f5, #26c6da);
  color: white;
  border: none;
  border-radius: 20rpx;
  padding: 15rpx 30rpx;
  font-size: 26rpx;
  font-weight: 500;
  box-shadow: 0 4rpx 12rpx rgba(66, 165, 245, 0.3);
  transition: all 0.3s ease;
}

.edit-btn:hover {
  transform: translateY(-2rpx);
  box-shadow: 0 6rpx 15rpx rgba(66, 165, 245, 0.4);
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

/* 数字输入组件 - 优化布局和按钮样式 */
.number-input {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 20rpx;
  background: rgba(247, 248, 249, 0.9);
  border-radius: 18rpx;
  padding: 15rpx 20rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
  border: 1rpx solid rgba(0, 122, 255, 0.1);
}

/* 数字加减按钮 - 修复显示和交互问题 */
.number-input button {
  /* 尺寸和布局 */
  width: 60rpx !important;
  height: 60rpx !important;
  min-width: 60rpx;
  min-height: 60rpx;
  
  /* 文字样式 */
  font-size: 32rpx !important;
  font-weight: 700 !important;
  line-height: 1 !important;
  color: white !important;
  
  /* 重置默认样式 */
  padding: 0 !important;
  margin: 0;
  border: none !important;
  outline: none;
  
  /* 外观样式 */
  border-radius: 50% !important;
  background: linear-gradient(135deg, #007aff, #5856d6) !important;
  box-shadow: 0 4rpx 12rpx rgba(0, 122, 255, 0.25) !important;
  
  /* 布局居中 */
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  
  /* 过渡效果 */
  transition: all 0.2s ease !important;
  cursor: pointer;
}

/* 数字按钮悬停效果 */
.number-input button:hover {
  transform: translateY(-2rpx) scale(1.05) !important;
  box-shadow: 0 6rpx 16rpx rgba(0, 122, 255, 0.35) !important;
}

/* 数字按钮点击效果 */
.number-input button:active {
  transform: translateY(0) scale(0.95) !important;
  box-shadow: 0 2rpx 8rpx rgba(0, 122, 255, 0.2) !important;
}

/* 数字输入框 - 优化样式与按钮协调 */
.number-field {
  width: 80rpx !important;
  height: 60rpx !important;
  line-height: 60rpx !important;
  text-align: center !important;
  font-size: 32rpx !important;
  font-weight: 600 !important;
  border: 2rpx solid rgba(0, 122, 255, 0.3) !important;
  border-radius: 12rpx !important;
  background: rgba(255, 255, 255, 0.95) !important;
  color: #2c3e50 !important;
  
  /* 重置默认样式 */
  padding: 0 !important;
  margin: 0;
  outline: none;
  box-sizing: border-box;
  
  /* 过渡效果 */
  transition: all 0.2s ease;
  box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.05);
}

/* 数字输入框焦点效果 */
.number-field:focus {
  border-color: #007aff !important;
  box-shadow: 0 4rpx 12rpx rgba(0, 122, 255, 0.15) !important;
}

/* 表单操作按钮 */
.form-actions {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 25rpx;
  margin-top: 20rpx;
  width: 100%;
}

/* 个性化设置表单按钮优化 */
.customize-form .form-actions {
  margin-top: 25rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid rgba(0, 0, 0, 0.06);
}

.customize-form .form-actions button {
  flex: 1;
  max-width: 180rpx;
  min-height: 80rpx;
  font-size: 30rpx;
  font-weight: 600;
  border-radius: 20rpx;
  padding: 22rpx 25rpx;
  display: flex;
  align-items: center;
  justify-content: center;
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

/* 个性化设置表单 */
.customize-form {
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(10rpx);
  padding: 40rpx;
  border-radius: 25rpx;
  width: 90%;
  max-width: 650rpx;
  display: flex;
  flex-direction: column;
  gap: 25rpx;
  box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.2);
  border: 1rpx solid rgba(255, 255, 255, 0.3);
  animation: slideUp 0.3s ease;
  margin: 0 auto;
}

/* 表单标题优化 */
.customize-form .form-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #2c3e50;
  text-align: center;
  margin-bottom: 15rpx;
  padding-bottom: 15rpx;
  border-bottom: 2rpx solid rgba(0, 122, 255, 0.1);
}

/* 表单项优化 */
.customize-form .form-item {
  display: flex;
  flex-direction: column;
  gap: 15rpx;
  align-items: stretch;
}

.customize-form .form-label {
  font-size: 30rpx;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 8rpx;
  text-align: left;
}

.customize-form .input-field {
  width: 100%;
  min-height: 80rpx;
  padding: 20rpx;
  background: rgba(255, 255, 255, 0.95);
  border: 2rpx solid rgba(0, 122, 255, 0.2);
  border-radius: 15rpx;
  font-size: 30rpx;
  color: #2c3e50;
  box-sizing: border-box;
  transition: all 0.3s ease;
}

.customize-form .input-field:focus {
  border-color: #007aff;
  box-shadow: 0 0 0 3rpx rgba(0, 122, 255, 0.1);
  outline: none;
}

/* 头像选择器 */
.avatar-selector {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 15rpx 20rpx;
  background: rgba(248, 249, 250, 0.9);
  border-radius: 15rpx;
  border: 2rpx solid rgba(0, 122, 255, 0.1);
}

.current-avatar {
  font-size: 48rpx;
  padding: 12rpx 16rpx;
  background: rgba(52, 152, 219, 0.1);
  border-radius: 12rpx;
  border: 2rpx solid rgba(52, 152, 219, 0.2);
  min-width: 80rpx;
  text-align: center;
  flex-shrink: 0;
}

.avatar-btn {
  background: linear-gradient(135deg, #e74c3c, #c0392b);
  color: white;
  border: none;
  border-radius: 15rpx;
  padding: 18rpx 30rpx;
  font-size: 28rpx;
  font-weight: 500;
  box-shadow: 0 4rpx 12rpx rgba(231, 76, 60, 0.3);
  transition: all 0.3s ease;
  flex-shrink: 0;
  min-width: 120rpx;
}

.avatar-btn:hover {
  transform: translateY(-2rpx);
  box-shadow: 0 6rpx 15rpx rgba(231, 76, 60, 0.4);
}

/* 提示文本 */
.form-tip {
  text-align: center;
  padding: 20rpx;
  background: rgba(46, 204, 113, 0.1);
  border-radius: 15rpx;
  border: 1rpx solid rgba(46, 204, 113, 0.2);
}

.form-tip text {
  font-size: 26rpx;
  color: #27ae60;
  line-height: 1.5;
}

/* 个性化按钮悬停效果 */
.customize-btn:hover {
  transform: translateY(-2rpx);
  box-shadow: 0 8rpx 20rpx rgba(52, 152, 219, 0.4);
}

/* 响应式设计优化 */
@media screen and (max-width: 750rpx) {
  .user-section {
    width: 95%;
    padding: 25rpx;
  }
  
  .user-name {
    font-size: 32rpx;
  }
  
  .user-avatar {
    font-size: 40rpx;
  }
  
  .customize-btn {
    padding: 10rpx 16rpx;
    font-size: 22rpx;
    min-width: 70rpx;
  }
  
  .customize-form {
    width: 95%;
    padding: 30rpx;
    max-width: none;
  }
  
  .customize-form .form-actions {
    flex-direction: column;
    gap: 15rpx;
  }
  
  .customize-form .form-actions button {
    width: 100%;
    max-width: none;
    min-height: 90rpx;
  }
  
  .avatar-selector {
    flex-direction: column;
    align-items: center;
    gap: 15rpx;
    padding: 20rpx;
  }
  
  .current-avatar {
    margin-bottom: 10rpx;
  }
  
  .avatar-btn {
    width: 100%;
    text-align: center;
    justify-content: center;
  }
}

@media screen and (min-width: 1200rpx) {
  .customize-form {
    max-width: 700rpx;
    padding: 50rpx;
  }
  
  .avatar-selector {
    padding: 20rpx 30rpx;
  }
  
  .customize-form .form-actions button {
    min-height: 85rpx;
    font-size: 32rpx;
  }
}
</style>