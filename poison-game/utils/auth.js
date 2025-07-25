/**
 * 微信小程序用户认证模块
 * 创建时间: 2025-07-25
 * 最后修改: 2025-07-25 by Claude
 * 功能: 微信小程序用户登录、会话管理、用户信息获取
 * 特性:
 * - 微信授权登录
 * - 用户信息获取
 * - 会话令牌管理
 * - 游客模式支持
 */

import config from '../config/index.js';

/**
 * 微信小程序登录
 * 2025-07-25: 实现微信小程序完整登录流程，支持官方API
 * @param {boolean} forceAuth - 是否强制重新获取用户授权
 * @returns {Promise<Object>} 登录结果
 */
export async function wxLogin(forceAuth = false) {
  try {
    console.log('[Auth] 开始微信小程序登录流程', { forceAuth });

    // 第一步：获取微信登录code
    const loginResult = await getWxLoginCode();
    if (!loginResult.code) {
      throw new Error('获取微信登录code失败');
    }

    console.log('[Auth] 微信登录code获取成功');

    // 第二步：获取用户信息授权
    let userInfo = {};
    
    if (forceAuth) {
      // 强制重新授权
      userInfo = await getUserProfile();
      console.log('[Auth] 强制重新获取用户信息成功');
    } else {
      // 尝试获取用户信息，失败时使用默认值
      try {
        userInfo = await getUserProfile();
        console.log('[Auth] 用户信息获取成功');
      } catch (authError) {
        console.warn('[Auth] 用户拒绝授权，使用默认信息:', authError.message);
        userInfo = {
          nickname: '微信用户',
          avatar_url: '',
          gender: 0,
          city: '',
          province: '',
          country: ''
        };
      }
    }

    // 第三步：获取用户本地自定义信息
    const localNickname = uni.getStorageSync('nickname');
    const localAvatar = uni.getStorageSync('userAvatar');
    const hasCustomized = uni.getStorageSync('manuallySetNickname') === 'true';
    
    // 合并用户信息，优先使用本地自定义信息
    const finalUserInfo = {
      ...userInfo,
      nickname: hasCustomized && localNickname ? localNickname : userInfo.nickname,
      avatarEmoji: hasCustomized && localAvatar ? localAvatar : null
    };
    
    console.log('[Auth] 准备发送用户信息到后端:', {
      hasCustomized,
      localNickname,
      localAvatar,
      finalNickname: finalUserInfo.nickname,
      finalAvatar: finalUserInfo.avatarEmoji
    });

    // 第四步：发送到后端进行登录认证
    const authResult = await authenticateWithBackend({
      code: loginResult.code,
      userInfo: finalUserInfo
    });

    // 第四步：保存用户信息和令牌
    if (authResult.success) {
      await saveUserSession(authResult.data);
      console.log('[Auth] 微信登录成功:', {
        userId: authResult.data.user.id,
        nickname: authResult.data.user.nickname,
        isDemo: authResult.data.config?.isDemo
      });
      
      // 如果是演示模式，给用户提示
      if (authResult.data.config?.isDemo) {
        setTimeout(() => {
          uni.showToast({
            title: '当前为演示模式',
            icon: 'none',
            duration: 2000
          });
        }, 500);
      }
      
      return {
        success: true,
        user: authResult.data.user,
        token: authResult.data.token,
        config: authResult.data.config
      };
    } else {
      throw new Error(authResult.message || '后端认证失败');
    }
  } catch (error) {
    console.error('[Auth] 微信登录失败:', error);
    
    // 如果是授权相关错误且不是强制授权，尝试游客模式
    if (!forceAuth && (
      error.message.includes('授权') || 
      error.message.includes('用户拒绝') ||
      error.message.includes('getUserProfile')
    )) {
      console.log('[Auth] 用户拒绝授权，切换到游客模式');
      const guestResult = await loginAsGuest();
      if (guestResult.success) {
        return guestResult;
      }
    }
    
    throw error;
  }
}

/**
 * 获取微信登录code
 * 2025-07-25: 调用wx.login获取临时登录凭证
 * @returns {Promise<Object>} 包含code的结果对象
 */
function getWxLoginCode() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (res) => {
        if (res.code) {
          console.log('[Auth] wx.login成功:', res.code);
          resolve({ code: res.code });
        } else {
          console.error('[Auth] wx.login失败:', res);
          reject(new Error('wx.login返回无效code'));
        }
      },
      fail: (err) => {
        console.error('[Auth] wx.login调用失败:', err);
        reject(new Error('wx.login调用失败: ' + err.errMsg));
      }
    });
  });
}

/**
 * 获取用户资料
 * 2025-07-25: 使用wx.getUserProfile获取用户基本信息
 * @returns {Promise<Object>} 用户资料对象
 */
