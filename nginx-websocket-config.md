# Nginx WebSocket 配置指南

## 问题背景
小程序发布后创建和加入房间失败，需要确保Nginx正确配置WebSocket升级。

## Nginx配置示例

```nginx
server {
    listen 443 ssl http2;
    server_name dxywitch.linhaitec.com;

    # SSL证书配置
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    
    # SSL优化配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;

    # WebSocket升级配置 - 关键配置
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        
        # WebSocket升级必需的header
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # 基础代理header
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket超时配置
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        
        # 防止代理缓冲影响WebSocket
        proxy_buffering off;
    }
    
    # 可选：专门的WebSocket路径
    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_buffering off;
    }
    
    # API路径（如果需要区分）
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# HTTP重定向到HTTPS
server {
    listen 80;
    server_name dxywitch.linhaitec.com;
    return 301 https://$server_name$request_uri;
}
```

## 宝塔面板配置

如果使用宝塔面板，需要在站点设置中添加：

```nginx
# 在站点配置文件中的 location / 块内添加
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_read_timeout 3600s;
proxy_send_timeout 3600s;
proxy_buffering off;
```

## 验证配置

### 1. 检查Nginx配置语法
```bash
nginx -t
```

### 2. 重启Nginx
```bash
systemctl restart nginx
# 或
service nginx restart
```

### 3. 测试WebSocket连接
```bash
# 使用wscat工具测试
wscat -c wss://dxywitch.linhaitec.com

# 或使用curl测试HTTP升级
curl -i -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \
     -H "Sec-WebSocket-Version: 13" \
     https://dxywitch.linhaitec.com
```

## 常见问题

### 1. 502 Bad Gateway
- 检查后端Node.js服务是否在3000端口运行
- 检查防火墙设置

### 2. WebSocket连接被拒绝
- 确认Upgrade header配置正确
- 检查SSL证书是否支持WebSocket

### 3. 连接超时
- 调整proxy_read_timeout和proxy_send_timeout
- 检查服务器负载

## 日志调试

在Nginx配置中启用详细日志：

```nginx
error_log /var/log/nginx/error.log debug;
access_log /var/log/nginx/access.log combined;
```

监控日志：
```bash
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```