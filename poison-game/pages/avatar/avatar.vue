<template>
  <view class="avatar-page">
    <view class="header">
      <text class="title">选择头像</text>
      <text class="subtitle">选择你喜欢的头像</text>
    </view>
    
    <view class="avatar-container">
      <view class="avatar-row" v-for="(row, rowIndex) in avatarRows" :key="rowIndex">
        <view 
          v-for="(emoji, colIndex) in row" 
          :key="colIndex"
          class="avatar-item"
          :class="{ selected: selectedAvatar === emoji }"
          @click="selectAvatar(emoji)"
        >
          <text class="emoji">{{ emoji }}</text>
        </view>
      </view>
    </view>
    
  </view>
</template>

<script>
import { ref, computed } from 'vue'

export default {
  name: 'AvatarPage',
  setup() {
    // 响应式数据
    const selectedAvatar = ref('')
    const avatarList = ref([
      '😺', '🐶', '🐰', '🦅', '🐘', '🐸', '🦊', '🐯', '🐨', '🐼',
      '🦁', '🐮', '🐷', '🐙', '🦋', '🐝', '🦄', '🐳', '🐬', '🐢',
      '🌸', '🌺', '🌻', '🌷', '🌹', '🌼', '🌵', '🌲', '🌳', '🍀'
    ])
    
    // 将头像列表分组为行，每行5个
    const avatarRows = computed(() => {
      const rows = []
      for (let i = 0; i < avatarList.value.length; i += 5) {
        rows.push(avatarList.value.slice(i, i + 5))
      }
      return rows
    })

    // 方法
    const selectAvatar = (emoji) => {
      console.log('选择头像:', emoji)
      selectedAvatar.value = emoji
      
      // 保存选择的头像到临时存储，用于个性化弹窗预览
      try {
        uni.setStorageSync('tempSelectedAvatar', emoji)
        console.log('临时头像保存成功:', emoji)
        
        uni.showToast({
          title: '头像已选择',
          icon: 'success',
          duration: 1000
        })
        
        // 直接返回上一页，不延迟
        uni.navigateBack({
          delta: 1
        })
      } catch (error) {
        console.error('保存头像失败:', error)
        uni.showToast({
          title: '保存失败，请重试',
          icon: 'error'
        })
      }
    }


    // 初始化方法
    const initAvatar = () => {
      // 获取当前已选择的头像
      const currentAvatar = uni.getStorageSync('userAvatar')
      if (currentAvatar) {
        selectedAvatar.value = currentAvatar
      }
    }

    // 返回模板需要的数据和方法
    return {
      selectedAvatar,
      avatarList,
      avatarRows,
      selectAvatar,
      initAvatar
    }
  },
  onLoad() {
    // 调用初始化方法
    this.initAvatar()
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

.avatar-container {
  margin-bottom: 60rpx;
  padding: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.avatar-row {
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  align-items: center;
  width: 100%;
}

.avatar-item {
  width: 120rpx;
  height: 120rpx;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3rpx solid transparent;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}


.avatar-item.selected {
  border-color: #007aff;
  background: linear-gradient(135deg, rgba(0, 122, 255, 0.1), rgba(88, 86, 214, 0.1));
  transform: translateY(-2rpx) scale(1.02);
  box-shadow: 0 8rpx 25rpx rgba(0, 122, 255, 0.3);
}

.emoji {
  font-size: 64rpx;
}


</style>