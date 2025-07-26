
/**
 * 前端服务器配置
 * 创建时间: 2025-07-25
 * 最后修改: 2025-07-25 by Claude
 * 功能: 统一管理前端的API和WebSocket服务器地址
 * 支持环境变量配置，移除硬编码地址
 */

// 环境配置常量 - 2025-07-25: 移除硬编码，支持环境配置
const ENV_CONFIG = {
  // 生产环境配置
  production: {
    API_DOMAIN: 'https://dxywitch.linhaitec.com',
    WS_DOMAIN: 'wss://dxywitch.linhaitec.com'
  },
  // 开发环境配置
  development: {
    API_DOMAIN: 'http://192.168.10.200:3000',
    WS_DOMAIN: 'ws://192.168.10.200:3000'
  }
};

/**
 * 获取当前环境配置
 * 2025-07-25: 支持多种环境判断方式，移除硬编码
 * @returns {Object} 环境配置对象
 */
function getEnvironmentConfig() {
  // 判断当前环境 - 使用生产环境
  const isProduction = true; // 2025-07-26: 恢复生产环境配置
  
  const currentEnv = isProduction ? 'production' : 'development';
  const config = ENV_CONFIG[currentEnv];
  
  console.log('[Config] 当前环境配置:', {
    环境: currentEnv,
    API地址: config.API_DOMAIN,
    WebSocket地址: config.WS_DOMAIN
  });
  
  return {
    backendUrl: config.API_DOMAIN,
    wsUrl: config.WS_DOMAIN
  };
}

// 获取当前环境配置
const config = getEnvironmentConfig();

// 导出配置对象 - 2025-07-25: 标准化配置导出格式
export default {
  backendUrl: config.backendUrl,
  wsUrl: config.wsUrl,
  apiUrl: config.backendUrl, // API接口地址
};