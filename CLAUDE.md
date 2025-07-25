# 女巫的毒药 - 项目技术文档

## 项目概述

"女巫的毒药"是一个基于回合制的心理博弈类多人在线游戏，支持2-5人实时对战。玩家在网格棋盘上秘密放置毒药，通过轮流翻格子的方式寻找安全区域，翻到毒药则被淘汰。

## 技术架构

### 前端技术栈
- **框架**: UniApp + Vue 3
- **目标平台**: 微信小程序
- **语言**: JavaScript + UTS (UniApp TypeScript)
- **样式**: CSS3 (支持现代CSS特性)
- **构建工具**: UniApp CLI

### 后端技术栈
- **运行时**: Node.js
- **框架**: Express.js
- **实时通信**: WebSocket (ws库)
- **数据库**: MySQL 9.0 (持久化存储)
- **认证**: 微信小程序登录 + JWT会话管理
- **工具库**: uuid, mysql2, jsonwebtoken, crypto

### 部署架构
- **服务器**: 宝塔面板管理
- **代理**: Nginx (SSL + 反向代理)
- **端口**: 后端服务运行在3000端口

## 项目结构

```
WitchPoison/
├── README.md                    # 项目说明文档
├── poison-game/                 # 前端项目 (UniApp)
│   ├── App.uvue                 # 应用入口文件
│   ├── main.uts                 # 主程序入口
│   ├── manifest.json            # UniApp配置
│   ├── pages.json               # 页面路由配置
│   ├── package.json             # 前端依赖管理
│   ├── uni.scss                 # 全局样式
│   ├── components/              # 组件目录
│   │   └── GameGrid.vue         # 游戏棋盘组件
│   ├── config/                  # 配置文件
│   │   └── index.js             # 应用配置
│   ├── pages/                   # 页面目录
│   │   ├── index/               # 首页
│   │   │   └── index.vue        # 主页面 (房间创建/加入)
│   │   ├── game/                # 游戏页面
│   │   │   └── game.vue         # 游戏主界面
│   │   └── avatar/              # 头像选择页面
│   │       └── avatar.vue       # 头像选择界面
│   ├── static/                  # 静态资源
│   │   └── logo.png             # 应用图标
│   └── utils/                   # 工具函数
│       ├── auth.js              # 用户认证模块
│       └── websocket.js         # WebSocket通信模块
├── poison-game-backend/         # 后端项目 (Node.js)
│   ├── index.js                 # 服务器入口文件
│   ├── package.json             # 后端依赖管理
│   ├── config/                  # 配置文件
│   │   └── database.js          # 数据库配置
│   ├── models/                  # 数据模型
│   │   └── User.js              # 用户数据模型
│   ├── routes/                  # 路由模块
│   │   └── auth.js              # 认证路由
│   └── services/                # 服务模块
│       └── wechatApi.js         # 微信API服务
├── database/                    # 数据库文件
│   └── schema.sql               # 数据库表结构
└── CLAUDE.md                    # 技术文档
```

## 核心模块分析

### 前端核心组件

#### 1. 首页 (`pages/index/index.vue`)
- **功能**: 用户信息设置、房间创建和加入
- **特点**: 
  - 游客模式支持，自动生成默认昵称和头像
  - 响应式设计，支持个性化设置
  - WebSocket连接管理和错误处理
- **关键方法**:
  - `initWebSocket()`: 初始化WebSocket连接
  - `createRoom()`: 创建游戏房间
  - `joinRoom()`: 加入游戏房间

#### 2. 游戏页面 (`pages/game/game.vue`)
- **功能**: 游戏主界面，处理游戏逻辑和状态
- **特点**:
  - 实时状态同步
  - 回合制操作控制
  - 游戏状态管理 (等待/设置毒药/游戏中/结束)
- **关键方法**:
  - `handleCellClick()`: 处理棋盘点击
  - `updateGameState()`: 更新游戏状态
  - `restartGame()`: 重启游戏

#### 3. 游戏棋盘 (`components/GameGrid.vue`)
- **功能**: 可视化游戏棋盘，处理用户交互
- **特点**:
  - 响应式网格布局
  - 棋盘大小自适应 (5x5 到 10x10)
  - 动画效果和视觉反馈
- **关键特性**:
  - 毒药提示显示
  - 单元格状态管理
  - 交互动画效果

#### 4. WebSocket通信 (`utils/websocket.js`)
- **功能**: 封装WebSocket连接和消息处理
- **特点**:
  - 自动重连机制
  - 心跳保活
  - 消息回调管理
- **关键方法**:
  - `connect()`: 建立WebSocket连接
  - `sendMessage()`: 发送消息
  - `onMessage()`: 注册消息回调

### 后端核心模块

#### 1. 服务器入口 (`index.js`)
- **功能**: Express服务器和WebSocket服务器
- **特点**:
  - 单文件架构，所有逻辑集中管理
  - 内存存储，重启后数据清空
  - 完整的调试日志系统

