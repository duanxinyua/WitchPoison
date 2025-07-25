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
          <text class="user-status">
            {{ isLoggedIn ? (userInfo && userInfo.is_guest ? '游客模式' : '微信用户') : '未登录' }}
          </text>
        </view>
        <view class="user-actions">
          <button @click="openNicknameModal" class="customize-btn">个性化</button>
          <button 
            v-if="!isLoggedIn || (userInfo && userInfo.is_guest)" 
            @click="performWechatLogin" 
            :disabled="isLoggingIn"
            class="login-btn"
          >
            {{ isLoggingIn ? '登录中...' : '微信登录' }}
          </button>
        </view>
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
          <input 
            v-model="roomId" 
            placeholder="请输入6位数字房间ID" 
            class="input-field room-id-input" 
            maxlength="8"
            type="text"
            @input="formatRoomId"
          />
          <view class="input-hint">
            <text>💡 房间ID为6位数字，如：123456</text>
          </view>
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

<!--
  首页组件 - index.vue
  创建时间: 2025-07-25
  最后修改: 2025-07-25 by Claude
  功能: 用户信息管理、房间创建和加入、WebSocket连接管理
  页面状态: 支持游客模式和个性化设置
-->

<script>
import { connect, sendMessage, onMessage, isConnected, closeWebSocket } from '../../utils/websocket';
import { autoLogin, getCurrentUser, isLoggedIn } from '../../utils/auth';
import config from '../../config/index.js';

/**
 * 生成随机昵称函数
 * 2025-07-25: 大幅扩展词库，支持多种风格和主题
 * @returns {string} 生成的随机昵称
 */
function generateRandomNickname() {
  // 性格特征形容词 (30个)
  const personalityAdjs = [
    '勇敢的', '聪明的', '幸运的', '神秘的', '敏捷的', '睿智的', '快乐的', '冷静的',
    '温柔的', '坚强的', '优雅的', '热情的', '谦逊的', '活泼的', '沉稳的', '机智的',
    '善良的', '果断的', '乐观的', '细心的', '耐心的', '诚实的', '忠诚的', '自信的',
    '慷慨的', '幽默的', '创新的', '执着的', '独立的', '包容的'
  ];
  
  // 颜色形容词 (20个)
  const colorAdjs = [
    '金色的', '银色的', '翠绿的', '深蓝的', '火红的', '雪白的', '墨黑的', '紫色的',
    '橙色的', '粉色的', '青色的', '棕色的', '灰色的', '彩虹的', '透明的', '闪亮的',
    '暗色的', '亮色的', '渐变的', '炫彩的'
  ];
  
  // 自然元素形容词 (15个)
  const natureAdjs = [
    '流水的', '山峰的', '星空的', '月光的', '阳光的', '风暴的', '雷电的', '彩云的',
    '海洋的', '森林的', '沙漠的', '冰雪的', '火焰的', '大地的', '天空的'
  ];

  // 角色职业名词 (35个)
  const professionNouns = [
    '探险者', '法师', '勇士', '游侠', '智者', '旅行者', '猎人', '学者',
    '骑士', '刺客', '弓箭手', '牧师', '炼金师', '商人', '工匠', '艺术家',
    '音乐家', '舞者', '诗人', '作家', '画家', '雕塑家', '建筑师', '发明家',
    '探索者', '收藏家', '园丁', '厨师', '裁缝', '铁匠', '木匠', '船长',
    '飞行员', '司机', '向导'
  ];
  
  // 动物名词 (25个)  
  const animalNouns = [
    '狐狸', '老虎', '狮子', '豹子', '狼', '熊', '鹰', '隼',
    '猫', '狗', '兔子', '松鼠', '海豚', '鲸鱼', '企鹅', '天鹅',
    '孔雀', '凤凰', '龙', '麒麟', '白马', '黑豹', '雪豹', '金雕', '银狼'
  ];
  
  // 自然元素名词 (20个)
  const elementNouns = [
    '星辰', '月亮', '太阳', '彩虹', '流星', '闪电', '雷霆', '烈火',
    '寒冰', '清风', '暴雪', '春雨', '秋叶', '夏花', '冬松', '山川',
    '河流', '海浪', '云朵', '露珠'
  ];
  
  // 宝石珍宝名词 (15个)
  const gemNouns = [
    '钻石', '红宝石', '蓝宝石', '绿宝石', '紫水晶', '黄玉', '珍珠', '琥珀',
    '翡翠', '玛瑙', '水晶', '黄金', '白银', '青铜', '秘银'
  ];

  // 随机选择形容词类别
  const adjCategories = [personalityAdjs, colorAdjs, natureAdjs];
  const selectedAdjCategory = adjCategories[Math.floor(Math.random() * adjCategories.length)];
  
  // 随机选择名词类别
  const nounCategories = [professionNouns, animalNouns, elementNouns, gemNouns];
  const selectedNounCategory = nounCategories[Math.floor(Math.random() * nounCategories.length)];
  
  // 2025-07-25: 简化昵称生成为经典单形容词+单名词组合
  const randomAdj = selectedAdjCategory[Math.floor(Math.random() * selectedAdjCategory.length)];
  const randomNoun = selectedNounCategory[Math.floor(Math.random() * selectedNounCategory.length)];
  return `${randomAdj}${randomNoun}`;
}

