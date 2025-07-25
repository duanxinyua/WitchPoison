/**
 * 用户模型测试脚本
 * 创建时间: 2025-07-25
 * 功能: 测试用户CRUD操作和认证功能
 */

const { initDatabase, closeDatabase } = require('./config/database');
const User = require('./models/User');

async function testUser() {
  console.log('开始用户模型测试...');
  
  try {
    // 初始化数据库
    await initDatabase();
    
    // 1. 测试创建游客用户
    console.log('\n=== 测试创建游客用户 ===');
    const guestUser = await User.createGuest('test_client_123');
    console.log('游客用户创建成功:', guestUser);
    
    // 2. 测试生成会话令牌
    console.log('\n=== 测试生成会话令牌 ===');
    const sessionData = await User.generateSessionToken(guestUser);
    console.log('会话令牌生成成功:', {
      token: sessionData.token ? '已生成' : '未生成',
      user: sessionData.user,
      expiresAt: sessionData.expiresAt
    });
    
    // 3. 测试验证会话令牌
    console.log('\n=== 测试验证会话令牌 ===');
    const verifiedUser = await User.verifySessionToken(sessionData.token);
    console.log('令牌验证结果:', verifiedUser);
    
    // 4. 测试微信用户创建
    console.log('\n=== 测试微信用户创建 ===');
    const wechatUserInfo = {
      openid: 'test_openid_12345',
      unionid: 'test_union_12345',
      session_key: 'test_session_key',
      nickname: '测试用户',
      avatar_url: 'https://example.com/avatar.jpg',
      gender: 1,
      city: '深圳',
      province: '广东',
      country: '中国'
    };
    
    const wechatUser = await User.findOrCreateByWechat(wechatUserInfo);
    console.log('微信用户创建/查找成功:', wechatUser);
    
    // 5. 测试用户查找
    console.log('\n=== 测试用户查找 ===');
    const foundUser = await User.findByOpenid('test_openid_12345');
    console.log('根据openid查找用户结果:', foundUser ? '找到' : '未找到');
    
    const foundById = await User.findById(wechatUser.id);
    console.log('根据ID查找用户结果:', foundById ? '找到' : '未找到');
    
    // 6. 测试游戏统计更新
    console.log('\n=== 测试游戏统计更新 ===');
    await User.updateGameStats(wechatUser.id, true); // 胜利
    await User.updateGameStats(wechatUser.id, false); // 失败
    
    const updatedUser = await User.findById(wechatUser.id);
    console.log('用户游戏统计:', {
      总场次: updatedUser.total_games,
      胜利次数: updatedUser.total_wins
    });
    
    console.log('\n用户模型测试完成！');
    
  } catch (error) {
    console.error('用户模型测试失败:', error);
  } finally {
    await closeDatabase();
    console.log('数据库连接已关闭');
  }
}

testUser();