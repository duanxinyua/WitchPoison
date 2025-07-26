# 小程序网络调试指南

## 问题诊断

### 1. 检查域名白名单
- 登录微信公众平台: https://mp.weixin.qq.com/
- 进入"开发管理" > "开发设置" > "服务器域名"
- 确保添加以下域名：
  - request合法域名: `https://dxywitch.linhaitec.com`
  - socket合法域名: `wss://dxywitch.linhaitec.com`

### 2. 调试步骤

在小程序开发者工具中：
1. 打开调试器控制台
2. 查看网络请求是否被拦截
3. 检查WebSocket连接是否成功建立

### 3. 常见错误信息

- `request:fail url not in domain list`: 域名未加入白名单
- `connectSocket:fail`: WebSocket连接失败
- `errMsg: "request:fail ssl hand shake error"`: SSL证书问题

### 4. 测试方法

```javascript
// 在小程序中执行网络测试
wx.request({
  url: 'https://dxywitch.linhaitec.com/api/auth/config-status',
  success: (res) => {
    console.log('HTTP请求成功:', res);
  },
  fail: (err) => {
    console.error('HTTP请求失败:', err);
  }
});

wx.connectSocket({
  url: 'wss://dxywitch.linhaitec.com',
  success: () => {
    console.log('WebSocket连接尝试成功');
  },
  fail: (err) => {
    console.error('WebSocket连接失败:', err);
  }
});
```

### 5. 服务器端检查

确保Nginx配置支持WebSocket升级：

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```