/**
 * API接口测试脚本
 * 创建时间: 2025-07-25
 * 功能: 测试认证相关的HTTP API接口
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

async function testAPI() {
  console.log('开始API接口测试...');
  
  try {
    // 1. 测试游客登录
    console.log('\n=== 测试游客登录 ===');
    const guestResponse = await axios.post(`${API_BASE}/auth/guest-login`, {
      clientId: 'test_client_api_001'
    });
    
    console.log('游客登录响应:', {
      success: guestResponse.data.success,
      user: guestResponse.data.data.user,
      tokenExists: !!guestResponse.data.data.token
    });
    
    const guestToken = guestResponse.data.data.token;
    
    // 2. 测试令牌验证
    console.log('\n=== 测试令牌验证 ===');
    const verifyResponse = await axios.post(`${API_BASE}/auth/verify-token`, {
      token: guestToken
    });
    
    console.log('令牌验证响应:', {
      success: verifyResponse.data.success,
      user: verifyResponse.data.data.user
    });
    
    // 3. 测试获取用户信息
    console.log('\n=== 测试获取用户信息 ===');
    const userInfoResponse = await axios.get(`${API_BASE}/auth/user-info`, {
      headers: {
        'Authorization': `Bearer ${guestToken}`
      }
    });
    
    console.log('用户信息响应:', {
      success: userInfoResponse.data.success,
      user: userInfoResponse.data.data.user
    });
    
    // 4. 测试更新头像
    console.log('\n=== 测试更新头像 ===');
    const updateAvatarResponse = await axios.post(`${API_BASE}/auth/update-avatar`, {
      avatar_emoji: '🎮'
    }, {
      headers: {
        'Authorization': `Bearer ${guestToken}`
      }
    });
    
    console.log('更新头像响应:', {
      success: updateAvatarResponse.data.success,
      message: updateAvatarResponse.data.message
    });
    
    // 5. 测试退出登录
    console.log('\n=== 测试退出登录 ===');
    const logoutResponse = await axios.post(`${API_BASE}/auth/logout`, {}, {
      headers: {
        'Authorization': `Bearer ${guestToken}`
      }
    });
    
    console.log('退出登录响应:', {
      success: logoutResponse.data.success,
      message: logoutResponse.data.message
    });
    
    // 6. 测试无效令牌验证
    console.log('\n=== 测试无效令牌验证 ===');
    try {
      await axios.post(`${API_BASE}/auth/verify-token`, {
        token: 'invalid_token_12345'
      });
    } catch (error) {
      console.log('无效令牌验证响应:', {
        status: error.response.status,
        message: error.response.data.message
      });
    }
    
    console.log('\nAPI接口测试完成！');
    
  } catch (error) {
    console.error('API测试失败:', error.response?.data || error.message);
  }
}

testAPI();