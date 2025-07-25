/**
 * 用户数据模型
 * 创建时间: 2025-07-25
 * 最后修改: 2025-07-25 by Claude
 * 功能: 用户数据的CRUD操作，支持微信小程序登录
 * 特性:
 * - 微信用户信息管理
 * - 游客模式支持
 * - 用户统计数据
 * - 会话管理
 */

const { query, transaction } = require('../config/database');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const wechatApi = require('../services/wechatApi');

// JWT密钥 - 2025-07-25: 用于生成用户会话令牌
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_please_change_in_production';

class User {
  /**
   * 通过微信code登录用户
   * 2025-07-25: 使用微信官方API完整登录流程，支持用户信息层级化管理
   * @param {string} jsCode - 微信登录code
   * @param {Object} userInfo - 用户基本信息（可能包含前端缓存的自定义信息）
   * @param {string} loginIp - 用户登录IP地址
   * @returns {Promise<Object>} 用户信息
   */
  static async loginByWechatCode(jsCode, userInfo = {}, loginIp = null) {
    try {
      console.log('[User] 微信code登录流程开始');

      // 1. 调用微信API获取openid和session_key
      const wechatResult = await wechatApi.code2Session(jsCode);
      
      if (wechatResult.errcode !== 0) {
        throw new Error(`微信登录失败: ${wechatResult.errmsg}`);
      }

      const { openid, session_key, unionid } = wechatResult;
      console.log('[User] 微信API调用成功:', { openid, hasSessionKey: !!session_key });

      // 2. 查找或创建用户，传入前端的自定义信息和IP
      const wechatUserInfo = {
        openid,
        unionid,
        session_key,
        clientNickname: userInfo.nickname, // 前端传来的昵称（可能是自定义的）
        clientAvatarEmoji: userInfo.avatarEmoji, // 前端传来的头像
        avatar_url: userInfo.avatar_url || userInfo.avatarUrl || '',
        gender: userInfo.gender || 0,
        city: userInfo.city || '',
        province: userInfo.province || '',
        country: userInfo.country || '',
        loginIp: loginIp
      };

      return await this.findOrCreateByWechat(wechatUserInfo);

    } catch (error) {
      console.error('[User] 微信code登录失败:', error);
      throw error;
    }
  }