export default {
  data() {
    // 2025-07-25: 初始化用户数据，支持游客模式和个性化设置
    // 从本地存储获取用户信息
    let nickname = uni.getStorageSync('nickname');
    let userAvatar = uni.getStorageSync('userAvatar');
    let isFirstTime = false;
    
    // 检查是否手动设置过昵称 - 用于区分游客模式和已设置模式
    const manuallySet = uni.getStorageSync('manuallySetNickname') === 'true';
    
    // 2025-07-25: 自动生成游客昵称 - 大幅扩展词库，增加昵称多样性
    if (!nickname) {
      nickname = generateRandomNickname();
      uni.setStorageSync('nickname', nickname);
      isFirstTime = true;
    }
    
    // 2025-07-25: 设置默认头像 - 如果没有头像，设置默认头像并保存
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
      // 2025-07-25: 添加用户登录状态管理
      isLoggedIn: false,
      userToken: null,
      userInfo: null,
      isLoggingIn: false
    };
  },
  methods: {
    /**
     * 格式化房间ID输入
     * 2025-07-25: 限制输入格式，只允许数字和大写字母
     * @param {Event} e - 输入事件
     */
    formatRoomId(e) {
      let value = e.detail.value;
      // 转换为大写并只保留数字和字母
      value = value.toUpperCase().replace(/[^0-9A-Z]/g, '');
      // 更新输入值
      this.$set(this, 'roomId', value);
    },
    /**
     * 生成游客昵称 - 2025-07-25: 使用扩展的词库生成昵称
     * @returns {string} 生成的随机昵称
     */
    generateGuestNickname() {
      return generateRandomNickname();
    },
    
    /**
     * 生成唯一的客户端ID
     * 2025-07-25: 修复clientId重复问题，确保每次生成的ID都是唯一的
     * @returns {string} 唯一的客户端ID
     */
    generateUniqueClientId() {
      // 2025-07-25: 增强clientId唯一性 - 添加毫秒级时间戳和更长随机字符串
      const timestamp = Date.now();
      const microTimestamp = performance.now().toString().replace('.', ''); // 添加高精度时间戳
      const randomStr1 = Math.random().toString(36).substr(2, 8); // 第一个随机字符串
      const randomStr2 = Math.random().toString(36).substr(2, 8); // 第二个随机字符串
      const deviceInfo = wx.getSystemInfoSync?.() || {};
      const rawDeviceId = deviceInfo.brand || deviceInfo.model || deviceInfo.platform || 'unknown';
      
      // 2025-07-25: 确保设备ID只包含URL安全字符 - 移除所有特殊字符
      const deviceId = rawDeviceId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'unknown';
      
      // 组合生成唯一ID，确保格式统一和高度唯一性
      const clientId = `client_${timestamp}_${microTimestamp}_${randomStr1}_${randomStr2}_${deviceId}`;
      
      console.log('生成唯一clientId:', {
        timestamp,
        microTimestamp,
        randomStr1,
        randomStr2,
        rawDeviceId,
        cleanDeviceId: deviceId,
        finalId: clientId,
        length: clientId.length
      });
      
      return clientId;
    },
    openNicknameModal() {
      this.$set(this, 'tempNickname', this.nickname);
      this.$set(this, 'showNicknameModal', true);
    },
    closeNicknameModal() {
      this.$set(this, 'showNicknameModal', false);
      this.$set(this, 'tempNickname', '');
    },
    async saveCustomization() {
      if (!this.tempNickname.trim()) {
        uni.showToast({ title: '请输入昵称', icon: 'error' });
        return;
      }
      
      // 保存昵称和头像到本地
      uni.setStorageSync('nickname', this.tempNickname.trim());
      uni.setStorageSync('userAvatar', this.userAvatar); // 确保头像也被保存
      uni.setStorageSync('manuallySetNickname', 'true'); // 标记为手动设置
      this.$set(this, 'nickname', this.tempNickname.trim());
      this.$set(this, 'nicknameSaved', true);
      this.$set(this, 'isFirstTime', false);
      
      // 如果用户已登录微信，同步个性化信息到数据库
      if (this.isLoggedIn && !this.userInfo?.is_guest) {
        try {
          console.log('[Auth] 同步个性化信息到数据库');
          await this.syncCustomizationToDatabase();
        } catch (error) {
          console.error('[Auth] 同步个性化信息失败:', error);
          // 即使同步失败也不影响本地保存
        }
      }
      
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
      
      // 2025-07-25: 检查现有WebSocket连接是否可用
      if (isConnected() && this.clientId) {
        console.log('检测到有效的WebSocket连接，直接使用:', {
          clientId: this.clientId,
          readyState: socketTask?.readyState
        });
        this.registerMessageHandler();
        return;
      }
      
      // 2025-07-25: 优化clientId生成 - 检查是否已有有效的clientId
      const existingClientId = uni.getStorageSync('clientId');
      const now = Date.now();
      const isValidClientId = existingClientId && 
                             existingClientId.length > 0 && 
                             existingClientId.startsWith('client_') &&
                             existingClientId.split('_').length >= 6; // 2025-07-25: 更新验证规则，匹配新的ID格式
                             
      // 检查clientId是否过期（超过24小时强制更新）
      const clientIdExpired = existingClientId && existingClientId.includes('_') && 
                              (now - parseInt(existingClientId.split('_')[1]) > 24 * 60 * 60 * 1000);
      
      // 2025-07-25: 优化clientId复用逻辑 - 减少重复生成，增强稳定性
      if (isValidClientId && !clientIdExpired) {
        this.clientId = existingClientId;
        console.log('使用已存在的有效 clientId:', {
          clientId: this.clientId,
          age: Math.round((now - parseInt(existingClientId.split('_')[1])) / 1000 / 60), // 分钟
          parts: existingClientId.split('_').length
        });
      } else {
        if (clientIdExpired) {
          console.log('clientId已过期，生成新的:', { 
            old: existingClientId,
            ageHours: Math.round((now - parseInt(existingClientId.split('_')[1])) / 1000 / 60 / 60)
          });
        } else if (!isValidClientId) {
          console.log('无效的clientId格式，生成新的:', {
            old: existingClientId,
            length: existingClientId?.length,
            hasPrefix: existingClientId?.startsWith('client_'),
            partCount: existingClientId?.split('_').length
          });
        }
        
        // 生成新的clientId并立即保存，避免并发问题
        this.clientId = this.generateUniqueClientId();
        uni.setStorageSync('clientId', this.clientId);
        console.log('生成并保存新的 clientId:', this.clientId);
      }
      try {
        await connect(this.clientId);
        console.log('WebSocket 连接成功，准备注册消息回调');
        this.registerMessageHandler();
      } catch (error) {
        console.error('WebSocket 初始化失败:', error);
        
        // 2025-07-25: 优化错误处理 - 区分不同类型的错误
        if (error.message && error.message.includes('exceed max task count')) {
          console.warn('超出微信Socket连接数限制，稍后重试');
          uni.showToast({ 
            title: '连接数超限，请稍后再试', 
            icon: 'none',
            duration: 2000
          });
          // 延迟重试，等待其他连接释放
          setTimeout(() => {
            this.initWebSocket();
          }, 3000 + Math.random() * 2000);
        } else {
          uni.showToast({ title: '无法连接服务器，请稍后重试', icon: 'none' });
        }
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
          // 2025-07-25: 使用统一的clientId生成方法
          const newClientId = this.generateUniqueClientId();
          uni.setStorageSync('clientId', newClientId);
          console.log('生成新 clientId:', newClientId);
          await connect(newClientId);
          // 2025-07-25: 连接成功后更新实例变量，确保消息发送时使用正确的clientId
          this.clientId = newClientId;
          console.log('WebSocket 重新连接成功，更新clientId:', this.clientId);
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
          avatarEmoji: this.userAvatar, // 2025-07-25: 传递用户头像
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
    /**
     * 加入房间方法
     * 2025-07-25: 添加房间ID格式验证，支持6位数字或8位UUID格式
     */
    async joinRoom() {
      if (this.hasNavigated) return;
      
      // 2025-07-25: 房间ID基础验证
      const roomIdTrimmed = this.roomId.trim();
      if (!roomIdTrimmed) {
        uni.showToast({ title: '请输入房间 ID', icon: 'error' });
        return;
      }
      
      // 2025-07-25: 房间ID格式验证 - 支持6位数字或8位UUID格式
      const roomIdPattern = /^(\d{6}|[A-Z0-9]{8})$/;
      if (!roomIdPattern.test(roomIdTrimmed)) {
        uni.showToast({ 
          title: '房间ID格式错误\n请输入6位数字', 
          icon: 'none',
          duration: 2500 
        });
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
          // 2025-07-25: 使用统一的clientId生成方法
          const newClientId = this.generateUniqueClientId();
          uni.setStorageSync('clientId', newClientId);
          console.log('生成新 clientId:', newClientId);
          await connect(newClientId);
          // 2025-07-25: 连接成功后更新实例变量，确保消息发送时使用正确的clientId
          this.clientId = newClientId;
          console.log('WebSocket 重新连接成功，更新clientId:', this.clientId);
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
          avatarEmoji: this.userAvatar, // 2025-07-25: 传递用户头像
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
              console.warn('clientId 冲突，延迟后重新尝试:', {
                message: data.message,
                currentClientId: this.clientId,
                timestamp: Date.now()
              });
              
              // 2025-07-25: 优化clientId冲突处理 - 先关闭连接再重新生成ID
              closeWebSocket();
              setTimeout(async () => {
                // 只有冲突时才清理clientId并重新生成
                uni.removeStorageSync('clientId');
                this.clientId = '';
                console.log('冲突后重新初始化WebSocket，生成新ID');
                await this.initWebSocket();
              }, 2000 + Math.random() * 1000); // 随机延迟2-3秒，避免并发
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
    
    /**
     * 同步个性化信息到数据库
     * 2025-07-25: 将用户自定义的昵称和头像同步到数据库
     */
    async syncCustomizationToDatabase() {
      if (!this.userToken || !this.userInfo) {
        console.warn('[Auth] 无用户令牌或信息，跳过数据库同步');
        return;
      }
      
      try {
        const response = await new Promise((resolve, reject) => {
          wx.request({
            url: `${config.apiUrl}/api/auth/update-custom-info`,
            method: 'POST',
            data: {
              nickname: this.nickname,
              avatarEmoji: this.userAvatar
            },
            header: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.userToken}`
            },
            success: (res) => {
              if (res.statusCode === 200) {
                resolve(res.data);
              } else {
                reject(new Error(`同步失败: ${res.statusCode}`));
              }
            },
            fail: (err) => {
              reject(new Error('网络请求失败: ' + err.errMsg));
            }
          });
        });
        
        if (response.success) {
          console.log('[Auth] 个性化信息已同步到数据库');
          // 更新本地用户信息
          if (this.userInfo) {
            this.userInfo.nickname = this.nickname;
            this.userInfo.avatar_emoji = this.userAvatar;
            uni.setStorageSync('userInfo', this.userInfo);
          }
        } else {
          throw new Error(response.message || '同步失败');
        }
      } catch (error) {
        console.error('[Auth] 同步个性化信息到数据库失败:', error);
        throw error;
      }
    },
    /**
     * 执行自动登录
     * 2025-07-25: 检查本地会话，尝试自动登录或使用游客模式
     */
    async performAutoLogin() {
      this.isLoggingIn = true;
      
      try {
        console.log('[Auth] 开始自动登录流程');
        
        // 检查是否已有有效会话
        const currentUser = getCurrentUser();
        if (currentUser) {
          console.log('[Auth] 发现本地会话，用户:', currentUser.user.nickname);
          this.setUserData(currentUser);
          return;
        }
        
        // 尝试自动登录
        const loginResult = await autoLogin();
        if (loginResult && loginResult.success) {
          console.log('[Auth] 自动登录成功:', loginResult.user.nickname);
          this.setUserData(loginResult);
        } else {
          console.warn('[Auth] 自动登录失败，保持游客模式');
        }
        
      } catch (error) {
        console.error('[Auth] 自动登录出错:', error);
        // 登录失败不影响游戏继续，保持游客模式
      } finally {
        this.isLoggingIn = false;
      }
    },
    
    /**
     * 设置用户数据
     * 2025-07-25: 统一设置用户登录状态和信息
     */
    setUserData(loginData) {
      this.isLoggedIn = true;
      this.userToken = loginData.token;
      this.userInfo = loginData.user;
      
      // 如果是正式用户，更新昵称和头像
      if (!loginData.user.is_guest) {
        // 检查本地是否有自定义设置
        const localNickname = uni.getStorageSync('nickname');
        const localAvatar = uni.getStorageSync('userAvatar');  
        const hasLocalCustomization = uni.getStorageSync('manuallySetNickname') === 'true';
        
        // 如果本地有自定义设置，优先使用本地的；否则使用服务器返回的
        if (hasLocalCustomization && localNickname && localAvatar) {
          this.nickname = localNickname;
          this.userAvatar = localAvatar;
          console.log('[Auth] 保持本地自定义信息:', { nickname: this.nickname, avatar: this.userAvatar });
          
          // 如果本地信息与服务器不同，同步到服务器
          if (this.nickname !== loginData.user.nickname || this.userAvatar !== loginData.user.avatar_emoji) {
            console.log('[Auth] 本地自定义信息与服务器不同，准备同步');
            setTimeout(async () => {
              try {
                await this.syncCustomizationToDatabase();
              } catch (error) {
                console.error('[Auth] 同步本地自定义信息到服务器失败:', error);
              }
            }, 1000); // 延迟1秒执行，确保登录流程完成
          }
        } else {
          // 使用服务器返回的信息，并保存到本地
          this.nickname = loginData.user.nickname;
          this.userAvatar = loginData.user.avatar_emoji;
          uni.setStorageSync('nickname', this.nickname);
          uni.setStorageSync('userAvatar', this.userAvatar);
          console.log('[Auth] 使用服务器返回信息:', { nickname: this.nickname, avatar: this.userAvatar });
        }
        
        this.nicknameSaved = true;
        uni.setStorageSync('manuallySetNickname', 'true');
      }
      
      console.log('[Auth] 用户数据设置完成:', {
        isGuest: loginData.user.is_guest,
        nickname: this.nickname,
        avatar: this.userAvatar
      });
    },
    
    /**
     * 手动微信登录
     * 2025-07-25: 用户点击登录按钮时调用
     */
    async performWechatLogin() {
      this.isLoggingIn = true;
      
      try {
        uni.showLoading({ title: '正在登录...' });
        
        const authModule = await import('../../utils/auth');
        const loginResult = await authModule.wxLogin();
        
        if (loginResult && loginResult.success) {
          this.setUserData(loginResult);
          uni.showToast({
            title: '登录成功！',
            icon: 'success'
          });
          
          // 登录成功后，如果有本地自定义信息，同步到数据库
          const hasLocalCustomization = uni.getStorageSync('manuallySetNickname') === 'true';
          if (hasLocalCustomization) {
            setTimeout(async () => {
              try {
                await this.syncCustomizationToDatabase();
                console.log('[Auth] 微信登录后同步本地自定义信息成功');
              } catch (error) {
                console.error('[Auth] 微信登录后同步本地自定义信息失败:', error);
              }
            }, 2000); // 延迟2秒执行，确保登录流程完成
          }
        } else {
          throw new Error('登录失败');
        }
        
      } catch (error) {
        console.error('[Auth] 微信登录失败:', error);
        uni.showToast({
          title: '登录失败，继续游客模式',
          icon: 'none'
        });
      } finally {
        uni.hideLoading();
        this.isLoggingIn = false;
      }
    },
  },
  async onLoad() {
    console.log('首页加载');
    uni.removeStorageSync('clientId');
    this.clientId = '';
    
    // 2025-07-25: 尝试自动登录
    await this.performAutoLogin();
    
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
    
    // 2025-07-25: 优化页面卸载逻辑 - 保留clientId和WebSocket连接以便复用
    if (isConnected() && this.clientId && this.roomId) {
      sendMessage({ action: 'leaveRoom', clientId: this.clientId, roomId: this.roomId });
    }
    
    // 不关闭WebSocket连接，保留给下次使用
    // closeWebSocket(); // 注释掉，避免关闭连接
    
    // 不清理clientId，保留给下次使用
    // uni.removeStorageSync('clientId'); // 注释掉，保留clientId
    // this.clientId = ''; // 注释掉，保留clientId
    
    this.hasNavigated = false;
    console.log('页面卸载完成，保留WebSocket连接和clientId以便复用');
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

/* 2025-07-25: 用户操作按钮区域 */
.user-actions {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  align-items: flex-end;
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

/* 2025-07-25: 微信登录按钮样式 */
.login-btn {
  background: linear-gradient(135deg, #07c160, #06a554);
  color: white;
  border: none;
  border-radius: 15rpx;
  padding: 10rpx 18rpx;
  font-size: 22rpx;
  font-weight: 500;
  box-shadow: 0 4rpx 10rpx rgba(7, 193, 96, 0.3);
  transition: all 0.3s ease;
  min-width: 80rpx;
  flex-shrink: 0;
}

.login-btn:disabled {
  background: linear-gradient(135deg, #a8a9aa, #8c8c8c);
  box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.1);
  opacity: 0.6;
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-2rpx);
  box-shadow: 0 8rpx 20rpx rgba(7, 193, 96, 0.4);
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

/* 房间ID输入框样式 - 2025-07-25: 添加房间ID输入的特殊样式 */
.room-id-input {
  text-align: center;
  font-size: 36rpx;
  font-weight: 600;
  letter-spacing: 4rpx;
  color: #2c3e50;
  background: rgba(255, 255, 255, 0.98);
  border: 3rpx solid rgba(0, 122, 255, 0.3);
}

.room-id-input:focus {
  border-color: #007aff;
  box-shadow: 0 0 0 4rpx rgba(0, 122, 255, 0.1);
  transform: translateY(-2rpx);
}

/* 输入提示样式 */
.input-hint {
  margin-top: 15rpx;
  text-align: center;
  padding: 10rpx 15rpx;
  background: rgba(46, 204, 113, 0.1);
  border-radius: 12rpx;
  border: 1rpx solid rgba(46, 204, 113, 0.2);
}

.input-hint text {
  font-size: 24rpx;
  color: #27ae60;
  line-height: 1.4;
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