function getUserProfile() {
  return new Promise((resolve, reject) => {
    wx.getUserProfile({
      desc: '用于完善游戏资料', // 用途说明
      success: (res) => {
        console.log('[Auth] getUserProfile成功:', res.userInfo);
        resolve({
          nickname: res.userInfo.nickName,
          avatar_url: res.userInfo.avatarUrl,
          gender: res.userInfo.gender,
          city: res.userInfo.city,
          province: res.userInfo.province,
          country: res.userInfo.country
        });
      },
      fail: (err) => {
        console.warn('[Auth] getUserProfile失败，使用默认信息:', err);
        // 如果用户拒绝授权，使用默认信息
        resolve({
          nickname: '微信用户',
          avatar_url: '',
          gender: 0,
          city: '',
          province: '',
          country: ''
        });
      }
    });
  });
}

/**
 * 后端认证
 * 2025-07-25: 向后端发送登录请求进行用户认证
 * @param {Object} authData - 认证数据 {code, userInfo}
 * @returns {Promise<Object>} 认证结果
 */
async function authenticateWithBackend(authData) {
  try {
    console.log('[Auth] 向后端发送认证请求');

    const response = await new Promise((resolve, reject) => {
      wx.request({
        url: `${config.apiUrl}/api/auth/wechat-login`,
        method: 'POST',
        data: authData,
        header: {
          'Content-Type': 'application/json'
        },
        success: (res) => {
          console.log('[Auth] 后端认证响应:', res);
          if (res.statusCode === 200) {
            resolve(res.data);
          } else {
            reject(new Error(`认证请求失败: ${res.statusCode}`));
          }
        },
        fail: (err) => {
          console.error('[Auth] 后端认证请求失败:', err);
          reject(new Error('网络请求失败: ' + err.errMsg));
        }
      });
    });

    return response;
  } catch (error) {
    console.error('[Auth] 后端认证失败:', error);
    throw error;
  }
}

/**
 * 游客模式登录
 * 2025-07-25: 创建游客用户，无需微信授权
 * @returns {Promise<Object>} 游客登录结果
 */
export async function loginAsGuest() {
  try {
    console.log('[Auth] 开始游客模式登录');

    const response = await new Promise((resolve, reject) => {
      wx.request({
        url: `${config.apiUrl}/api/auth/guest-login`,
        method: 'POST',
        data: {
          clientId: generateClientId()
        },
        header: {
          'Content-Type': 'application/json'
        },
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data);
          } else {
            reject(new Error(`游客登录失败: ${res.statusCode}`));
          }
        },
        fail: (err) => {
          reject(new Error('游客登录请求失败: ' + err.errMsg));
        }
      });
    });

    if (response.success) {
      await saveUserSession(response.data);
      console.log('[Auth] 游客登录成功, 用户ID:', response.data.user.id);
      
      return {
        success: true,
        user: response.data.user,
        token: response.data.token
      };
    } else {
      throw new Error(response.message || '游客登录失败');
    }
  } catch (error) {
    console.error('[Auth] 游客登录失败:', error);
    throw error;
  }
}

/**
 * 保存用户会话
 * 2025-07-25: 将用户信息和令牌保存到本地存储
 * @param {Object} sessionData - 会话数据 {user, token, expiresAt}
 */
async function saveUserSession(sessionData) {
  try {
    const { user, token, expiresAt } = sessionData;

    // 保存用户信息
    uni.setStorageSync('userInfo', user);
    uni.setStorageSync('sessionToken', token);
    uni.setStorageSync('tokenExpiresAt', expiresAt);

    // 保存到全局状态（如果需要）
    getApp().globalData = {
      ...getApp().globalData,
      userInfo: user,
      sessionToken: token,
      isLoggedIn: true
    };

    console.log('[Auth] 用户会话保存成功');
  } catch (error) {
    console.error('[Auth] 用户会话保存失败:', error);
    throw error;
  }
}

/**
 * 获取当前用户信息
 * 2025-07-25: 从本地存储获取当前登录用户信息
 * @returns {Object|null} 用户信息或null
 */
export function getCurrentUser() {
  try {
    const userInfo = uni.getStorageSync('userInfo');
    const sessionToken = uni.getStorageSync('sessionToken');
    const tokenExpiresAt = uni.getStorageSync('tokenExpiresAt');

    if (!userInfo || !sessionToken || !tokenExpiresAt) {
      return null;
    }

    // 检查令牌是否过期
    if (new Date(tokenExpiresAt) <= new Date()) {
      console.log('[Auth] 会话令牌已过期');
      clearUserSession();
      return null;
    }

    return {
      user: userInfo,
      token: sessionToken,
      expiresAt: tokenExpiresAt
    };
  } catch (error) {
    console.error('[Auth] 获取当前用户信息失败:', error);
    return null;
  }
}

