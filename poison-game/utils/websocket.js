import config from '../config/index.js';

let socketTask = null;
let messageCallbacks = [];
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const CONNECT_TIMEOUT = 10000;
const HEARTBEAT_INTERVAL = 30000;
let heartbeatTimer = null;
let isConnecting = false;

export async function connect(clientId) {
  if (!clientId) {
    console.error('clientId 缺失，无法连接 WebSocket');
    return Promise.reject(new Error('clientId 缺失'));
  }

  // 强制关闭旧连接
  if (socketTask) {
    console.log('检测到现有 WebSocket 连接，关闭旧连接', { clientId, readyState: socketTask.readyState });
    closeWebSocket();
    await new Promise(resolve => setTimeout(resolve, 500)); // 等待关闭完成
  }

  if (isConnecting) {
    console.log('WebSocket 连接正在进行中，等待完成', { clientId });
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 20; // 最多等待10秒
      const checkConnection = setInterval(() => {
        attempts++;
        if (!isConnecting) {
          clearInterval(checkConnection);
          if (socketTask) {
            resolve();
          } else {
            reject(new Error('WebSocket 连接失败'));
          }
        } else if (attempts >= maxAttempts) {
          clearInterval(checkConnection);
          isConnecting = false;
          reject(new Error('等待连接超时'));
        }
      }, 500);
    });
  }

  isConnecting = true;
  let retries = MAX_RETRIES;
  let lastError = null;
  let currentClientId = clientId;

  while (retries > 0) {
    console.log(`尝试连接 WebSocket，剩余重试次数: ${retries}`, { clientId: currentClientId });
    try {
      return await new Promise((resolve, reject) => {
        const wsUrl = `${config.wsUrl}?clientId=${encodeURIComponent(currentClientId)}`;
        console.log('初始化 WebSocket:', { url: wsUrl });

        const tempSocketTask = wx.connectSocket({
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

        if (!tempSocketTask) {
          console.error('wx.connectSocket 未返回 socketTask');
          isConnecting = false;
          reject(new Error('wx.connectSocket 未返回 socketTask'));
          return;
        }

        // 保存临时引用，避免在onOpen回调中丢失
        const socketRef = tempSocketTask;
        
        const timeout = setTimeout(() => {
          console.error('WebSocket 连接超时', { clientId });
          isConnecting = false;
          reject(new Error('WebSocket 连接超时'));
        }, CONNECT_TIMEOUT);

        socketRef.onOpen(() => {
          console.log('WebSocket onOpen 触发', { 
            clientId: currentClientId, 
            readyState: socketRef?.readyState,
            hasSocketRef: !!socketRef,
            globalSocketTask: !!socketTask
          });
          
          // 设置全局socketTask
          socketTask = socketRef;
          clearTimeout(timeout);
          isConnecting = false;
          
          // 确保在 onOpen 后 readyState 正确设置
          setTimeout(() => {
            console.log('延迟执行绑定操作', { hasSocketTask: !!socketTask });
            bindMessageHandler();
            startHeartbeat(currentClientId);
            resolve();
          }, 100);
        });

        socketRef.onError((err) => {
          clearTimeout(timeout);
          console.error('WebSocket 连接错误:', err, { clientId: currentClientId });
          stopHeartbeat();
          isConnecting = false;
          socketTask = null;
          reject(err);
        });

        socketRef.onClose((event) => {
          console.log('WebSocket 连接关闭:', event, { clientId: currentClientId });
          stopHeartbeat();
          socketTask = null;
          messageCallbacks = [];
          isConnecting = false;
        });
      });
    } catch (error) {
      console.error('WebSocket 连接失败:', error, { clientId: currentClientId, retries });
      lastError = error;
      retries--;
      if (retries > 0) {
        // 生成新的clientId避免重复连接问题
        currentClientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log(`等待 ${RETRY_DELAY}ms 后重试，使用新clientId: ${currentClientId}`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }

  isConnecting = false;
  console.error('WebSocket 连接失败，已达最大重试次数', { clientId, lastError });
  return Promise.reject(lastError || new Error('WebSocket 连接失败'));
}

function bindMessageHandler() {
  // 使用更宽松的连接状态检查
  if (socketTask && !socketTask.onMessageBound) {
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
          messageCallbacks.forEach((cb) => {
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
    console.log('绑定 WebSocket 消息处理');
  }
}

export function sendMessage(data) {
  if (!socketTask || socketTask.readyState !== 1) {
    console.warn('WebSocket 未初始化或未连接', { readyState: socketTask?.readyState, data });
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

export function onMessage(callback) {
  // 允许在连接过程中注册回调，不要求socketTask必须立即可用
  if (!socketTask && !isConnecting) {
    console.warn('WebSocket 未初始化且未在连接中，无法注册回调', {
      socketTask: !!socketTask,
      isConnecting,
      readyState: socketTask?.readyState,
    });
    return () => {};
  }

  messageCallbacks.push(callback);
  console.log('注册消息回调，当前回调数:', messageCallbacks.length);
  return () => {
    messageCallbacks = messageCallbacks.filter((cb) => cb !== callback);
    console.log('移除消息回调，剩余回调数:', messageCallbacks.length);
  };
}

export function isConnected() {
  // 更严格的连接状态检查
  const hasSocketTask = !!socketTask;
  const readyState = socketTask?.readyState;
  // 如果正在连接中，也认为是"连接状态"
  const connected = hasSocketTask && (readyState === 1 || (isConnecting && readyState === undefined));
  console.log('检查 WebSocket 连接状态:', { connected, readyState, hasSocketTask, isConnecting });
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

function startHeartbeat(clientId) {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }
  heartbeatTimer = setInterval(() => {
    if (socketTask && socketTask.readyState === 1) {
      console.log('发送心跳:', { clientId });
      sendMessage({ action: 'ping', clientId });
    } else {
      console.warn('心跳失败，WebSocket 未连接', { readyState: socketTask?.readyState });
      stopHeartbeat();
    }
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    console.log('停止心跳');
  }
}