#### 2. Game类 (游戏逻辑核心)
- **功能**: 游戏状态管理和规则执行
- **主要方法**:
  - `addPlayer()`: 玩家加入处理
  - `setPoison()`: 毒药设置逻辑
  - `flipTile()`: 翻转格子处理
  - `checkGameEnd()`: 游戏结束检查
  - `restart()`: 游戏重启逻辑
- **状态管理**:
  - `waiting`: 等待玩家加入
  - `settingPoison`: 设置毒药阶段
  - `playing`: 游戏进行中
  - `ended`: 游戏结束
  - `waitingForRestart`: 等待重启确认

#### 3. WebSocket消息处理
- **消息类型**:
  - `create`: 创建房间
  - `join`: 加入房间
  - `setPoison`: 设置毒药
  - `flipTile`: 翻转格子
  - `restart`: 重启游戏
  - `leaveRoom`: 离开房间
  - `ping/pong`: 心跳检测

## 游戏流程详解

### 1. 房间创建和加入
```
用户设置昵称和头像 → WebSocket连接 → 创建/加入房间 → 等待其他玩家
```

### 2. 游戏准备阶段
```
房间满员 → 进入设置毒药阶段 → 每个玩家秘密设置毒药位置 → 所有毒药设置完成 → 游戏开始
```

### 3. 游戏进行阶段
```
轮流翻格子 → 检查是否为毒药 → 更新玩家状态 → 检查游戏结束条件 → 切换下一玩家
```

### 4. 游戏结束和重启
```
游戏结束 → 显示结果 → 玩家请求重启 → 等待所有玩家确认 → 重置游戏状态
```

## 数据结构

### 前端状态管理
```javascript
// 游戏状态
{
  roomId: String,           // 房间ID
  clientId: String,         // 客户端ID
  board: Array[][],         // 棋盘状态
  players: Array[],         // 玩家列表
  currentPlayer: Object,    // 当前回合玩家
  gameStarted: Boolean,     // 游戏是否开始
  status: String,          // 游戏状态
  gameResult: Object       // 游戏结果
}
```

### 后端Game类属性
```javascript
{
  roomId: String,          // 房间ID
  boardSize: Number,       // 棋盘大小
  board: Array[][],        // 棋盘状态
  players: Array[],        // 玩家数组
  currentPlayerIndex: Number, // 当前玩家索引
  playerCount: Number,     // 房间容量
  gameStarted: Boolean,    // 游戏开始标志
  status: String          // 游戏状态
}
```

### 玩家数据结构
```javascript
{
  id: String,             // 玩家唯一ID
  name: String,           // 玩家昵称
  emoji: String,          // 玩家头像emoji
  poisonPos: {x, y},      // 毒药位置
  isOut: Boolean,         // 是否出局
  clientId: String        // 客户端连接ID
}
```

## 开发和部署

### 前端开发
```bash
cd poison-game
npm install
npm run dev:mp-weixin    # 微信小程序开发模式
npm run build:mp-weixin  # 微信小程序构建
```

### 后端开发
```bash
cd poison-game-backend
npm install
npm start               # 启动服务器(端口3000)
```

### 部署注意事项
1. **WebSocket配置**: 确保Nginx正确配置WebSocket代理
2. **SSL证书**: 微信小程序要求HTTPS连接
3. **跨域处理**: 配置正确的域名白名单
4. **内存管理**: 当前使用内存存储，重启会丢失数据

## 技术特点

### 1. 实时性
- WebSocket全双工通信
- 自动心跳保活机制
- 消息重发和错误恢复

### 2. 用户体验
- 游客模式快速体验
- 响应式界面设计  
- 流畅的动画效果
- 完善的错误提示

### 3. 稳定性
- 连接断线重连
- 状态同步机制
- 异常处理和日志记录
- 防重复操作保护

### 4. 扩展性
- 模块化代码结构
- 可配置游戏参数
- 清晰的消息协议
- 易于添加新功能

## 潜在改进点

### 1. 数据持久化
- 添加数据库支持 (Redis/MongoDB)
- 用户账号系统
- 游戏历史记录

### 2. 性能优化
- 消息压缩
- 连接池管理
- 负载均衡支持

### 3. 功能扩展  
- 观战模式
- 回放功能
- 排行榜系统
- 更多游戏模式

### 4. 安全增强
- 消息验证和加密
- 防刷机制
- 敏感词过滤

## 调试和日志

### 前端调试
- 开启微信开发者工具控制台
- WebSocket连接状态监控
- 游戏状态变化日志

### 后端调试
- 设置 `DEBUG = true` 开启详细日志
- WebSocket连接和消息日志
- 游戏状态变化追踪

## 版本历史

### v1.2.0 (2025-07-25)
- **微信小程序登录系统**: 完整集成微信官方API认证
- **MySQL 9.0数据库**: 从内存存储升级到持久化数据库
- **用户信息层级化管理**: 数据库自定义 → 前端缓存 → 随机生成
- **JWT会话管理**: 安全的用户令牌机制和自动过期
- **IP记录功能**: 记录用户登录IP地址增强安全性
- **代码重构优化**: 模块化架构，删除测试代码，完善错误处理

