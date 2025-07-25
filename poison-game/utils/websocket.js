/**
 * WebSocket通信模块
 * 创建时间: 2025-07-25
 * 最后修改: 2025-07-25 by Claude
 * 功能: 封装WebSocket连接管理、消息处理、自动重连和心跳保活
 * 适用: UniApp微信小程序平台
 */

import config from '../config/index.js';

// WebSocket连接实例
let socketTask = null;
// 消息回调函数数组
let messageCallbacks = [];

// 连接配置常量 - 2025-07-25: 优化重连策略和超时时间
const MAX_RETRIES = 3;           // 最大重试次数
const RETRY_DELAY = 1000;        // 重试延迟时间(ms)
const CONNECT_TIMEOUT = 10000;   // 连接超时时间(ms)
const HEARTBEAT_INTERVAL = 30000; // 心跳间隔时间(ms)

// 连接状态管理
let heartbeatTimer = null;       // 心跳定时器
let isConnecting = false;        // 是否正在连接中

/**
 * 建立WebSocket连接
 * 2025-07-25: 支持自动重连和连接状态管理
 * @param {string} clientId - 客户端唯一标识符
 * @returns {Promise} - 连接结果Promise
 */
export async function connect(clientId) {
  if (!clientId) {
    console.error('[WebSocket] clientId 缺失，无法连接 WebSocket');
    return Promise.reject(new Error('clientId 缺失'));
  }

  // 强制关闭旧连接
  if (socketTask) {
    console.log('检测到现有 WebSocket 连接，关闭旧连接', { clientId, readyState: socketTask.readyState });
    closeWebSocket();
    // 2025-07-25: 确保连接状态完全重置
    isConnecting = false;
    await new Promise(resolve => setTimeout(resolve, 500)); // 等待关闭完成
  }

  if (isConnecting) {
    console.log('WebSocket 连接正在进行中，等待完成', { clientId });
    return new Promise((resolve, reject) => {
      const checkConnection = setInterval(() => {
        if (!isConnecting) {
          clearInterval(checkConnection);
          if (socketTask && socketTask.readyState === 1) {
            resolve();
          } else {
            reject(new Error('WebSocket 连接失败'));
          }
        }
      }, 500);
    });
  }

  isConnecting = true;
  let retries = MAX_RETRIES;
  let lastError = null;

  while (retries > 0) {
    console.log(`尝试连接 WebSocket，剩余重试次数: ${retries}`, { clientId });
    try {
      return await new Promise((resolve, reject) => {
        const wsUrl = `${config.wsUrl}?clientId=${encodeURIComponent(clientId)}`;
        console.log('初始化 WebSocket:', { url: wsUrl });

        socketTask = wx.connectSocket({
          url: wsUrl,
          success: () => {
            console.log('wx.connectSocket 调用成功', { clientId });
          },
          fail: (err) => {
            console.error('wx.connectSocket 初始化失败:', err, { clientId });
            isConnecting = false;
            reject(err);
          },
        });

        if (!socketTask) {
          console.error('wx.connectSocket 未返回 socketTask');
          isConnecting = false;
          reject(new Error('wx.connectSocket 未返回 socketTask'));
          return;
        }

        const timeout = setTimeout(() => {
          console.error('WebSocket 连接超时', { clientId });
          isConnecting = false;
          // 2025-07-25: 连接超时时清理socketTask，避免状态不一致
          if (socketTask) {
            try {
              socketTask.close();
            } catch (e) {
              console.warn('关闭超时连接失败:', e);
            }
            socketTask = null;
          }
          reject(new Error('WebSocket 连接超时'));
        }, CONNECT_TIMEOUT);

        socketTask.onOpen(() => {
          console.log('WebSocket onOpen 触发', { clientId, readyState: socketTask?.readyState });
          
          // 2025-07-25: 修复竞争条件 - 检查socketTask是否仍然有效
          if (!socketTask) {
            console.warn('onOpen回调触发时socketTask已被清理，跳过处理');
            return;
          }
          
          clearTimeout(timeout);
          isConnecting = false;
          
          // 立即绑定消息处理器
          bindMessageHandler();
          
          // 延迟启动心跳和状态确认
          setTimeout(() => {
            // 再次检查socketTask有效性
            if (socketTask && socketTask.readyState === 1) {
              startHeartbeat(clientId);
              console.log('WebSocket 连接完全建立', {
                clientId,
                readyState: socketTask.readyState,
                messageHandlerBound: socketTask.onMessageBound,
                callbackCount: messageCallbacks.length
              });
            } else {
              console.warn('WebSocket状态异常，连接可能不稳定', {
                hasSocketTask: !!socketTask,
                readyState: socketTask?.readyState
              });
            }
          }, 100);
          
          resolve();
        });

        socketTask.onError((err) => {
          clearTimeout(timeout);
          console.error('WebSocket 连接错误:', err, { clientId });
          stopHeartbeat();
          isConnecting = false;
          reject(err);
        });

        socketTask.onClose((event) => {
          console.log('WebSocket 连接关闭:', event, { clientId });
          stopHeartbeat();
          socketTask = null;
          // 不清空messageCallbacks，保留回调以便重连后继续使用
          isConnecting = false;
        });
      });
    } catch (error) {
      console.error('WebSocket 连接失败:', error, { clientId, retries });
      lastError = error;
      retries--;
      if (retries > 0) {
        console.log(`等待 ${RETRY_DELAY}ms 后重试...`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }

  isConnecting = false;
  console.error('WebSocket 连接失败，已达最大重试次数', { clientId, lastError });
  return Promise.reject(lastError || new Error('WebSocket 连接失败'));
}

/**
 * 绑定WebSocket消息处理器
 * 2025-07-25: 优化绑定逻辑，添加有效性检查
 */
function bindMessageHandler() {
  // 检查socketTask是否存在且有效，避免竞争条件
  if (!socketTask) {
    console.log('跳过消息处理器绑定 - socketTask不存在');
    return;
  }
  
  if (socketTask.onMessageBound) {
    console.log('跳过消息处理器绑定 - 已经绑定过');
    return;
  }
  
  console.log('开始绑定WebSocket消息处理器', {
    hasSocketTask: !!socketTask,
    readyState: socketTask.readyState,
    alreadyBound: socketTask.onMessageBound
  });
  
  socketTask.onMessage((res) => {
    try {
      const data = JSON.parse(res.data);
      console.log('收到 WebSocket 消息:', data, { callbackCount: messageCallbacks.length });

      if (!data.type) {
        console.error('消息缺少 type 字段:', data);
        return;
      }

      if (data.type === 'connected') {
        console.log('收到连接确认:', { clientId: data.clientId });
      } else if (data.type === 'pong') {
        console.log('收到心跳响应:', data);
      } else {
        // 创建回调副本，避免执行过程中数组被修改
        const callbacks = [...messageCallbacks];
        callbacks.forEach((cb) => {
          try {
            cb(data);
          } catch (error) {
            console.error('消息回调执行失败:', error, { data });
          }
        });
      }
    } catch (error) {
      console.error('解析 WebSocket 消息失败:', error, { rawData: res.data });
    }
  });
  
  socketTask.onMessageBound = true;
  console.log('WebSocket 消息处理器绑定完成', {
    callbackCount: messageCallbacks.length,
    readyState: socketTask.readyState
  });
}

/**
 * 发送WebSocket消息
 * 2025-07-25: 添加连接状态检查和错误处理
 * @param {Object} data - 要发送的消息对象
 * @returns {boolean} - 发送是否成功
 */
export function sendMessage(data) {
  if (!socketTask || socketTask.readyState !== 1) {
    console.warn('[WebSocket] 未初始化或未连接', { readyState: socketTask?.readyState, data });
    return false;
  }

  try {
    socketTask.send({
      data: JSON.stringify(data),
      success: () => {
        console.log('消息发送成功:', data);
      },
      fail: (err) => {
        console.error('消息发送失败:', err, { data });
      },
    });
    return true;
  } catch (error) {
    console.error('发送消息错误:', error, { data });
    return false;
  }
}

/**
 * 注册WebSocket消息回调
 * 2025-07-25: 重新优化注册逻辑，解决时序问题和状态检查
 * @param {Function} callback - 消息处理回调函数
 * @returns {Function} - 用于移除回调的函数
 */
export function onMessage(callback) {
  if (typeof callback !== 'function') {
    console.error('onMessage: callback 必须是函数');
    return () => {};
  }

  // 直接注册回调到队列中，不依赖当前连接状态
  messageCallbacks.push(callback);
  console.log('注册新消息回调');
  
  // 输出当前状态信息用于调试
  const statusInfo = {
    callbackCount: messageCallbacks.length,
    hasSocketTask: !!socketTask,
    readyState: socketTask?.readyState,
    isConnecting: isConnecting
  };
  
  if (!socketTask) {
    console.log('WebSocket尚未创建，回调已排队等待', statusInfo);
  } else if (socketTask.readyState === 1) {
    console.log('WebSocket已连接，回调立即生效', statusInfo);
  } else {
    console.log('WebSocket连接中，回调已注册等待连接完成', statusInfo);
  }

  // 返回移除回调的函数
  return () => {
    const index = messageCallbacks.indexOf(callback);
    if (index > -1) {
      messageCallbacks.splice(index, 1);
      console.log('移除消息回调，剩余回调数:', messageCallbacks.length);
    }
  };
}

export function isConnected() {
  const connected = socketTask && socketTask.readyState === 1;
  console.log('检查 WebSocket 连接状态:', { connected, readyState: socketTask?.readyState });
  return connected;
}

export function closeWebSocket() {
  if (socketTask) {
    try {
      socketTask.close({
        code: 1000,
        reason: 'normal closure',
        success: () => {
          console.log('WebSocket 关闭成功');
        },
        fail: (err) => {
          console.error('WebSocket 关闭失败:', err);
        },
      });
    } catch (error) {
      console.error('关闭 WebSocket 错误:', error);
    }
    socketTask = null;
  }
  stopHeartbeat();
  messageCallbacks = [];
  console.log('WebSocket 已清理');
}

/**
 * 启动心跳机制
 * 2025-07-25: 优化心跳逻辑，添加连接检查和错误处理
 * @param {string} clientId - 客户端ID
 */
function startHeartbeat(clientId) {
  // 停止已有的心跳定时器
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  
  // 验证参数
  if (!clientId) {
    console.warn('startHeartbeat: clientId缺失，跳过心跳启动');
    return;
  }
  
  heartbeatTimer = setInterval(() => {
    if (!socketTask) {
      console.warn('心跳检查: socketTask不存在，停止心跳');
      stopHeartbeat();
      return;
    }
    
    if (socketTask.readyState === 1) {
      console.log('发送心跳:', { clientId });
      const success = sendMessage({ action: 'ping', clientId });
      if (!success) {
        console.warn('心跳发送失败，停止心跳机制');
        stopHeartbeat();
      }
    } else {
      console.warn('心跳检查: WebSocket未连接', { 
        readyState: socketTask.readyState,
        clientId 
      });
      stopHeartbeat();
    }
  }, HEARTBEAT_INTERVAL);
  
  console.log('心跳机制已启动', { clientId, interval: HEARTBEAT_INTERVAL });
}

/**
 * 停止心跳机制
 * 2025-07-25: 添加状态检查和日志
 */
function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    console.log('停止心跳');
  } else {
    console.log('心跳机制未启动，无需停止');
  }
}