/**
 * 检查登录状态
 * 2025-07-25: 验证用户是否已登录且会话有效
 * @returns {boolean} 是否已登录
 */
export function isLoggedIn() {
  const currentUser = getCurrentUser();
  return currentUser !== null;
}

/**
 * 清除用户会话
 * 2025-07-25: 清除本地存储的用户信息和令牌
 */
export function clearUserSession() {
  try {
    uni.removeStorageSync('userInfo');
    uni.removeStorageSync('sessionToken');
    uni.removeStorageSync('tokenExpiresAt');

    // 清除全局状态
    getApp().globalData = {
      ...getApp().globalData,
      userInfo: null,
      sessionToken: null,
      isLoggedIn: false
    };

    console.log('[Auth] 用户会话已清除');
  } catch (error) {
    console.error('[Auth] 清除用户会话失败:', error);
  }
}

/**
 * 检查登录状态
 * 2025-07-25: 检查用户登录状态和微信session_key有效性
 * @returns {Promise<Object>} 登录状态信息
 */
export async function checkLoginStatus() {
  try {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
      return {
        isLoggedIn: false,
        needReauth: false,
        message: '未登录'
      };
    }

    console.log('[Auth] 检查登录状态');

    const response = await new Promise((resolve, reject) => {
      wx.request({
        url: `${config.apiUrl}/api/auth/check-status`, 
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.token}`
        },
        success: (res) => {
          resolve(res.data);
        },
        fail: (err) => {
          reject(err);
        }
      });
    });

    if (response.success) {
      const { isLoggedIn, needReauth, user, message } = response.data;
      
      console.log('[Auth] 登录状态检查结果:', {
        isLoggedIn,
        needReauth,
        message
      });

      // 如果需要重新认证，清除本地会话
      if (needReauth) {
        clearUserSession();
      }

      return {
        isLoggedIn,
        needReauth,
        user,
        message
      };
    } else {
      throw new Error('检查登录状态失败');
    }

  } catch (error) {
    console.error('[Auth] 检查登录状态失败:', error);
    return {
      isLoggedIn: false,
      needReauth: true,
      message: '登录状态检查失败'
    };
  }
}

/**
 * 自动登录
 * 2025-07-25: 应用启动时尝试自动登录，包含登录状态检查
 * @returns {Promise<Object|null>} 登录结果或null
 */
export async function autoLogin() {
  try {
    const currentUser = getCurrentUser();
    
    if (currentUser) {
      console.log('[Auth] 发现本地会话，检查状态');
      
      // 检查登录状态（包含微信session_key验证）
      const statusCheck = await checkLoginStatus();
      
      if (statusCheck.isLoggedIn && !statusCheck.needReauth) {
        console.log('[Auth] 自动登录成功, 用户:', statusCheck.user.nickname);
        return {
          success: true,
          user: statusCheck.user,
          token: currentUser.token
        };
      } else {
        console.log('[Auth] 登录状态无效:', statusCheck.message);
        clearUserSession();
        
        // 如果是微信session过期，尝试静默重新登录
        if (statusCheck.needReauth && !statusCheck.user?.is_guest) {
          console.log('[Auth] 尝试静默重新登录');
          return await wxLogin(false);
        }
      }
    }

    // 如果没有有效会话，尝试静默登录
    console.log('[Auth] 尝试静默登录');
    return await wxLogin(false);
  } catch (error) {
    console.warn('[Auth] 自动登录失败，使用游客模式:', error);
    return await loginAsGuest();
  }
}

/**
 * 验证令牌
 * 2025-07-25: 向后端验证会话令牌的有效性
 * @param {string} token - 会话令牌
 * @returns {Promise<boolean>} 令牌是否有效
 */
async function verifyToken(token) {
  try {
    const response = await new Promise((resolve, reject) => {
      wx.request({
        url: `${config.apiUrl}/api/auth/verify-token`,
        method: 'POST',
        data: { token },
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        success: (res) => {
          resolve(res.data);
        },
        fail: (err) => {
          reject(err);
        }
      });
    });

    return response.success === true;
  } catch (error) {
    console.error('[Auth] 令牌验证失败:', error);
    return false;
  }
}

/**
 * 生成客户端ID
 * 2025-07-25: 生成唯一的客户端标识符
 * @returns {string} 客户端ID
 */
function generateClientId() {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 退出登录
 * 2025-07-25: 清除用户会话并跳转到登录页面
 */
export function logout() {
  clearUserSession();
  
  // 跳转到首页或登录页面
  uni.reLaunch({
    url: '/pages/index/index'
  });
  
  console.log('[Auth] 用户已退出登录');
}