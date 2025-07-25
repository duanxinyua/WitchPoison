/**
 * 用户认证路由
 * 创建时间: 2025-07-25
 * 最后修改: 2025-07-25 by Claude
 * 功能: 处理微信小程序登录、游客登录、令牌验证等认证请求
 * 特性:
 * - 微信小程序登录
 * - 游客模式登录
 * - 会话令牌验证
 * - 用户信息获取
 */

const express = require('express');
const axios = require('axios');
const User = require('../models/User');
const wechatApi = require('../services/wechatApi');

const router = express.Router();

/**
 * 微信小程序登录
 * 2025-07-25: 处理微信小程序用户登录请求
 * POST /api/auth/wechat-login
 */
router.post('/wechat-login', async (req, res) => {
  try {
    const { code, userInfo } = req.body;

    // 获取客户端IP地址
    const clientIp = req.headers['x-forwarded-for'] || 
                     req.headers['x-real-ip'] || 
                     req.connection.remoteAddress || 
                     req.socket.remoteAddress || 
                     (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
                     req.ip;

    console.log('[Auth] 收到微信登录请求:', { 
      code: code ? '***' : null, 
      userInfo: userInfo ? { nickname: userInfo.nickname } : null,
      clientIp: clientIp,
      configStatus: wechatApi.getConfigStatus()
    });

    if (!code) {
      return res.status(400).json({
        success: false,
        message: '缺少微信登录code'
      });
    }

    // 使用新的微信API服务进行登录，传入IP地址
    const user = await User.loginByWechatCode(code, userInfo, clientIp);

    // 生成会话令牌
    const sessionData = await User.generateSessionToken(user);

    console.log('[Auth] 微信登录完成:', {
      userId: user.id,
      nickname: user.nickname,  
      isGuest: user.is_guest
    });

    res.json({
      success: true,
      message: '登录成功',
      data: sessionData
    });

  } catch (error) {
    console.error('[Auth] 微信登录处理失败:', error);
    
    // 根据错误类型返回不同的错误信息
    let errorMessage = '登录失败，请重试';
    let statusCode = 500;
    
    if (error.message.includes('微信登录失败')) {
      errorMessage = error.message;
      statusCode = 400;
    } else if (error.message.includes('连接超时')) {
      errorMessage = '网络连接超时，请检查网络后重试';
      statusCode = 408;
    }
    
    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * 游客模式登录
 * 2025-07-25: 创建游客用户并返回会话信息
 * POST /api/auth/guest-login
 */
router.post('/guest-login', async (req, res) => {
  try {
    const { clientId } = req.body;

    // 获取客户端IP地址
    const clientIp = req.headers['x-forwarded-for'] || 
                     req.headers['x-real-ip'] || 
                     req.connection.remoteAddress || 
                     req.socket.remoteAddress || 
                     (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
                     req.ip;

    console.log('[Auth] 收到游客登录请求:', { clientId, clientIp });

    // 创建游客用户，传入IP地址
    const guestUser = await User.createGuest(clientId, clientIp);

    // 生成会话令牌
    const sessionData = await User.generateSessionToken(guestUser);

    console.log('[Auth] 游客登录完成, 用户ID:', guestUser.id);

    res.json({
      success: true,
      message: '游客登录成功',
      data: sessionData
    });

  } catch (error) {
    console.error('[Auth] 游客登录处理失败:', error);
    res.status(500).json({
      success: false,
      message: '游客登录失败'
    });
  }
});

/**
 * 验证会话令牌
 * 2025-07-25: 验证用户会话令牌的有效性
 * POST /api/auth/verify-token
 */
router.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;
    const authHeader = req.headers.authorization;

    // 从请求体或Authorization头获取令牌
    const sessionToken = token || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null);

    if (!sessionToken) {
      return res.status(400).json({
        success: false,
        message: '缺少会话令牌'
      });
    }

    console.log('[Auth] 验证会话令牌');

    // 验证令牌
    const user = await User.verifySessionToken(sessionToken);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '会话令牌无效或已过期'
      });
    }

    console.log('[Auth] 令牌验证成功, 用户ID:', user.id);

    res.json({
      success: true,
      message: '令牌有效',
      data: { user }
    });

  } catch (error) {
    console.error('[Auth] 令牌验证失败:', error);
    res.status(500).json({
      success: false,
      message: '令牌验证失败'
    });
  }
});

/**
 * 获取用户信息
 * 2025-07-25: 根据会话令牌获取用户详细信息
 * GET /api/auth/user-info
 */