  /**
   * 通过微信openid查找或创建用户
   * 2025-07-25: 微信小程序登录的核心逻辑，实现用户信息层级化管理
   * 优先级: 数据库自定义信息 -> 前端缓存信息 -> 随机生成 -> 保存到数据库和返回给前端
   * @param {Object} wechatUserInfo - 微信用户信息
   * @returns {Promise<Object>} 用户信息
   */
  static async findOrCreateByWechat(wechatUserInfo) {
    try {
      const {
        openid,
        unionid,
        session_key,
        clientNickname,
        clientAvatarEmoji,
        avatar_url,
        gender,
        city,
        province,
        country,
        loginIp
      } = wechatUserInfo;

      console.log('[User] 查找或创建微信用户:', { openid, clientNickname });

      // 首先尝试查找现有用户
      let existingUser = await this.findByOpenid(openid);
      
      if (existingUser) {
        // 用户已存在，更新session_key和登录信息
        console.log('[User] 用户已存在，检查自定义信息和更新登录状态');
        
        // 检查现有session_key是否仍然有效
        if (existingUser.session_key && existingUser.session_key !== session_key) {
          console.log('[User] session_key已更新，验证旧session_key状态');
          const isOldSessionValid = await wechatApi.checkSessionKey(openid, existingUser.session_key);
          
          if (isOldSessionValid) {
            console.log('[User] 旧session_key仍有效，重置以确保唯一性');
            await wechatApi.resetUserSessionKey(openid, existingUser.session_key);
          }
        }

        // 实现用户信息层级化逻辑
        let finalNickname, finalAvatarEmoji;
        
        if (existingUser.has_customized && existingUser.custom_nickname && existingUser.custom_avatar_emoji) {
          // 1. 优先使用数据库中的自定义信息
          finalNickname = existingUser.custom_nickname;
          finalAvatarEmoji = existingUser.custom_avatar_emoji;
          console.log('[User] 使用数据库自定义信息:', { finalNickname, finalAvatarEmoji });
        } else if (clientNickname && clientAvatarEmoji) {
          // 2. 使用前端缓存的自定义信息，并保存到数据库
          finalNickname = clientNickname;
          finalAvatarEmoji = clientAvatarEmoji;
          console.log('[User] 使用前端缓存信息并保存到数据库:', { finalNickname, finalAvatarEmoji });
          
          // 保存到数据库作为自定义信息
          await this.updateCustomUserInfo(existingUser.id, finalNickname, finalAvatarEmoji);
        } else if (clientNickname && !clientAvatarEmoji) {
          // 2a. 只有昵称自定义，头像使用原有或随机
          finalNickname = clientNickname;
          finalAvatarEmoji = existingUser.avatar_emoji || this.getRandomAvatar();
          console.log('[User] 使用前端自定义昵称，头像使用原有:', { finalNickname, finalAvatarEmoji });
          
          // 保存到数据库作为自定义信息
          await this.updateCustomUserInfo(existingUser.id, finalNickname, finalAvatarEmoji);
        } else {
          // 3. 没有自定义信息，使用数据库原有信息或生成新的
          finalNickname = existingUser.nickname || this.generateRandomNickname();
          finalAvatarEmoji = existingUser.avatar_emoji || this.getRandomAvatar();
          console.log('[User] 使用原有信息或随机生成:', { finalNickname, finalAvatarEmoji });
        }
        
        const updatedUser = await this.updateWechatInfo(existingUser.id, {
          session_key,
          nickname: finalNickname,
          avatar_emoji: finalAvatarEmoji,
          avatar_url: avatar_url || existingUser.avatar_url,
          gender: gender !== undefined ? gender : existingUser.gender,
          city: city || existingUser.city,
          province: province || existingUser.province,
          country: country || existingUser.country,
          login_ip: loginIp,
          login_time: new Date(),
          last_login_time: new Date()
        });
        
        return updatedUser;
      } else {
        // 创建新用户 - 实现层级化信息获取
        console.log('[User] 创建新用户，实现信息层级化');
        
        let finalNickname, finalAvatarEmoji, hasCustomized = false;
        
        if (clientNickname && clientAvatarEmoji) {
          // 前端有完整的自定义信息
          finalNickname = clientNickname;
          finalAvatarEmoji = clientAvatarEmoji;
          hasCustomized = true;
          console.log('[User] 新用户使用前端完整自定义信息:', { finalNickname, finalAvatarEmoji });
        } else if (clientNickname && !clientAvatarEmoji) {
          // 前端只有昵称自定义
          finalNickname = clientNickname;
          finalAvatarEmoji = this.getRandomAvatar();
          hasCustomized = true;
          console.log('[User] 新用户使用前端自定义昵称:', { finalNickname, finalAvatarEmoji });
        } else {
          // 随机生成信息
          finalNickname = this.generateRandomNickname();
          finalAvatarEmoji = this.getRandomAvatar();
          console.log('[User] 新用户随机生成信息:', { finalNickname, finalAvatarEmoji });
        }
        
        const newUser = await this.create({
          openid,
          unionid,
          session_key,
          nickname: finalNickname,
          avatar_emoji: finalAvatarEmoji,
          avatar_url,
          gender: gender || 0,
          city,
          province,
          country,
          is_guest: false,
          has_customized: hasCustomized,
          custom_nickname: hasCustomized ? finalNickname : null,
          custom_avatar_emoji: hasCustomized ? finalAvatarEmoji : null,
          login_ip: loginIp,
          login_time: new Date()
        });
        
        return newUser;
      }
    } catch (error) {
      console.error('[User] 微信用户查找/创建失败:', error);
      throw error;
    }
  }