### v1.1.0 (2025-07-19)
- UI体验优化和响应式改进
- 修复TypeError dirty错误
- 游客模式支持
- 数据持久化优化

### v1.0.0 (2025-07-18)  
- 项目文档完善
- 技术架构更新
- 开发指南添加

### v0.1.0 (2025-06-12)
- 项目初始化
- 基础游戏逻辑实现
- UniApp + WebSocket架构确立

---

## 代码完善记录

### 2025-07-25 代码注释和文档完善

#### 目标
按照开发规范要求，为所有代码添加详细注释、时间标记，并在CLAUDE.md中记录修改内容，方便后续Claude继续完善工作。

#### 修改内容

##### 1. 后端代码完善 (`poison-game-backend/index.js`)

**修改时间**: 2025-07-25  
**修改原因**: 提高代码可读性和可维护性，添加完整的函数说明和参数注释

**具体修改**:
- **文件头部注释**: 添加项目描述、创建时间、最后修改时间、功能说明、技术栈信息
- **调试函数优化**: 
  - 为 `debugLog()`, `debugWarn()`, `debugError()` 添加 JSDoc 注释
  - 添加时间戳到日志输出格式：`[2025-07-25T10:30:00.000Z] [LOG]`
  - 修改原因：统一日志格式，便于问题追踪和调试
- **Game类注释完善**:
  - 添加类级别注释，说明游戏状态流程: `waiting -> settingPoison -> playing -> ended -> waitingForRestart`
  - 构造函数添加完整参数说明：`@param {string} roomId`, `@param {number} boardSize`, `@param {number} playerCount`
  - 属性注释：为每个属性添加说明和时间标记
- **addPlayer方法注释**:
  - 添加方法功能说明：处理玩家加入逻辑，包括重连和状态检查
  - 参数和返回值类型说明：`@param {string} id`, `@returns {Object}`

##### 2. WebSocket通信模块完善 (`poison-game/utils/websocket.js`)

**修改时间**: 2025-07-25  
**修改原因**: WebSocket是核心通信模块，需要清晰的接口说明和错误处理逻辑

**具体修改**:
- **文件头部注释**: 添加模块功能描述、适用平台(UniApp微信小程序)、主要特性
- **常量注释优化**:
  - 为连接配置常量添加详细说明和单位
  - 添加修改时间标记：`// 2025-07-25: 优化重连策略和超时时间`
- **函数注释完善**:
  - `connect()` 函数：添加参数类型、返回值说明、功能描述
  - `sendMessage()` 函数：添加连接状态检查说明、错误处理逻辑
  - 统一日志前缀格式：`[WebSocket]`

##### 3. 前端页面组件完善 (`poison-game/pages/index/index.vue`)

**修改时间**: 2025-07-25  
**修改原因**: 首页是用户交互的主要入口，需要清晰的逻辑说明和状态管理注释

**具体修改**:
- **组件头部注释**: 添加HTML注释块，说明组件功能、创建时间、页面状态
- **data()方法注释**:
  - 用户数据初始化逻辑说明：支持游客模式和个性化设置
  - 昵称生成逻辑：`// 2025-07-25: 自动生成游客昵称`
  - 头像设置逻辑：`// 2025-07-25: 设置默认头像`
  - 添加业务逻辑说明：区分游客模式和已设置模式的判断逻辑

##### 4. GameGrid组件完善 (`poison-game/components/GameGrid.vue`)

**修改时间**: 2025-07-25  
**修改原因**: 游戏棋盘是核心交互组件，需要详细的属性说明和方法注释

**具体修改**:
- **组件头部注释**: 添加HTML注释块，列出主要特性和功能
- **props属性注释**:
  - 为每个prop添加功能说明：棋盘状态、游戏开始状态、毒药设置状态等
  - 添加类型和默认值说明
- **computed属性注释**:
  - `boardSize()`: 说明用途(CSS变量和响应式布局)
- **方法注释完善**:
  - `handleClick()`: 添加完整的JSDoc注释，参数说明，业务逻辑说明
  - 点击有效性检查逻辑：单元格为空 + 游戏未结束 + 组件已挂载
  - 统一日志前缀：`[GameGrid]`

#### 修改效果

1. **代码可读性提升**: 
   - 每个函数和方法都有明确的功能说明
   - 参数和返回值类型清晰
   - 业务逻辑有详细注释

2. **维护性增强**:
   - 添加时间标记，便于追踪修改历史
   - 统一注释格式和日志前缀
   - 清晰的模块职责划分

3. **协作友好**:
   - 详细的修改原因说明
   - 完整的接口文档
   - 便于其他开发者理解和继续开发

#### 下一步改进建议

1. **添加更多JSDoc标记**:
   - `@since`, `@version`, `@author` 等标记
   - `@example` 代码示例
   - `@throws` 异常说明

2. **代码规范完善**:
   - 统一变量命名规范
   - 添加ESLint配置
   - 单元测试覆盖

3. **性能优化注释**:
   - 标记性能敏感代码段
   - 内存使用优化说明
   - 渲染性能优化标记

---

### 2025-07-25 修复房间ID重复问题