router.get('/user-info', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: '缺少认证令牌'
      });
    }

    // 验证令牌并获取用户信息
    const user = await User.verifySessionToken(token);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '认证令牌无效'
      });
    }

    // 获取完整用户信息
    const fullUserInfo = await User.findById(user.id);

    if (!fullUserInfo) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 过滤敏感信息
    const safeUserInfo = {
      id: fullUserInfo.id,
      nickname: fullUserInfo.nickname,
      avatar_emoji: fullUserInfo.avatar_emoji,
      is_guest: fullUserInfo.is_guest,
      total_games: fullUserInfo.total_games,
      total_wins: fullUserInfo.total_wins,
      created_at: fullUserInfo.created_at,
      last_login_time: fullUserInfo.last_login_time
    };

    res.json({
      success: true,
      message: '获取用户信息成功',
      data: { user: safeUserInfo }
    });

  } catch (error) {
    console.error('[Auth] 获取用户信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户信息失败'
    });
  }
});

/**
 * 检查用户登录状态
 * 2025-07-25: 检查用户会话和微信session_key状态
 * POST /api/auth/check-status
 */
router.post('/check-status', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.json({
        success: true,
        data: {
          isLoggedIn: false,
          needReauth: false,
          message: '未登录'
        }
      });
    }

    // 验证令牌（包含微信session_key验证）
    const user = await User.verifySessionToken(token);

    if (!user) {
      return res.json({
        success: true,
        data: {
          isLoggedIn: false,
          needReauth: true,
          message: '会话已过期，请重新登录'
        }
      });
    }

    // 对于微信用户，额外检查session状态
    let needReauth = false;
    if (!user.is_guest) {
      needReauth = await User.refreshWechatSession(user.id);
    }

    console.log('[Auth] 登录状态检查:', {
      userId: user.id,
      isGuest: user.is_guest,
      needReauth
    });

    res.json({
      success: true,
      data: {
        isLoggedIn: true,
        needReauth,
        user: {
          id: user.id,
          nickname: user.nickname,
          avatar_emoji: user.avatar_emoji,
          is_guest: user.is_guest
        },
        message: needReauth ? '微信登录状态已过期，建议重新登录' : '登录状态正常'
      }
    });

  } catch (error) {
    console.error('[Auth] 检查登录状态失败:', error);
    res.status(500).json({
      success: false,
      message: '检查登录状态失败'
    });
  }
});

/**
 * 退出登录
 * 2025-07-25: 使用户会话失效
 * POST /api/auth/logout
 */
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.json({
        success: true,
        message: '退出登录成功'
      });
    }

    // 使会话失效
    await require('../config/database').query(
      'UPDATE user_sessions SET is_active = FALSE WHERE session_token = ?',
      [token]
    );

    console.log('[Auth] 用户退出登录');

    res.json({
      success: true,
      message: '退出登录成功'
    });

  } catch (error) {
    console.error('[Auth] 退出登录处理失败:', error);
    res.status(500).json({
      success: false,
      message: '退出登录失败'
    });
  }
});

/**
 * 更新用户个性化信息
 * 2025-07-25: 更新用户的昵称和头像emoji
 * POST /api/auth/update-custom-info
 */
router.post('/update-custom-info', async (req, res) => {
  try {
    const { nickname, avatarEmoji } = req.body;
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: '缺少认证令牌'
      });
    }

    if (!nickname || !avatarEmoji) {
      return res.status(400).json({
        success: false,
        message: '缺少昵称或头像参数'
      });
    }

    // 验证令牌
    const user = await User.verifySessionToken(token);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '认证令牌无效'
      });
    }

    console.log('[Auth] 更新用户个性化信息:', { 
      userId: user.id, 
      nickname, 
      avatarEmoji,
      oldNickname: user.nickname,
      oldAvatar: user.avatar_emoji
    });

    // 使用User模型的方法更新自定义信息
    await User.updateCustomUserInfo(user.id, nickname, avatarEmoji);

    console.log('[Auth] 用户个性化信息更新成功, 用户ID:', user.id);

    res.json({
      success: true,
      message: '个性化信息更新成功',
      data: {
        nickname,
        avatar_emoji: avatarEmoji
      }
    });

  } catch (error) {
    console.error('[Auth] 个性化信息更新失败:', error);
    res.status(500).json({
      success: false,
      message: '个性化信息更新失败'
    });
  }
});

/**
 * 更新用户头像
 * 2025-07-25: 更新用户的头像emoji
 * POST /api/auth/update-avatar
 */
router.post('/update-avatar', async (req, res) => {
  try {
    const { avatar_emoji } = req.body;
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: '缺少认证令牌'
      });
    }

    if (!avatar_emoji) {
      return res.status(400).json({
        success: false,
        message: '缺少头像参数'
      });
    }

    // 验证令牌
    const user = await User.verifySessionToken(token);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '认证令牌无效'
      });
    }

    // 更新头像
    await require('../config/database').query(
      'UPDATE users SET avatar_emoji = ? WHERE id = ?',
      [avatar_emoji, user.id]
    );

    console.log('[Auth] 用户头像更新成功, 用户ID:', user.id, '新头像:', avatar_emoji);

    res.json({
      success: true,
      message: '头像更新成功'
    });

  } catch (error) {
    console.error('[Auth] 头像更新失败:', error);
    res.status(500).json({
      success: false,
      message: '头像更新失败'
    });
  }
});

module.exports = router;