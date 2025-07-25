/**
 * WebSocket连接测试脚本
 * 创建时间: 2025-07-25
 * 功能: 测试WebSocket服务器连接和基本功能
 */

const WebSocket = require('ws');

async function testWebSocket() {
  console.log('开始WebSocket连接测试...');
  
  try {
    const clientId = `test_client_${Date.now()}`;
    const wsUrl = `ws://localhost:3000?clientId=${clientId}`;
    
    console.log(`连接到: ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);
    
    ws.on('open', () => {
      console.log('✅ WebSocket连接成功');
      
      // 发送ping测试
      console.log('发送ping消息...');
      ws.send(JSON.stringify({
        action: 'ping',
        clientId: clientId
      }));
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data);
      console.log('收到消息:', message);
      
      if (message.type === 'connected') {
        console.log('✅ 服务器确认连接');
      } else if (message.type === 'pong') {
        console.log('✅ ping-pong测试成功');
        
        // 测试创建房间
        console.log('测试创建房间...');
        ws.send(JSON.stringify({
          action: 'create',
          clientId: clientId,
          boardSize: 5,
          playerCount: 2,
          name: 'WebSocket测试用户'
        }));
      } else if (message.type === 'gameCreated') {
        console.log('✅ 房间创建成功:', {
          roomId: message.roomId,
          boardSize: message.boardSize,
          playerCount: message.playerCount
        });
        
        // 关闭连接
        setTimeout(() => {
          console.log('测试完成，关闭连接');
          ws.close();
        }, 1000);
      }
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket错误:', error);
    });
    
    ws.on('close', (code, reason) => {
      console.log('WebSocket连接关闭:', { code, reason: reason.toString() });
      console.log('WebSocket连接测试完成！');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('WebSocket测试失败:', error);
    process.exit(1);
  }
}

// 延迟启动测试，确保服务器已启动
setTimeout(testWebSocket, 1000);