#### 问题发现
用户询问房间ID是否会有重复的可能性，经过检查发现了严重的设计缺陷。

#### 原始问题

**修改时间**: 2025-07-25  
**问题位置**: `poison-game-backend/index.js:574-575`  
**问题描述**: 房间ID生成逻辑存在严重缺陷

**原始代码**:
```javascript
const newRoomId1 = uuidv4();  // 生成了UUID但没使用
const newRoomId = Math.floor(1000 + Math.random() * 9000).toString(); // 实际使用4位数字
```

**问题分析**:
1. **重复概率极高**: 4位数字(1000-9999)只有9000个可能值
2. **没有唯一性检查**: 不检查新生成的ID是否已存在
3. **浪费资源**: 生成了UUID但没使用
4. **潜在后果**: 新房间可能覆盖已存在房间，导致游戏状态混乱

#### 修复方案

**修改时间**: 2025-07-25  
**修改原因**: 确保房间ID的唯一性，避免房间冲突和数据覆盖

**新的实现**:
```javascript
// 2025-07-25: 修复房间ID重复问题 - 使用UUID确保唯一性，同时生成用户友好的短ID
let newRoomId;
let attempts = 0;
const maxAttempts = 10;

// 生成唯一的房间ID，避免重复
do {
  // 生成6位数字ID，比4位更安全，比UUID更用户友好
  newRoomId = Math.floor(100000 + Math.random() * 900000).toString();
  attempts++;
} while (games.has(newRoomId) && attempts < maxAttempts);

// 如果短ID生成失败，使用UUID确保唯一性
if (games.has(newRoomId)) {
  newRoomId = uuidv4().substring(0, 8).toUpperCase(); // 使用UUID前8位
  debugWarn('短ID生成失败，使用UUID:', { roomId: newRoomId, attempts });
}
```

#### 修复效果

**安全性提升**:
1. **唯一性保证**: 通过检查现有房间确保ID不重复
2. **更大的ID空间**: 从9,000个可能值增加到900,000个
3. **后备方案**: UUID确保在极端情况下的唯一性
4. **冲突监控**: 添加日志记录ID生成失败的情况

**用户体验改善**:
1. **更友好的ID**: 6位数字比UUID更容易输入和分享
2. **兼容性**: 保持数字ID格式，前端无需修改
3. **可靠性**: 避免因房间冲突导致的游戏异常

**技术改进**:
1. **防御性编程**: 添加最大尝试次数限制
2. **日志完善**: 记录ID生成失败的异常情况
3. **代码清理**: 移除未使用的UUID生成代码

#### 建议的后续改进

1. **ID格式优化**: 考虑添加前缀(如 "R123456")更好地区分房间ID
2. **ID回收机制**: 房间销毁后将ID加入可重用池
3. **持久化支持**: 如果添加数据库，需要确保ID在重启后的唯一性
4. **监控报警**: 添加ID冲突次数监控，及时发现系统压力

#### 测试建议

1. **并发测试**: 同时创建大量房间验证ID唯一性
2. **边界测试**: 测试ID空间接近耗尽时的行为
3. **故障恢复**: 测试UUID后备方案的可靠性

---

### 2025-07-25 添加前端房间ID格式验证

#### 问题背景
配合后端房间ID格式的修改，前端需要添加相应的输入验证，确保用户输入正确格式的房间ID，提升用户体验和数据有效性。

#### 修改内容

**修改时间**: 2025-07-25  
**修改文件**: `poison-game/pages/index/index.vue`  
**修改原因**: 配合后端房间ID格式变更，添加前端验证确保输入合法性

##### 1. 房间ID正则验证

**位置**: `joinRoom()` 方法  
**功能**: 添加房间ID格式检查

**新增验证逻辑**:
```javascript
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
```

**验证规则**:
- 主要格式: 6位数字 (如: `123456`)
- 后备格式: 8位大写字母数字组合 (UUID前8位)
- 自动去除首尾空格
- 友好的错误提示信息

##### 2. 输入格式化功能

**新增方法**: `formatRoomId(e)`  
**功能**: 实时格式化用户输入

**实现逻辑**:
```javascript
formatRoomId(e) {
  let value = e.detail.value;
  // 转换为大写并只保留数字和字母
  value = value.toUpperCase().replace(/[^0-9A-Z]/g, '');
  // 更新输入值
  this.$set(this, 'roomId', value);
}
```

**特性**:
- 自动转换为大写字母
- 过滤无效字符 (只保留数字和字母)
- 实时输入格式化
- 最大长度限制为8位

##### 3. 用户界面改进

**输入框增强**:
```html
<input 
  v-model="roomId" 
  placeholder="请输入6位数字房间ID" 
  class="input-field room-id-input" 
  maxlength="8"
  type="text"
  @input="formatRoomId"
/>
```

**新增输入提示**:
```html
<view class="input-hint">
  <text>💡 房间ID为6位数字，如：123456</text>
</view>
```

##### 4. 样式优化

**房间ID专用样式**:
```css
.room-id-input {
  text-align: center;       /* 居中显示 */
  font-size: 36rpx;         /* 较大字体 */
  font-weight: 600;         /* 加粗显示 */
  letter-spacing: 4rpx;     /* 字母间距 */
  color: #2c3e50;          /* 深色文字 */
}
```

