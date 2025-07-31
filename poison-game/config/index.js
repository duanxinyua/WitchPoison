
// 应用配置 - 统一配置文件，方便后期修改
const APP_CONFIG = {
  // 后端服务配置
  backendUrl: 'https://dxywitch.linhaitec.com',
  wsUrl: 'wss://dxywitch.linhaitec.com',
  
  // 应用信息
  appName: '女巫的毒药',
  appVersion: '1.2.0',
  
  // 微信小程序配置
  wechatAppId: 'wx85c2b499b79831e1'
};

console.log('当前应用配置:', APP_CONFIG);

export default APP_CONFIG;