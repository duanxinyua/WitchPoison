
// 从环境变量获取配置信息
function getEnvironmentConfig() {
  // 判断是否为开发环境
  const isDevelopment = process.env.NODE_ENV === 'development' || 
                       typeof window !== 'undefined' && 
                       (window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' ||
                        window.location.hostname.includes('192.168.') ||
                        window.location.hostname.includes('10.') ||
                        window.location.hostname.includes('172.'));

  if (isDevelopment) {
    // 开发环境配置
    return {
      backendUrl: process.env.VUE_APP_DEV_API_BASE_URL || 'http://localhost:3000',
      wsUrl: process.env.VUE_APP_DEV_WS_URL || 'ws://localhost:3000'
    };
  } else {
    // 生产环境配置
    return {
      backendUrl: process.env.VUE_APP_API_BASE_URL || 'https://dxywitch.linhaitec.com',
      wsUrl: process.env.VUE_APP_WS_URL || 'wss://dxywitch.linhaitec.com'
    };
  }
}

const config = getEnvironmentConfig();

// 输出当前环境配置到控制台，便于调试
console.log('当前环境配置:', {
  环境: process.env.NODE_ENV === 'development' ? '开发环境' : '生产环境',
  HTTP地址: config.backendUrl,
  WebSocket地址: config.wsUrl,
  应用版本: process.env.VUE_APP_VERSION
});

export default {
  backendUrl: config.backendUrl,
  wsUrl: config.wsUrl,
  appName: process.env.VUE_APP_NAME || '女巫的毒药',
  appVersion: process.env.VUE_APP_VERSION || '1.0.0'
};