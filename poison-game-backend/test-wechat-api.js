/**
 * 微信API服务测试脚本
 * 创建时间: 2025-07-25
 * 功能: 测试微信API服务的各种功能
 */

const { initDatabase, closeDatabase } = require('./config/database');
const wechatApi = require('./services/wechatApi');
const User = require('./models/User');

async function testWechatApi() {
  console.log('开始微信API服务测试...');
  
  try {
    // 初始化数据库
    await initDatabase();
    
    // 1. 测试配置状态
    console.log('\n=== 测试配置状态 ===');
    const configStatus = wechatApi.getConfigStatus();
    console.log('配置状态:', configStatus);
    
    // 2. 测试code2Session（演示模式）
    console.log('\n=== 测试code2Session ===');
    const mockCode = 'test_js_code_12345';
    const sessionResult = await wechatApi.code2Session(mockCode);
    console.log('code2Session结果:', {
      success: sessionResult.errcode === 0,
      hasOpenid: !!sessionResult.openid,
      hasSessionKey: !!sessionResult.session_key,
      unionid: sessionResult.unionid
    });
    
    // 3. 测试用户登录
    console.log('\n=== 测试用户登录 ===');
    const mockUserInfo = {
      nickname: '测试微信用户',
      avatar_url: 'https://example.com/avatar.jpg',
      gender: 1,
      city: '深圳',
      province: '广东',
      country: '中国'
    };
    
    const user = await User.loginByWechatCode(mockCode, mockUserInfo);
    console.log('用户登录成功:', {
      id: user.id,
      nickname: user.nickname,
      openid: user.openid,
      is_guest: user.is_guest,
      hasSessionKey: !!user.session_key
    });
    
    // 4. 测试session_key验证
    console.log('\n=== 测试session_key验证 ===');
    if (user.session_key) {
      const isSessionValid = await wechatApi.checkSessionKey(user.openid, user.session_key);
      console.log('session_key验证结果:', isSessionValid);
      
      // 5. 测试用户session验证
      console.log('\n=== 测试用户session验证 ===');
      const userSessionValid = await User.validateWechatSession(user.id);
      console.log('用户session验证结果:', userSessionValid);
    }
    
    // 6. 测试会话令牌生成和验证
    console.log('\n=== 测试会话令牌 ===');
    const sessionData = await User.generateSessionToken(user);
    console.log('会话令牌生成成功:', {
      hasToken: !!sessionData.token,
      expiresAt: sessionData.expiresAt,
      userId: sessionData.user.id
    });
    
    const verifiedUser = await User.verifySessionToken(sessionData.token);
    console.log('会话令牌验证结果:', verifiedUser ? '成功' : '失败');
    
    // 7. 测试获取access_token
    console.log('\n=== 测试获取access_token ===');
    const accessToken = await wechatApi.getAccessToken();
    console.log('access_token获取:', {
      success: !!accessToken,
      isDemo: accessToken === 'demo_access_token'
    });
    
    console.log('\n微信API服务测试完成！');
    
  } catch (error) {
    console.error('微信API服务测试失败:', error);
  } finally {
    await closeDatabase();
    console.log('数据库连接已关闭');
  }
}

testWechatApi();