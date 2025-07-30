# 女巫的毒药 - 多人心理博弈小游戏

基于UniApp + Vue 3的回合制多人在线小游戏，支持2-5人对战。

## 技术栈

- **前端**: UniApp + Vue 3 Composition API
- **后端**: Node.js + Express + WebSocket
- **部署**: 微信小程序

## 最近更新

### 2025-01-30 - 个性化设置功能修复

**修复问题**:
- ✅ 修复个性化弹窗中头像选择后显示不更新的问题
- ✅ 修复头像选择页面布局错误（从单列修复为6行5列网格）
- ✅ 修复点击"跳过"仍会保存头像的逻辑错误
- ✅ 解决Vue 2/3语法兼容性问题
- ✅ 修复小程序环境下的变量访问问题

**技术改进**:
- 将首页从Vue 2选项式API重构为Vue 3 Composition API
- 实现临时预览机制，只有点击"保存设置"才真正保存
- 使用定时器轮询方案解决跨页面状态同步
- 优化头像选择页面布局和交互流程
- 完善资源清理机制避免内存泄漏

**提交记录**: `70b3e2c` - feat: 修复个性化设置中头像选择和显示逻辑

## 开发命令

```bash
# 前端开发
cd poison-game
npm install
npm run dev:mp-weixin       # 微信小程序开发模式
npm run build:mp-weixin     # 微信小程序构建

# 后端开发
cd poison-game-backend
npm install
npm start                   # 启动服务器 (默认端口3000)
```

## 游戏特色

- 🎯 2-5人实时对战
- 🧠 心理博弈策略
- 📱 微信小程序支持
- 🎨 个性化头像昵称
- ⚡ WebSocket实时通信

## 项目结构

```
poison-game/               # 前端UniApp项目
├── pages/                # 页面目录
│   ├── index/            # 首页（个性化设置）
│   ├── game/             # 游戏页面
│   └── avatar/           # 头像选择页面
├── components/           # 组件目录
├── utils/                # 工具类
└── config/               # 配置文件

poison-game-backend/       # 后端Node.js项目
└── index.js              # 主服务文件
```