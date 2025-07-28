# 环境配置说明

## 前端配置 (poison-game)

1. 复制环境配置模板：
```bash
cd poison-game
cp .env.example .env
```

2. 编辑 `.env` 文件，填入实际配置：
```bash
# 微信小程序AppID
VUE_APP_WECHAT_APPID=wx85c2b499b79831e1

# 后端服务地址
VUE_APP_API_BASE_URL=https://dxywitch.linhaitec.com
VUE_APP_WS_URL=wss://dxywitch.linhaitec.com

# UniApp应用ID
VUE_APP_UNI_APPID=__UNI__3AD6637
```

## 后端配置 (poison-game-backend)

1. 复制环境配置模板：
```bash
cd poison-game-backend
cp .env.example .env
```

2. 编辑 `.env` 文件，填入实际配置：
```bash
# 服务器端口
PORT=3000

# 域名配置
FRONTEND_DOMAIN=https://dxywitch.linhaitec.com
API_DOMAIN=https://dxywitch.linhaitec.com

# 调试模式
DEBUG=true
```

## 重要说明

- **`.env` 文件包含敏感信息，已添加到 `.gitignore` 中，不会被提交到Git**
- **每个部署环境都需要单独配置 `.env` 文件**
- **生产环境请将 `DEBUG=false` 并设置适当的安全配置**

## 配置验证

启动服务后，检查控制台输出确认配置已正确加载：

前端：
```
当前环境配置: {
  环境: "生产环境",
  HTTP地址: "https://dxywitch.linhaitec.com",
  WebSocket地址: "wss://dxywitch.linhaitec.com"
}
```

后端：
```
女巫的毒药后端 v1.0.0
服务器运行在 http://0.0.0.0:3000
环境: production
调试模式: 开启
```