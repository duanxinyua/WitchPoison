
// 后端服务配置 - 根据环境自动选择地址
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
    // 开发环境 - 使用本机IP地址
    return {
      backendUrl: 'http://192.168.10.200:3000',
      wsUrl: 'ws://192.168.10.200:3000'
    };
  } else {
    // 生产环境 - 使用线上地址
    return {
      backendUrl: 'https://dxywitch.linhaitec.com',
      wsUrl: 'wss://dxywitch.linhaitec.com'
    };
  }
}

const config = getEnvironmentConfig();

// 输出当前环境配置到控制台，便于调试
console.log('当前环境配置:', {
  环境: config.backendUrl.includes('192.168.') ? '开发环境' : '生产环境',
  HTTP地址: config.backendUrl,
  WebSocket地址: config.wsUrl
});

export default {
  backendUrl: config.backendUrl,
  wsUrl: config.wsUrl,
};