  /**
   * 创建新用户
   * 2025-07-25: 插入新用户记录到数据库
   * @param {Object} userData - 用户数据
   * @returns {Promise<Object>} 创建的用户信息
   */
  static async create(userData) {
    try {
      const {
        openid,
        unionid,
        session_key,
        nickname,
        avatar_url,
        avatar_emoji,
        gender,
        city,
        province,
        country,
        is_guest,
        has_customized,
        custom_nickname,
        custom_avatar_emoji,
        login_ip,
        login_time
      } = userData;

      const sql = `
        INSERT INTO users (
          openid, unionid, session_key, nickname, avatar_url, avatar_emoji,
          gender, city, province, country, is_guest, has_customized, 
          custom_nickname, custom_avatar_emoji, login_ip, login_time, last_login_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `;

      const params = [
        openid,
        unionid || null,
        session_key || null,
        nickname,
        avatar_url || null,
        avatar_emoji || '😺',
        gender || 0,
        city || null,
        province || null,
        country || null,
        is_guest || false,
        has_customized || false,
        custom_nickname || null,
        custom_avatar_emoji || null,
        login_ip || null,
        login_time || new Date()
      ];

      const result = await query(sql, params);
      console.log('[User] 用户创建成功, ID:', result.insertId);

      // 返回创建的用户信息
      return await this.findById(result.insertId);
    } catch (error) {
      console.error('[User] 用户创建失败:', error);
      throw error;
    }
  }

  /**
   * 通过openid查找用户
   * 2025-07-25: 根据微信openid查询用户
   * @param {string} openid - 微信openid
   * @returns {Promise<Object|null>} 用户信息或null
   */
  static async findByOpenid(openid) {
    try {
      const sql = 'SELECT * FROM users WHERE openid = ? AND is_guest = FALSE';
      const result = await query(sql, [openid]);
      
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error('[User] 根据openid查找用户失败:', error);
      throw error;
    }
  }

  /**
   * 通过ID查找用户
   * 2025-07-25: 根据用户ID查询用户信息
   * @param {number} userId - 用户ID
   * @returns {Promise<Object|null>} 用户信息或null
   */
  static async findById(userId) {
    try {
      const sql = 'SELECT * FROM users WHERE id = ?';
      const result = await query(sql, [userId]);
      
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error('[User] 根据ID查找用户失败:', error);
      throw error;
    }
  }

  /**
   * 更新微信用户信息
   * 2025-07-25: 更新用户的微信相关信息，包括新的字段
   * @param {number} userId - 用户ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object>} 更新后的用户信息
   */
  static async updateWechatInfo(userId, updateData) {
    try {
      const {
        session_key,
        nickname,
        avatar_emoji,
        avatar_url,
        gender,
        city,
        province,
        country,
        login_ip,
        login_time,
        last_login_time
      } = updateData;

      const sql = `
        UPDATE users SET 
          session_key = ?,
          nickname = ?,
          avatar_emoji = ?,
          avatar_url = ?,
          gender = ?,
          city = ?,
          province = ?,
          country = ?,
          login_ip = ?,
          login_time = ?,
          last_login_time = ?
        WHERE id = ?
      `;

      const params = [
        session_key || null,
        nickname || null,
        avatar_emoji || null,
        avatar_url || null,
        gender !== undefined ? gender : null,
        city || null,
        province || null,
        country || null,
        login_ip || null,
        login_time || null,
        last_login_time || null,
        userId
      ];

      await query(sql, params);
      console.log('[User] 用户信息更新成功, ID:', userId);

      // 返回更新后的用户信息
      return await this.findById(userId);
    } catch (error) {
      console.error('[User] 用户信息更新失败:', error);
      throw error;
    }
  }

  /**
   * 创建游客用户
   * 2025-07-25: 创建临时游客用户
   * @param {string} clientId - 客户端ID
   * @returns {Promise<Object>} 游客用户信息
   */
  static async createGuest(clientId, loginIp = null) {
    try {
      // 生成游客openid
      const guestOpenid = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const guestData = {
        openid: guestOpenid,
        nickname: this.generateRandomNickname(),
        avatar_emoji: this.getRandomAvatar(),
        is_guest: true,
        login_ip: loginIp,
        login_time: new Date()
      };

      console.log('[User] 创建游客用户:', { ...guestData, login_ip: loginIp });
      return await this.create(guestData);
    } catch (error) {
      console.error('[User] 游客用户创建失败:', error);
      throw error;
    }
  }