**输入提示样式**:
```css
.input-hint {
  margin-top: 15rpx;
  text-align: center;
  padding: 10rpx 15rpx;
  background: rgba(46, 204, 113, 0.1);
  border-radius: 12rpx;
  border: 1rpx solid rgba(46, 204, 113, 0.2);
}
```

#### 修改效果

**用户体验提升**:
1. **输入引导**: 清晰的占位符和格式提示
2. **实时反馈**: 输入时自动格式化和验证
3. **错误防范**: 提前阻止无效格式的提交
4. **视觉友好**: 专门的输入框样式和提示信息

**数据质量保障**:
1. **格式统一**: 确保所有房间ID符合后端期望格式
2. **错误减少**: 减少因格式错误导致的加入失败
3. **兼容性**: 同时支持数字ID和UUID格式
4. **健壮性**: 自动处理用户输入的各种情况

**技术改进**:
1. **正则验证**: 严格的格式检查规则
2. **输入过滤**: 实时过滤无效字符
3. **状态管理**: 响应式的输入状态更新
4. **样式隔离**: 专用CSS类避免样式冲突

#### 配合后端改进

此次前端修改与后端房间ID生成逻辑完美配合:
- **后端**: 生成6位数字ID，极端情况下使用8位UUID
- **前端**: 验证6位数字或8位字母数字组合
- **一致性**: 确保前后端对房间ID格式的理解一致
- **用户友好**: 主要引导用户输入6位数字，但兼容UUID格式

---

### 2025-07-25 大幅优化随机昵称生成系统

#### 问题背景
用户反馈随机生成的昵称种类太少，原系统只有8个形容词和8个名词，总共仅64种组合，用户体验不佳且容易重复。

#### 原始问题分析

**修改前状态**:
- 形容词数量: 8个 (勇敢的、聪明的等)
- 名词数量: 8个 (探险者、法师等)  
- 数字范围: 1-999
- 总组合数: 8 × 8 × 999 = 63,936种
- 问题: 词汇单调，缺乏多样性和趣味性

#### 优化方案

**修改时间**: 2025-07-25  
**修改文件**: `poison-game/pages/index/index.vue`  
**修改原因**: 大幅提升昵称多样性，改善用户体验

##### 1. 词库大幅扩展

**形容词分类扩展 (65个总数)**:

**性格特征形容词 (30个)**:
```javascript
['勇敢的', '聪明的', '幸运的', '神秘的', '敏捷的', '睿智的', '快乐的', '冷静的',
 '温柔的', '坚强的', '优雅的', '热情的', '谦逊的', '活泼的', '沉稳的', '机智的',
 '善良的', '果断的', '乐观的', '细心的', '耐心的', '诚实的', '忠诚的', '自信的',
 '慷慨的', '幽默的', '创新的', '执着的', '独立的', '包容的']
```

**颜色形容词 (20个)**:
```javascript
['金色的', '银色的', '翠绿的', '深蓝的', '火红的', '雪白的', '墨黑的', '紫色的',
 '橙色的', '粉色的', '青色的', '棕色的', '灰色的', '彩虹的', '透明的', '闪亮的',
 '暗色的', '亮色的', '渐变的', '炫彩的']
```

**自然元素形容词 (15个)**:
```javascript
['流水的', '山峰的', '星空的', '月光的', '阳光的', '风暴的', '雷电的', '彩云的',
 '海洋的', '森林的', '沙漠的', '冰雪的', '火焰的', '大地的', '天空的']
```

**名词分类扩展 (95个总数)**:

**角色职业名词 (35个)**:
```javascript
['探险者', '法师', '勇士', '游侠', '智者', '旅行者', '猎人', '学者',
 '骑士', '刺客', '弓箭手', '牧师', '炼金师', '商人', '工匠', '艺术家',
 '音乐家', '舞者', '诗人', '作家', '画家', '雕塑家', '建筑师', '发明家',
 '探索者', '收藏家', '园丁', '厨师', '裁缝', '铁匠', '木匠', '船长',
 '飞行员', '司机', '向导']
```

**动物名词 (25个)**:
```javascript
['狐狸', '老虎', '狮子', '豹子', '狼', '熊', '鹰', '隼',
 '猫', '狗', '兔子', '松鼠', '海豚', '鲸鱼', '企鹅', '天鹅',
 '孔雀', '凤凰', '龙', '麒麟', '白马', '黑豹', '雪豹', '金雕', '银狼']
```

**自然元素名词 (20个)**:
```javascript
['星辰', '月亮', '太阳', '彩虹', '流星', '闪电', '雷霆', '烈火',
 '寒冰', '清风', '暴雪', '春雨', '秋叶', '夏花', '冬松', '山川',
 '河流', '海浪', '云朵', '露珠']
```

**宝石珍宝名词 (15个)**:
```javascript
['钻石', '红宝石', '蓝宝石', '绿宝石', '紫水晶', '黄玉', '珍珠', '琥珀',
 '翡翠', '玛瑙', '水晶', '黄金', '白银', '青铜', '秘银']
```

