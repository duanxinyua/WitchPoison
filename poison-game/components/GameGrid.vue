<template>
  <view class="grid">
    <view v-for="(row, rowIndex) in board" :key="`row-${rowIndex}`" class="row">
      <view
        v-for="(cell, colIndex) in row"
        :key="`cell-${rowIndex}-${colIndex}`"
        class="cell"
        :class="{ poison: cell === 'poison', disabled: cell || gameResult }"
        :data-row="rowIndex"
        :data-col="colIndex"
        @tap.stop="handleClick"
      >
        <text v-if="cell">{{ cell }}</text>
        <text v-else-if="gameStarted || !poisonSet">?</text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  props: {
    board: {
      type: Array,
      required: true,
      validator: (board) => Array.isArray(board) && board.every(row => Array.isArray(row)),
    },
    gameStarted: {
      type: Boolean,
      required: true,
    },
    poisonSet: {
      type: Boolean,
      required: true,
    },
    gameResult: {
      type: Object,
      default: null,
    },
  },
  data() {
    return {
      isMounted: true,
    };
  },
  methods: {
    handleClick(e) {
      const { row, col } = e.currentTarget.dataset;
      const rowIndex = parseInt(row);
      const colIndex = parseInt(col);
      console.log('GameGrid handleClick ����:', { row: rowIndex, col: colIndex, isMounted: this.isMounted, boardValue: this.board[rowIndex][colIndex], gameStarted: this.gameStarted, poisonSet: this.poisonSet, gameResult: this.gameResult });
      if (!this.board[rowIndex][colIndex] && !this.gameResult && this.isMounted) {
        console.log('GameGrid ���� cell-click:', { row: rowIndex, col: colIndex });
        this.$emit('cell-click', { row: rowIndex, col: colIndex });
      } else {
        console.warn('�����Ч:', { boardValue: this.board[rowIndex][colIndex], gameResult: this.gameResult, isMounted: this.isMounted });
      }
    },
  },
  watch: {
    board: {
      handler(newBoard) {
        console.log('GameGrid board ����:', JSON.parse(JSON.stringify(newBoard)));
      },
      deep: true,
    },
    gameStarted(newVal) {
      console.log('GameGrid gameStarted ����:', newVal);
    },
    poisonSet(newVal) {
      console.log('GameGrid poisonSet ����:', newVal);
    },
    gameResult(newVal) {
      console.log('GameGrid gameResult ����:', newVal);
    },
  },
  onLoad() {
    console.log('GameGrid onLoad');
  },
  onShow() {
    console.log('GameGrid onShow');
    this.isMounted = true;
  },
};
</script>

<style>
/* 游戏网格主容器 - 现代化卡片设计 */
.grid {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 25rpx;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10rpx);
  border-radius: 20rpx;
  box-shadow: 0 15rpx 35rpx rgba(0, 0, 0, 0.1);
  border: 1rpx solid rgba(255, 255, 255, 0.3);
  animation: gridAppear 0.5s ease;
}

/* 网格出现动画 */
@keyframes gridAppear {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* 网格行 */
.row {
  display: flex;
  flex-direction: row !important;
  gap: 8rpx;
  justify-content: center;
}

/* 游戏单元格 - 现代化设计和交互效果 */
.cell {
  /* 响应式尺寸计算 - 根据屏幕宽度自适应 */
  width: calc((100vw - 120rpx) / 5);
  height: calc((100vw - 120rpx) / 5);
  max-width: 120rpx;
  max-height: 120rpx;
  min-width: 80rpx;
  min-height: 80rpx;
  
  /* 外观样式 */
  border: 3rpx solid rgba(0, 122, 255, 0.2);
  border-radius: 15rpx;
  background: linear-gradient(135deg, #ffffff, #f8fbff);
  
  /* 布局和排版 */
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  
  /* 交互效果 */
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  
  /* 阴影效果 */
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05),
              inset 0 1rpx 0 rgba(255, 255, 255, 0.8);
  
  /* 文字样式 */
  font-size: 32rpx;
  font-weight: 600;
  color: #2c3e50;
}

/* 单元格悬停效果（适用于支持的平台） */
.cell:hover {
  transform: translateY(-4rpx) scale(1.05);
  border-color: #007aff;
  box-shadow: 0 8rpx 25rpx rgba(0, 122, 255, 0.15),
              inset 0 1rpx 0 rgba(255, 255, 255, 0.9);
  background: linear-gradient(135deg, #ffffff, #e3f2fd);
}

/* 单元格点击效果 */
.cell:active {
  transform: translateY(-2rpx) scale(1.02);
  transition: all 0.1s ease;
}

/* 毒药单元格 - 危险样式 */
.cell.poison {
  background: linear-gradient(135deg, #ff6b6b, #ee5a52);
  border-color: #dc3545;
  color: white;
  font-size: 36rpx;
  box-shadow: 0 6rpx 20rpx rgba(220, 53, 69, 0.3),
              inset 0 1rpx 0 rgba(255, 255, 255, 0.2);
  animation: poisonReveal 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

/* 毒药显示动画 */
@keyframes poisonReveal {
  0% {
    transform: scale(0) rotate(180deg);
    opacity: 0;
  }
  50% {
    transform: scale(1.2) rotate(90deg);
  }
  100% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
}

/* 已翻开/禁用单元格 */
.cell.disabled {
  background: linear-gradient(135deg, #f8f9fa, #e9ecef);
  border-color: #dee2e6;
  color: #6c757d;
  cursor: default;
  transform: none;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05),
              inset 0 1rpx 0 rgba(255, 255, 255, 0.8);
}

.cell.disabled:hover {
  transform: none;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05),
              inset 0 1rpx 0 rgba(255, 255, 255, 0.8);
  background: linear-gradient(135deg, #f8f9fa, #e9ecef);
  border-color: #dee2e6;
}

/* 玩家标识显示 - emoji 效果 */
.cell text {
  text-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.1);
  font-size: inherit;
  line-height: 1;
}

/* 未知单元格标识 */
.cell:not(.disabled):not(.poison) text {
  color: #6c757d;
  font-size: 28rpx;
  opacity: 0.7;
}

/* 响应式设计 - 针对不同屏幕尺寸调整 */
@media screen and (max-width: 750rpx) {
  .cell {
    width: calc((100vw - 100rpx) / 5);
    height: calc((100vw - 100rpx) / 5);
    font-size: 28rpx;
  }
  
  .cell.poison {
    font-size: 32rpx;
  }
}

@media screen and (min-width: 1200rpx) {
  .cell {
    width: 140rpx;
    height: 140rpx;
    font-size: 36rpx;
  }
  
  .cell.poison {
    font-size: 40rpx;
  }
}
</style>