  /**
   * 生成会话令牌
   * 2025-07-25: 为用户生成JWT会话令牌
   * @param {Object} user - 用户信息
   * @returns {Promise<Object>} 会话令牌信息
   */
  static async generateSessionToken(user) {
    try {
      const payload = {
        userId: user.id,
        openid: user.openid,
        isGuest: user.is_guest,
        timestamp: Date.now()
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30天

      // 保存会话到数据库
      const sessionSql = `
        INSERT INTO user_sessions (user_id, session_token, expires_at, is_active)
        VALUES (?, ?, ?, TRUE)
        ON DUPLICATE KEY UPDATE
        session_token = VALUES(session_token),
        expires_at = VALUES(expires_at),
        is_active = TRUE,
        updated_at = NOW()
      `;

      await query(sessionSql, [user.id, token, expiresAt]);

      console.log('[User] 会话令牌生成成功, 用户ID:', user.id);

      return {
        token,
        expiresAt,
        user: {
          id: user.id,
          openid: user.openid,
          nickname: user.nickname,
          avatar_emoji: user.avatar_emoji,
          is_guest: user.is_guest
        }
      };
    } catch (error) {
      console.error('[User] 会话令牌生成失败:', error);
      throw error;
    }
  }

  /**
   * 验证会话令牌
   * 2025-07-25: 验证用户会话令牌的有效性，包括微信session_key验证
   * @param {string} token - 会话令牌
   * @returns {Promise<Object|null>} 用户信息或null
   */
  static async verifySessionToken(token) {
    try {
      // 验证JWT令牌
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // 检查数据库中的会话记录
      const sessionSql = `
        SELECT us.*, u.* FROM user_sessions us
        JOIN users u ON us.user_id = u.id
        WHERE us.session_token = ? AND us.is_active = TRUE AND us.expires_at > NOW()
      `;
      
      const result = await query(sessionSql, [token]);
      
      if (result.length === 0) {
        return null;
      }

      const sessionData = result[0];
      
      // 对于微信用户，验证session_key是否仍然有效
      if (!sessionData.is_guest && sessionData.session_key) {
        console.log('[User] 验证微信用户session_key有效性');
        
        const isSessionValid = await wechatApi.checkSessionKey(
          sessionData.openid, 
          sessionData.session_key
        );
        
        if (!isSessionValid) {
          console.log('[User] 微信session_key已失效，使会话无效');
          
          // 标记会话为无效
          await query(
            'UPDATE user_sessions SET is_active = FALSE WHERE session_token = ?',
            [token]
          );
          
          return null;
        }
      }
      
      // 更新最后访问时间
      await query(
        'UPDATE user_sessions SET updated_at = NOW() WHERE session_token = ?',
        [token]
      );

      return {
        id: sessionData.id,
        openid: sessionData.openid,
        nickname: sessionData.nickname,
        avatar_emoji: sessionData.avatar_emoji,
        is_guest: sessionData.is_guest,
        session_key: sessionData.session_key
      };
    } catch (error) {
      console.error('[User] 会话令牌验证失败:', error);
      return null;
    }
  }

  /**
   * 验证用户微信session_key
   * 2025-07-25: 检查用户的微信session_key是否有效
   * @param {number} userId - 用户ID
   * @returns {Promise<boolean>} session_key是否有效
   */
  static async validateWechatSession(userId) {
    try {
      const user = await this.findById(userId);
      
      if (!user || user.is_guest || !user.session_key) {
        console.log('[User] 用户不需要验证微信session_key:', { 
          userId, 
          isGuest: user?.is_guest,
          hasSessionKey: !!user?.session_key 
        });
        return true; // 游客用户或没有session_key的用户默认有效
      }

      console.log('[User] 验证用户微信session_key:', { userId, openid: user.openid });
      
      const isValid = await wechatApi.checkSessionKey(user.openid, user.session_key);
      
      if (!isValid) {
        console.log('[User] 微信session_key无效，清除用户session_key');
        
        // 清除无效的session_key
        await query(
          'UPDATE users SET session_key = NULL WHERE id = ?',
          [userId]
        );
        
        // 使相关的用户会话无效
        await query(
          'UPDATE user_sessions SET is_active = FALSE WHERE user_id = ?', 
          [userId]
        );
      }

      return isValid;

    } catch (error) {
      console.error('[User] 验证微信session失败:', error);
      return false;
    }
  }

  /**
   * 刷新用户微信session_key
   * 2025-07-25: 当session_key失效时，引导用户重新登录
   * @param {number} userId - 用户ID
   * @returns {Promise<boolean>} 是否需要重新登录
   */
  static async refreshWechatSession(userId) {
    try {
      const user = await this.findById(userId);
      
      if (!user || user.is_guest) {
        return false; // 游客用户不需要刷新
      }

      console.log('[User] 刷新用户微信session:', { userId, openid: user.openid });

      // 检查当前session_key状态
      const isValid = await this.validateWechatSession(userId);
      
      if (!isValid) {
        console.log('[User] session_key已失效，需要重新登录');
        return true; // 需要重新登录
      }

      return false; // 不需要重新登录

    } catch (error) {
      console.error('[User] 刷新微信session失败:', error);
      return true; // 出错时要求重新登录，确保安全
    }
  }

  /**
   * 更新用户自定义信息
   * 2025-07-25: 保存用户自定义的昵称和头像
   * @param {number} userId - 用户ID
   * @param {string} customNickname - 自定义昵称
   * @param {string} customAvatarEmoji - 自定义头像emoji
   */
  static async updateCustomUserInfo(userId, customNickname, customAvatarEmoji) {
    try {
      const sql = `
        UPDATE users SET 
          has_customized = TRUE,
          custom_nickname = ?,
          custom_avatar_emoji = ?,
          nickname = ?,
          avatar_emoji = ?
        WHERE id = ?
      `;
      
      await query(sql, [customNickname, customAvatarEmoji, customNickname, customAvatarEmoji, userId]);
      console.log('[User] 用户自定义信息更新成功:', { userId, customNickname, customAvatarEmoji });
    } catch (error) {
      console.error('[User] 用户自定义信息更新失败:', error);
      throw error;
    }
  }

  /**
   * 更新用户游戏统计
   * 2025-07-25: 更新用户的游戏场次和胜利次数
   * @param {number} userId - 用户ID
   * @param {boolean} isWin - 是否获胜
   */
  static async updateGameStats(userId, isWin = false) {
    try {
      const sql = `
        UPDATE users SET 
          total_games = total_games + 1,
          total_wins = total_wins + ?
        WHERE id = ?
      `;
      
      await query(sql, [isWin ? 1 : 0, userId]);
      console.log('[User] 用户游戏统计更新成功, 用户ID:', userId, '获胜:', isWin);
    } catch (error) {
      console.error('[User] 用户游戏统计更新失败:', error);
      throw error;
    }
  }

  /**
   * 生成随机昵称
   * 2025-07-25: 为游客用户生成随机昵称
   * @returns {string} 随机昵称
   */
  static generateRandomNickname() {
    const adjectives = ['勇敢的', '聪明的', '幸运的', '神秘的', '敏捷的', '睿智的', '快乐的', '冷静的'];
    const nouns = ['探险者', '法师', '勇士', '游侠', '智者', '旅行者', '猎人', '学者'];
    
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    
    return `${adj}${noun}`;
  }

  /**
   * 获取随机头像
   * 2025-07-25: 为游客用户生成随机头像emoji
   * @returns {string} 随机头像emoji
   */
  static getRandomAvatar() {
    const avatars = ['😺', '🐶', '🐰', '🦅', '🐘', '🐸', '🦊', '🐯', '🐨', '🐼'];
    return avatars[Math.floor(Math.random() * avatars.length)];
  }
}

module.exports = User;