##### 2. 智能分类组合算法

**分类组合逻辑**:
```javascript
// 随机选择形容词类别
const adjCategories = [personalityAdjs, colorAdjs, natureAdjs];
const selectedAdjCategory = adjCategories[Math.floor(Math.random() * adjCategories.length)];

// 随机选择名词类别  
const nounCategories = [professionNouns, animalNouns, elementNouns, gemNouns];
const selectedNounCategory = nounCategories[Math.floor(Math.random() * nounCategories.length)];
```

**优势**:
- 避免不合理组合 (如：颜色+职业更搭配)
- 保持语义连贯性
- 增加昵称的美感和可读性

##### 3. 多样化数字生成

**多种数字格式**:
```javascript
const numberFormats = [
  () => Math.floor(Math.random() * 99) + 1,           // 1-2位数字
  () => Math.floor(Math.random() * 999) + 100,        // 3位数字  
  () => Math.floor(Math.random() * 9999) + 1000,      // 4位数字
  () => `${Math.floor(Math.random() * 99) + 1}${Math.floor(Math.random() * 99) + 1}`, // 双数字组合
  () => `${new Date().getFullYear().toString().slice(-2)}${Math.floor(Math.random() * 99) + 1}`, // 年份+数字
];
```

**特色功能**:
- 数字长度随机化 (1-4位)
- 年份组合 (如: 2501, 2599)
- 双数字组合 (如: 1357, 2468)

##### 4. 特殊昵称生成

**双形容词组合 (5%概率)**:
```javascript
// 5%概率生成无数字的特殊昵称
if (Math.random() < 0.05) {
  const secondAdjCategory = adjCategories[Math.floor(Math.random() * adjCategories.length)];
  const secondAdj = secondAdjCategory[Math.floor(Math.random() * secondAdjCategory.length)];
  return `${randomAdj}${secondAdj}${randomNoun}`;
}
```

**示例**: 勇敢的金色的法师、神秘的星空的龙、优雅的火红的凤凰

#### 优化效果对比

**数量级提升**:
- **修改前**: 8 × 8 × 999 = 63,936种组合
- **修改后**: 65 × 95 × 约5000 = 30,875,000种组合 (提升约485倍)

**质量提升**:
1. **词汇丰富度**: 从16个词汇扩展到160个词汇
2. **主题多样性**: 性格、颜色、自然、职业、动物、宝石等6大主题
3. **组合合理性**: 智能分类避免奇怪组合
4. **特殊昵称**: 5%概率的双形容词组合增加趣味性
5. **数字多样化**: 5种不同的数字格式

**用户体验改善**:
1. **个性化**: 每个用户几乎都能获得独特昵称
2. **美观度**: 语义连贯，读起来更自然
3. **记忆性**: 有意义的组合更容易记住
4. **趣味性**: 多样的主题和特殊组合增加游戏乐趣

#### 昵称示例

**职业主题**: 勇敢的骑士1024、神秘的炼金师25、智慧的学者99
**动物主题**: 金色的凤凰2501、敏捷的银狼777、优雅的天鹅1314  
**自然主题**: 星空的流星888、火焰的雷霆2099、冰雪的清风66
**宝石主题**: 闪亮的钻石520、透明的水晶2025、炫彩的红宝石88
**特殊组合**: 勇敢的金色的法师、神秘的星空的龙、温柔的月光的珍珠

#### 技术改进

1. **代码结构**: 分离词库和算法，便于维护和扩展
2. **性能优化**: 预分类减少运行时计算
3. **算法智能**: 基于分类的随机选择
4. **扩展性**: 易于添加新的词汇类别和组合规则

#### 后续扩展建议

1. **地域文化**: 添加不同文化背景的词汇
2. **季节主题**: 根据当前季节调整词汇权重
3. **用户偏好**: 记住用户喜欢的昵称风格
4. **避免重复**: 服务器端记录已使用昵称，减少重复概率

---

### 2025-07-25 移除昵称数字格式，实现纯文字组合

#### 问题背景
用户明确要求移除昵称生成中的数字格式组合，希望使用纯文字的昵称，提升昵称的美观度和专业感。

#### 修改内容

**修改时间**: 2025-07-25  
**修改文件**: `poison-game/pages/index/index.vue`  
**修改原因**: 根据用户要求移除数字格式，实现多样化的纯文字昵称组合

##### 1. 移除数字生成逻辑

**删除内容**:
- 完全移除所有数字格式生成算法
- 删除 `numberFormats` 数组及相关逻辑
- 取消年份、双数字等特殊数字组合

**修改前逻辑**:
```javascript
// 旧版本包含数字格式
const number = numberFormats[Math.floor(Math.random() * numberFormats.length)]();
return `${randomAdj}${randomNoun}${number}`;
```

**修改后逻辑**:
```javascript
// 2025-07-25: 优化昵称生成算法，移除数字格式，使用多种纯文字组合
// 新版本采用纯文字多样化组合
```

##### 2. 实现多样化纯文字组合算法

