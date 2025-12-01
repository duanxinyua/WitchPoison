# 女巫的毒药 (H5 联网版)

联网 H5 版：Node + ws + Redis。玩家在 5×5~10×10 网格放置毒药，轮流翻格，踩毒药出局，剩一人胜；无安全未翻格且未翻格数=存活数时平局。前后端分区：后端 `backend/server.js`，前端静态 `public/`。

## 运行
```bash
npm install
export REDIS_URL=redis://127.0.0.1:6379   # 可选
export PORT=3000                          # 可选
npm start
```

## 功能要点
- 创建/加入分离：创建可随机房号、设棋盘大小/口令；加入仅填房号/口令。
- 两人毒药不可重叠，重叠清空双方需重选；三人及以上可重叠。
- 游戏结束主持人可重开，保留房间与玩家，重置毒药/翻格。
- 离开房间、房号复制、随机昵称、Emoji 选择（手机徽章可见）；本地缓存昵称/Emoji/房间信息（创建模式不复用房号）。
- 平局判定修正：无安全未翻格且未翻格数=存活数时平局。

## 协议/接口
- WS: `join_room`, `place_poison`, `start_game`, `reveal_cell`, `restart_game`, `leave_room`
- HTTP: `GET /suggest-room` 返回未占用 6 位房号
- 状态推送：`state { boardSize, started, finished, players[], currentPlayerId, reveals[], poisonHits[], winnerId, draw, yourId, yourPoison, version }`, `left`

## 部署提示
- 需要 Redis 可用实例（默认 `redis://127.0.0.1:6379`），端口默认 3000。
- 反向代理需透传 WebSocket（Upgrade/Connection 头），启用 HTTPS/WSS。
- 房间状态保留：写入时 TTL 1 天，无人连接时 1 小时过期。
- 前端为静态文件，由后端同端口直接提供。
