<template>
  <view class="grid" :style="{ '--board-size': boardSize }">
    <view v-for="(row, rowIndex) in board" :key="`row-${rowIndex}`" class="row">
      <view
        v-for="(cell, colIndex) in row"
        :key="`cell-${rowIndex}-${colIndex}`"
        class="cell"
        :class="{ 
          poison: cell === 'poison', 
          disabled: cell || gameResult,
          'poison-hint': showPoisonHint(rowIndex, colIndex)
        }"
        :data-row="rowIndex"
        :data-col="colIndex"
        @tap.stop="handleClick"
      >
        <text v-if="cell === 'poison'">💀</text>
        <text v-else-if="cell">{{ cell }}</text>
        <text v-else-if="showPoisonHint(rowIndex, colIndex)">💀</text>
        <text v-else></text>
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
    currentPlayerPoison: {
      type: Object,
      default: null,
    },
    status: {
      type: String,
      default: 'waiting',
    },
  },
  computed: {
    boardSize() {
      return this.board.length || 5;
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
    showPoisonHint(row, col) {
      // 只在设置毒药阶段显示自己的毒药位置
      if (this.status === 'settingPoison' && this.currentPlayerPoison) {
        return this.currentPlayerPoison.x === row && this.currentPlayerPoison.y === col;
      }
      return false;
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
  gap: calc(8rpx - var(--board-size, 5) * 0.5rpx); /* 棋盘越大，间距越小 */
  padding: calc(20rpx - var(--board-size, 5) * 1rpx); /* 棋盘越大，padding越小 */
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10rpx);
  border-radius: 20rpx;
  box-shadow: 0 15rpx 35rpx rgba(0, 0, 0, 0.1);
  border: 1rpx solid rgba(255, 255, 255, 0.3);
  animation: gridAppear 0.5s ease;
  width: 100%;
  max-width: calc(100vw - 60rpx);
  overflow: hidden;
  margin: 0 auto;
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
  gap: calc(8rpx - var(--board-size, 5) * 0.5rpx); /* 棋盘越大，间距越小 */
  justify-content: center;
}

/* 游戏单元格 - 现代化设计和交互效果 */
.cell {
  /* 响应式尺寸计算 - 根据屏幕宽度和棋盘大小自适应 */
  width: calc((100vw - 120rpx) / var(--board-size, 5));
  height: calc((100vw - 120rpx) / var(--board-size, 5));
  max-width: calc(100rpx + (10 - var(--board-size, 5)) * 15rpx); /* 棋盘越小，格子越大 */
  max-height: calc(100rpx + (10 - var(--board-size, 5)) * 15rpx);
  min-width: 50rpx;
  min-height: 50rpx;
  
  /* 外观样式 */
  border: 2rpx solid rgba(0, 122, 255, 0.2);
  border-radius: 12rpx;
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
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.03);
  
  /* 文字样式 */
  font-size: calc(20rpx + 2vw);
  font-weight: 600;
  color: #2c3e50;
}

/* 单元格悬停效果（适用于支持的平台） */
.cell:hover {
  transform: translateY(-2rpx) scale(1.02);
  border-color: #007aff;
  box-shadow: 0 4rpx 15rpx rgba(0, 122, 255, 0.1);
  background: linear-gradient(135deg, #ffffff, #e3f2fd);
}

/* 单元格点击效果 */
.cell:active {
  transform: translateY(-1rpx) scale(1.01);
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
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.03);
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

/* 毒药提示样式 - 设置毒药阶段显示自己的毒药 */
.cell.poison-hint {
  background: linear-gradient(135deg, #ff9800, #f57c00);
  border-color: #ff9800;
  color: white;
  box-shadow: 0 4rpx 15rpx rgba(255, 152, 0, 0.3),
              inset 0 1rpx 0 rgba(255, 255, 255, 0.2);
  animation: poisonHintPulse 1.5s ease-in-out infinite;
}

/* 毒药提示脉冲动画 */
@keyframes poisonHintPulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.8;
  }
}

/* 毒药提示文字样式 */
.cell.poison-hint text {
  font-size: 28rpx;
  text-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.3);
}

/* 响应式设计 - 针对不同屏幕尺寸和棋盘大小调整 */
@media screen and (max-width: 750rpx) {
  .grid {
    padding: calc(15rpx - var(--board-size, 5) * 0.8rpx);
    gap: calc(6rpx - var(--board-size, 5) * 0.3rpx);
  }
  
  .row {
    gap: calc(6rpx - var(--board-size, 5) * 0.3rpx);
  }
  
  .cell {
    border-radius: 8rpx;
    border-width: 1rpx;
    /* 小屏幕上进一步优化尺寸 */
    width: calc((100vw - 100rpx) / var(--board-size, 5));
    height: calc((100vw - 100rpx) / var(--board-size, 5));
  }
}

@media screen and (min-width: 1200rpx) {
  .grid {
    padding: 20rpx;
    gap: 6rpx;
  }
  
  .row {
    gap: 6rpx;
  }
  
  .cell {
    border-radius: 15rpx;
    border-width: 3rpx;
  }
}
</style>