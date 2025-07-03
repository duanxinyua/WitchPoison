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
      console.log('GameGrid handleClick 触发:', { row: rowIndex, col: colIndex, isMounted: this.isMounted, boardValue: this.board[rowIndex][colIndex], gameStarted: this.gameStarted, poisonSet: this.poisonSet, gameResult: this.gameResult });
      if (!this.board[rowIndex][colIndex] && !this.gameResult && this.isMounted) {
        console.log('GameGrid 发出 cell-click:', { row: rowIndex, col: colIndex });
        this.$emit('cell-click', { row: rowIndex, col: colIndex });
      } else {
        console.warn('点击无效:', { boardValue: this.board[rowIndex][colIndex], gameResult: this.gameResult, isMounted: this.isMounted });
      }
    },
  },
  watch: {
    board: {
      handler(newBoard) {
        console.log('GameGrid board 更新:', JSON.parse(JSON.stringify(newBoard)));
      },
      deep: true,
    },
    gameStarted(newVal) {
      console.log('GameGrid gameStarted 更新:', newVal);
    },
    poisonSet(newVal) {
      console.log('GameGrid poisonSet 更新:', newVal);
    },
    gameResult(newVal) {
      console.log('GameGrid gameResult 更新:', newVal);
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
.grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: fit-content;
}
.row {
  display: flex;
  flex-direction: row !important;
  gap: 2px;
}
.cell {
  width: calc(500rpx / 5); /* 动态调整尺寸 */
  height: calc(500rpx / 5);
  border: 1rpx solid #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #fff;
  box-sizing: border-box;
}
.cell.poison {
  background-color: #ff4d4f;
}
.cell.disabled {
  background-color: #f0f0f0;
}
</style>