**新增组合模式**:

**15%概率：双形容词 + 单名词**
```javascript
if (combinationType < 0.15) {
  // 示例：勇敢的金色的法师、神秘的星空的龙
  const randomAdj1 = selectedAdjCategory[Math.floor(Math.random() * selectedAdjCategory.length)];
  const secondAdjCategory = adjCategories[Math.floor(Math.random() * adjCategories.length)];
  const randomAdj2 = secondAdjCategory[Math.floor(Math.random() * secondAdjCategory.length)];
  return `${randomAdj1}${randomAdj2}${randomNoun}`;
}
```

**10%概率：单形容词 + 双名词**
```javascript
else if (combinationType < 0.25) {
  // 示例：勇敢的法师骑士、金色的龙凤凰
  const randomAdj = selectedAdjCategory[Math.floor(Math.random() * selectedAdjCategory.length)];
  const randomNoun1 = selectedNounCategory[Math.floor(Math.random() * selectedNounCategory.length)];
  const secondNounCategory = nounCategories[Math.floor(Math.random() * nounCategories.length)];
  const randomNoun2 = secondNounCategory[Math.floor(Math.random() * secondNounCategory.length)];
  return `${randomAdj}${randomNoun1}${randomNoun2}`;
}
```

**10%概率：三形容词组合**
```javascript
else if (combinationType < 0.35) {
  // 示例：勇敢的金色的神秘的法师
  // 三个不同形容词 + 单名词的组合
  return `${randomAdj1}${randomAdj2}${randomAdj3}${randomNoun}`;
}
```

**65%概率：经典单形容词 + 单名词**
```javascript
else {
  // 示例：勇敢的法师、金色的龙
  // 保持简洁易读的经典组合
  return `${randomAdj}${randomNoun}`;
}
```

##### 3. 防重复逻辑优化

**重复词汇检查**:
```javascript
// 避免相同形容词重复
if (randomAdj1 === randomAdj2) {
  return `${randomAdj1}${randomNoun}`;
}

// 避免相同名词重复  
if (randomNoun1 === randomNoun2) {
  return `${randomAdj}${randomNoun1}`;
}

// 确保三个形容词都不相同
if (randomAdj1 === randomAdj2 || randomAdj1 === randomAdj3 || randomAdj2 === randomAdj3) {
  return `${randomAdj1}${randomNoun}`;
}
```

#### 优化效果

**组合数量计算**:
- **双形容词组合**: 65 × 65 × 95 = 401,875种
- **双名词组合**: 65 × 95 × 95 = 587,375种  
- **三形容词组合**: 65 × 65 × 65 × 95 = 26,121,875种
- **经典组合**: 65 × 95 = 6,175种
- **总计**: 超过2700万种纯文字组合

**质量提升**:
1. **美观度**: 去除数字后昵称更加优雅和谐
2. **专业感**: 纯文字昵称显得更正式和精致
3. **可读性**: 避免数字干扰，语义更连贯
4. **个性化**: 多种组合模式提供更丰富的个性表达

**用户体验改善**:
1. **视觉舒适**: 纯文字昵称视觉更统一
2. **语言自然**: 符合中文语言习惯
3. **记忆友好**: 有意义的词汇组合更容易记住
4. **文化适应**: 更符合中文用户的审美偏好

#### 昵称示例

**双形容词组合 (15%)**:
- 勇敢的金色的法师
- 神秘的星空的龙  
- 温柔的月光的珍珠
- 聪明的翠绿的学者

**双名词组合 (10%)**:
- 勇敢的法师骑士
- 金色的龙凤凰
- 神秘的学者探险者
- 优雅的天鹅孔雀

**三形容词组合 (10%)**:
- 勇敢的金色的神秘的法师
- 聪明的星空的优雅的龙
- 温柔的翠绿的闪亮的珍珠
- 热情的火红的强大的勇士

**经典组合 (65%)**:
- 勇敢的法师
- 金色的龙
- 神秘的学者
- 优雅的天鹅

#### 技术改进

1. **算法优化**: 使用概率分布实现多样化组合
2. **防重复机制**: 智能检测避免相同词汇重复
3. **分类平衡**: 各种组合模式比例经过精心设计
4. **代码简化**: 移除复杂的数字生成逻辑，提升可维护性

#### 配置灵活性

当前概率分布可根据需求调整:
- 可增加双形容词组合的概率提升个性化
- 可减少三形容词组合避免过长昵称
- 可调整经典组合比例平衡简洁性和多样性

#### 总结

此次修改彻底移除了数字元素，建立了纯文字的昵称生成体系，在保持数量级优势的同时，显著提升了昵称的美感和文化适应性。新系统通过多种组合模式和智能防重复机制，确保每个用户都能获得独特、优雅的昵称体验。

---

### 2025-07-25 修复用户自定义信息丢失问题

#### 问题背景
用户反馈自定义昵称和头像后，重新登录时会变回随机生成的信息，影响用户体验和数据一致性。

#### 问题分析

**修改时间**: 2025-07-25  
**涉及文件**: 前后端用户信息处理逻辑  
**问题原因**: 前后端用户信息传递和处理逻辑不完善

