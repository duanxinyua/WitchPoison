<template>
  <view class="avatar-page">
    <view class="header">
      <text class="title">选择头像</text>
      <text class="subtitle">选择你喜欢的头像</text>
    </view>
    
    <view class="avatar-grid">
      <view 
        v-for="(emoji, index) in avatarList" 
        :key="index"
        class="avatar-item"
        :class="{ selected: selectedAvatar === emoji }"
        @click="selectAvatar(emoji)"
      >
        <text class="emoji">{{ emoji }}</text>
      </view>
    </view>
    
    <view class="actions">
      <button class="confirm-btn" @click="confirmSelection" :disabled="!selectedAvatar">
        确认选择
      </button>
    </view>
  </view>
</template>

<script>
export default {
  name: 'AvatarPage',
  data() {
    return {
      selectedAvatar: '',
      avatarList: [
        '😺', '🐶', '🐰', '🦅', '🐘', '🐸', '🦊', '🐯', '🐨', '🐼',
        '🦁', '🐮', '🐷', '🐙', '🦋', '🐝', '🦄', '🐳', '🐬', '🐢',
        '🌸', '🌺', '🌻', '🌷', '🌹', '🌼', '🌵', '🌲', '🌳', '🍀'
      ]
    };
  },
  onLoad() {
    // 获取当前已选择的头像
    const currentAvatar = uni.getStorageSync('userAvatar');
    if (currentAvatar) {
      this.selectedAvatar = currentAvatar;
    }
  },
  methods: {
    selectAvatar(emoji) {
      this.selectedAvatar = emoji;
    },
    confirmSelection() {
      if (!this.selectedAvatar) {
        uni.showToast({
          title: '请选择一个头像',
          icon: 'none'
        });
        return;
      }
      
      // 保存选择的头像到本地存储
      uni.setStorageSync('userAvatar', this.selectedAvatar);
      
      uni.showToast({
        title: '头像设置成功',
        icon: 'success'
      });
      
      // 延迟返回上一页
      setTimeout(() => {
        uni.navigateBack({
          delta: 1
        });
      }, 1000);
    }
  }
};
</script>

<style>
.avatar-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #e8f5e8 0%, #f0f8ff 50%, #fff5f5 100%);
  padding: 30rpx;
}

.header {
  text-align: center;
  margin-bottom: 40rpx;
}

.title {
  font-size: 48rpx;
  font-weight: 700;
  color: #2c3e50;
  display: block;
  margin-bottom: 10rpx;
}

.subtitle {
  font-size: 28rpx;
  color: #6c757d;
  display: block;
}

.avatar-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 20rpx;
  margin-bottom: 60rpx;
}

.avatar-item {
  width: 120rpx;
  height: 120rpx;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10rpx);
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3rpx solid transparent;
  transition: all 0.3s ease;
  cursor: pointer;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}

.avatar-item:hover {
  transform: translateY(-4rpx) scale(1.05);
  box-shadow: 0 8rpx 25rpx rgba(0, 122, 255, 0.15);
}

.avatar-item.selected {
  border-color: #007aff;
  background: linear-gradient(135deg, rgba(0, 122, 255, 0.1), rgba(88, 86, 214, 0.1));
  transform: translateY(-2rpx) scale(1.02);
  box-shadow: 0 8rpx 25rpx rgba(0, 122, 255, 0.3);
}

.emoji {
  font-size: 64rpx;
  line-height: 1;
}

.actions {
  text-align: center;
  padding: 20rpx;
}

.confirm-btn {
  background: linear-gradient(135deg, #007aff, #5856d6);
  color: white;
  border: none;
  border-radius: 25rpx;
  padding: 25rpx 80rpx;
  font-size: 32rpx;
  font-weight: 500;
  box-shadow: 0 8rpx 20rpx rgba(0, 122, 255, 0.3);
  transition: all 0.3s ease;
  letter-spacing: 2rpx;
}

.confirm-btn:hover {
  transform: translateY(-2rpx);
  box-shadow: 0 12rpx 25rpx rgba(0, 122, 255, 0.4);
}

.confirm-btn:disabled {
  background: linear-gradient(135deg, #c8c9ca, #a8a9aa);
  box-shadow: 0 4rpx 10rpx rgba(0, 0, 0, 0.1);
  transform: none;
  opacity: 0.6;
}

/* 响应式设计 */
@media screen and (max-width: 750rpx) {
  .avatar-grid {
    grid-template-columns: repeat(4, 1fr);
    gap: 15rpx;
  }
  
  .avatar-item {
    width: 100rpx;
    height: 100rpx;
  }
  
  .emoji {
    font-size: 50rpx;
  }
}

@media screen and (min-width: 1200rpx) {
  .avatar-grid {
    grid-template-columns: repeat(6, 1fr);
    gap: 25rpx;
  }
  
  .avatar-item {
    width: 140rpx;
    height: 140rpx;
  }
  
  .emoji {
    font-size: 80rpx;
  }
}
</style>