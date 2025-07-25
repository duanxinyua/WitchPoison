/**
 * 增强API接口测试脚本
 * 创建时间: 2025-07-25
 * 功能: 测试完善后的认证API，包括微信登录和状态检查
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

async function testEnhancedAPI() {
  console.log('开始增强API接口测试...');
  
  try {
    // 1. 测试微信登录（演示模式）
    console.log('\n=== 测试微信登录（演示模式） ===');
    const wechatLoginResponse = await axios.post(`${API_BASE}/auth/wechat-login`, {
      code: 'test_wechat_code_12345',
      userInfo: {
        nickname: 'API测试用户',
        avatar_url: 'https://example.com/test-avatar.jpg',
        gender: 1,
        city: '北京',
        province: '北京',
        country: '中国'
      }
    });
    
    console.log('微信登录响应:', {
      success: wechatLoginResponse.data.success,
      message: wechatLoginResponse.data.message,
      user: wechatLoginResponse.data.data.user,
      hasToken: !!wechatLoginResponse.data.data.token,
      config: wechatLoginResponse.data.data.config
    });
    
    const wechatToken = wechatLoginResponse.data.data.token;
    
    // 2. 测试登录状态检查
    console.log('\n=== 测试登录状态检查 ===');
    const statusResponse = await axios.post(`${API_BASE}/auth/check-status`, {}, {
      headers: {
        'Authorization': `Bearer ${wechatToken}`
      }
    });
    
    console.log('登录状态检查响应:', {
      success: statusResponse.data.success,
      data: statusResponse.data.data
    });
    
    // 3. 测试用户信息获取
    console.log('\n=== 测试用户信息获取 ===');
    const userInfoResponse = await axios.get(`${API_BASE}/auth/user-info`, {
      headers: {
        'Authorization': `Bearer ${wechatToken}`
      }
    });
    
    console.log('用户信息响应:', {
      success: userInfoResponse.data.success,
      user: userInfoResponse.data.data.user
    });
    
    // 4. 测试游客登录
    console.log('\n=== 测试游客登录 ===');
    const guestResponse = await axios.post(`${API_BASE}/auth/guest-login`, {
      clientId: 'enhanced_test_client_001'
    });
    
    console.log('游客登录响应:', {
      success: guestResponse.data.success,
      user: guestResponse.data.data.user,
      isGuest: guestResponse.data.data.user.is_guest
    });
    
    const guestToken = guestResponse.data.data.token;
    
    // 5. 测试游客登录状态检查
    console.log('\n=== 测试游客登录状态检查 ===');
    const guestStatusResponse = await axios.post(`${API_BASE}/auth/check-status`, {}, {
      headers: {
        'Authorization': `Bearer ${guestToken}`
      }
    });
    
    console.log('游客登录状态检查:', {
      success: guestStatusResponse.data.success,
      data: guestStatusResponse.data.data
    });
    
    // 6. 测试令牌验证
    console.log('\n=== 测试令牌验证 ===');
    const verifyResponse = await axios.post(`${API_BASE}/auth/verify-token`, {
      token: wechatToken
    });
    
    console.log('令牌验证响应:', {
      success: verifyResponse.data.success,
      user: verifyResponse.data.data.user
    });
    
    // 7. 测试无效令牌状态检查
    console.log('\n=== 测试无效令牌状态检查 ===');
    try {
      const invalidStatusResponse = await axios.post(`${API_BASE}/auth/check-status`, {}, {
        headers: {
          'Authorization': 'Bearer invalid_token_12345'
        }
      });
      
      console.log('无效令牌状态检查:', {
        success: invalidStatusResponse.data.success,
        data: invalidStatusResponse.data.data
      });
    } catch (error) {
      console.log('无效令牌状态检查错误:', error.response?.data || error.message);
    }
    
    // 8. 测试退出登录
    console.log('\n=== 测试退出登录 ===');
    const logoutResponse = await axios.post(`${API_BASE}/auth/logout`, {}, {
      headers: {
        'Authorization': `Bearer ${wechatToken}`
      }
    });
    
    console.log('退出登录响应:', {
      success: logoutResponse.data.success,
      message: logoutResponse.data.message
    });
    
    // 9. 测试退出登录后的状态检查
    console.log('\n=== 测试退出登录后的状态检查 ===');
    const afterLogoutStatusResponse = await axios.post(`${API_BASE}/auth/check-status`, {}, {
      headers: {
        'Authorization': `Bearer ${wechatToken}`
      }
    });
    
    console.log('退出登录后状态检查:', {
      success: afterLogoutStatusResponse.data.success,
      data: afterLogoutStatusResponse.data.data
    });
    
    console.log('\n增强API接口测试完成！');
    
  } catch (error) {
    console.error('增强API测试失败:', error.response?.data || error.message);
  }
}

testEnhancedAPI();