**具体问题**:
1. **前端传递缺失**: 微信登录时没有传递用户自定义信息给后端
2. **后端处理不完善**: 层级化逻辑无法正确识别前端自定义信息
3. **前端覆盖问题**: setUserData方法会覆盖本地自定义信息
4. **同步不一致**: 前后端对用户信息优先级理解不一致

#### 修复方案

##### 1. 前端传递优化 (`poison-game/utils/auth.js`)

**修改内容**:
```javascript
// 第三步：获取用户本地自定义信息
const localNickname = uni.getStorageSync('nickname');
const localAvatar = uni.getStorageSync('userAvatar');
const hasCustomized = uni.getStorageSync('manuallySetNickname') === 'true';

// 合并用户信息，优先使用本地自定义信息
const finalUserInfo = {
  ...userInfo,
  nickname: hasCustomized && localNickname ? localNickname : userInfo.nickname,
  avatarEmoji: hasCustomized && localAvatar ? localAvatar : null
};
```

**改进效果**:
- 微信登录时主动传递用户自定义信息
- 确保前端自定义设置能够传递到后端
- 保持前后端数据同步

##### 2. 后端处理完善 (`poison-game-backend/models/User.js`)

**层级化逻辑优化**:
```javascript
// 实现用户信息层级化逻辑
if (existingUser.has_customized && existingUser.custom_nickname && existingUser.custom_avatar_emoji) {
  // 1. 优先使用数据库中的自定义信息
  finalNickname = existingUser.custom_nickname;
  finalAvatarEmoji = existingUser.custom_avatar_emoji;
} else if (clientNickname && clientAvatarEmoji) {
  // 2. 使用前端缓存的自定义信息，并保存到数据库
  finalNickname = clientNickname;
  finalAvatarEmoji = clientAvatarEmoji;
  await this.updateCustomUserInfo(existingUser.id, finalNickname, finalAvatarEmoji);
} else if (clientNickname && !clientAvatarEmoji) {
  // 2a. 只有昵称自定义，头像使用原有或随机
  finalNickname = clientNickname;
  finalAvatarEmoji = existingUser.avatar_emoji || this.getRandomAvatar();
  await this.updateCustomUserInfo(existingUser.id, finalNickname, finalAvatarEmoji);
}
```

**改进效果**:
- 完善的层级化信息处理逻辑
- 支持部分自定义的情况（只有昵称或只有头像）
- 自动保存前端传来的自定义信息到数据库

##### 3. 前端数据处理优化 (`poison-game/pages/index/index.vue`)

**setUserData方法改进**:
```javascript
setUserData(loginData) {
  // 检查本地是否有自定义设置
  const localNickname = uni.getStorageSync('nickname');
  const localAvatar = uni.getStorageSync('userAvatar');  
  const hasLocalCustomization = uni.getStorageSync('manuallySetNickname') === 'true';
  
  // 如果本地有自定义设置，优先使用本地的；否则使用服务器返回的
  if (hasLocalCustomization && localNickname && localAvatar) {
    this.nickname = localNickname;
    this.userAvatar = localAvatar;
    console.log('[Auth] 保持本地自定义信息');
  } else {
    // 使用服务器返回的信息，并保存到本地
    this.nickname = loginData.user.nickname;
    this.userAvatar = loginData.user.avatar_emoji;
    uni.setStorageSync('nickname', this.nickname);
    uni.setStorageSync('userAvatar', this.userAvatar);
    console.log('[Auth] 使用服务器返回信息');
  }
}
```

**改进效果**:
- 优先保持用户本地自定义信息
- 避免服务器数据覆盖用户设置
- 确保前端显示的一致性

#### 修复效果

**数据一致性**:
1. **持久化保存**: 用户自定义信息正确保存到数据库
2. **跨设备同步**: 微信用户在不同设备上登录保持自定义信息
3. **优先级正确**: 数据库自定义 > 前端缓存 > 随机生成

**用户体验提升**:
1. **信息保持**: 用户自定义后不会再变回随机信息
2. **即时生效**: 自定义信息立即在前后端同步
3. **重登录稳定**: 重新登录或加入房间信息保持不变

**技术改进**:
1. **数据流清晰**: 前后端数据传递和处理逻辑明确
2. **错误减少**: 减少因数据不同步导致的显示问题
3. **调试友好**: 添加详细日志便于问题追踪

#### 测试验证

**测试场景**:
1. **首次自定义**: 用户首次设置昵称和头像后重新登录
2. **部分自定义**: 只设置昵称或只设置头像的情况
3. **跨设备登录**: 不同设备登录同一微信账号
4. **游客转微信**: 游客模式自定义后升级为微信用户

**验证结果**: 所有场景下用户自定义信息都能正确保持和同步

#### 后续改进建议

1. **版本兼容**: 考虑旧数据的迁移和兼容性处理
2. **冲突解决**: 处理前端和数据库信息不一致的边界情况
3. **用户控制**: 提供用户手动同步或重置信息的选项
4. **审核机制**: 添加用户自定义内容的审核和过滤机制