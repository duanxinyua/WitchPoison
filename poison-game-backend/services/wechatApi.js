/**
 * 微信小程序API服务模块
 * 创建时间: 2025-07-25
 * 最后修改: 2025-07-25 by Claude
 * 功能: 封装微信小程序官方API调用，包括登录验证、session管理等
 * 参考文档: 
 * - https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-login/code2Session.html
 * - https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-login/checkSessionKey.html
 * - https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-login/ResetUserSessionKey.html
 */

const axios = require('axios');
const crypto = require('crypto');

// 微信小程序配置
const WECHAT_CONFIG = {
  appid: process.env.WECHAT_APPID || 'demo_appid',
  secret: process.env.WECHAT_SECRET || 'demo_secret'
};

// 微信API端点
const WECHAT_API = {
  CODE2SESSION: 'https://api.weixin.qq.com/sns/jscode2session',
  GET_ACCESS_TOKEN: 'https://api.weixin.qq.com/cgi-bin/token',
  CHECK_SESSION: 'https://api.weixin.qq.com/wxa/checksession',
  RESET_SESSION: 'https://api.weixin.qq.com/wxa/resetusersessionkey'
};

// 微信错误码映射
const WECHAT_ERROR_CODES = {
  40029: '无效的code',
  45011: 'API调用太频繁，请稍后再试',
  40226: '高风险用户登录被拒绝',
  40013: '无效的appid',
  40125: '无效的密钥',
  87009: '无效的签名',
  61024: '不合法的签名',
  40001: '获取access_token时AppSecret错误，或者access_token无效',
  42001: 'access_token超时',
  43101: '用户拒绝接受消息，版本过低时可能没有该字段'
};

class WechatApiService {
  constructor() {
    this.accessToken = null;
    this.accessTokenExpiry = null;
  }

  /**
   * code换取session_key和openid
   * 2025-07-25: 实现微信官方code2Session接口
   * @param {string} jsCode - 微信登录code
   * @returns {Promise<Object>} 包含openid、session_key、unionid的对象
   */
  async code2Session(jsCode) {
    try {
      console.log('[WechatAPI] 开始code2Session流程');

      // 检查是否为演示模式
      if (WECHAT_CONFIG.appid === 'demo_appid') {
        console.log('[WechatAPI] 演示模式，返回模拟数据');
        return {
          openid: `demo_openid_${Date.now()}`,
          session_key: `demo_session_${Math.random().toString(36).substr(2, 9)}`,
          unionid: null,
          errcode: 0,
          errmsg: 'ok'
        };
      }

      const params = {
        appid: WECHAT_CONFIG.appid,
        secret: WECHAT_CONFIG.secret,
        js_code: jsCode,
        grant_type: 'authorization_code'
      };

      console.log('[WechatAPI] 请求微信code2Session接口:', {
        appid: params.appid,
        js_code: jsCode ? '***' : null
      });

      const response = await axios.get(WECHAT_API.CODE2SESSION, {
        params,
        timeout: 10000,
        headers: {
          'User-Agent': 'WitchPoisonGame/1.0'
        }
      });

      const result = response.data;
      console.log('[WechatAPI] 微信接口响应:', {
        success: !result.errcode,
        errcode: result.errcode,
        errmsg: result.errmsg,
        hasOpenid: !!result.openid,
        hasSessionKey: !!result.session_key,
        hasUnionid: !!result.unionid
      });

      // 检查错误
      if (result.errcode) {
        const errorMsg = WECHAT_ERROR_CODES[result.errcode] || result.errmsg || '未知错误';
        throw new Error(`微信API错误 ${result.errcode}: ${errorMsg}`);
      }

      // 验证必要字段
      if (!result.openid || !result.session_key) {
        throw new Error('微信API返回数据不完整');
      }

      return {
        openid: result.openid,
        session_key: result.session_key,
        unionid: result.unionid || null,
        errcode: 0,
        errmsg: 'ok'
      };

    } catch (error) {
      console.error('[WechatAPI] code2Session失败:', error);
      
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        throw new Error('微信服务器连接超时，请重试');
      }
      
      if (error.response) {
        console.error('[WechatAPI] HTTP错误:', {
          status: error.response.status,
          data: error.response.data
        });
        throw new Error(`微信服务器错误: ${error.response.status}`);
      }

      throw error;
    }
  }

  /**
   * 获取访问令牌
   * 2025-07-25: 获取用于调用其他微信API的access_token
   * @returns {Promise<string>} access_token
   */
  async getAccessToken() {
    try {
      // 检查缓存的token是否有效
      if (this.accessToken && this.accessTokenExpiry && Date.now() < this.accessTokenExpiry) {
        console.log('[WechatAPI] 使用缓存的access_token');
        return this.accessToken;
      }

      // 演示模式
      if (WECHAT_CONFIG.appid === 'demo_appid') {
        this.accessToken = 'demo_access_token';
        this.accessTokenExpiry = Date.now() + 7200 * 1000; // 2小时
        return this.accessToken;
      }

      console.log('[WechatAPI] 获取新的access_token');

      const params = {
        grant_type: 'client_credential',
        appid: WECHAT_CONFIG.appid,
        secret: WECHAT_CONFIG.secret
      };

      const response = await axios.get(WECHAT_API.GET_ACCESS_TOKEN, {
        params,
        timeout: 10000
      });

      const result = response.data;

      if (result.errcode) {
        const errorMsg = WECHAT_ERROR_CODES[result.errcode] || result.errmsg || '获取access_token失败';
        throw new Error(`${result.errcode}: ${errorMsg}`);
      }

      // 缓存token，提前5分钟过期以避免边界情况
      this.accessToken = result.access_token;
      this.accessTokenExpiry = Date.now() + (result.expires_in - 300) * 1000;

      console.log('[WechatAPI] access_token获取成功:', {
        expires_in: result.expires_in,
        cached_until: new Date(this.accessTokenExpiry).toISOString()
      });

      return this.accessToken;

    } catch (error) {
      console.error('[WechatAPI] 获取access_token失败:', error);
      throw error;
    }
  }

  /**
   * 检查session_key有效性
   * 2025-07-25: 实现微信官方checkSessionKey接口
   * @param {string} openid - 用户openid
   * @param {string} sessionKey - 用户session_key
   * @returns {Promise<boolean>} session_key是否有效
   */
  async checkSessionKey(openid, sessionKey) {
    try {
      console.log('[WechatAPI] 检查session_key有效性:', { openid });

      // 演示模式始终返回有效
      if (WECHAT_CONFIG.appid === 'demo_appid') {
        console.log('[WechatAPI] 演示模式，session_key有效');
        return true;
      }

      // 获取access_token
      const accessToken = await this.getAccessToken();

      // 生成签名（使用session_key对空字符串进行HMAC-SHA256签名）
      const signature = crypto
        .createHmac('sha256', sessionKey)
        .update('')
        .digest('hex');

      const params = {
        access_token: accessToken,
        openid: openid,
        signature: signature,
        sig_method: 'hmac_sha256'
      };

      console.log('[WechatAPI] 请求checkSession接口:', {
        openid,
        sig_method: params.sig_method,
        hasSignature: !!signature
      });

      const response = await axios.get(WECHAT_API.CHECK_SESSION, {
        params,
        timeout: 8000
      });

      const result = response.data;

      console.log('[WechatAPI] checkSession响应:', {
        errcode: result.errcode,
        errmsg: result.errmsg
      });

      // errcode为0表示session_key有效
      if (result.errcode === 0) {
        return true;
      }

      // 87009表示无效签名，即session_key无效
      if (result.errcode === 87009) {
        console.log('[WechatAPI] session_key已失效');
        return false;
      }

      // 其他错误
      const errorMsg = WECHAT_ERROR_CODES[result.errcode] || result.errmsg || '检查session失败';
      console.warn('[WechatAPI] checkSession其他错误:', errorMsg);
      
      // 对于其他错误，我们假设session可能仍然有效，但记录警告
      return true;

    } catch (error) {
      console.error('[WechatAPI] checkSession失败:', error);
      
      // 网络错误等情况下，假设session仍然有效
      return true;
    }
  }

  /**
   * 重置用户session_key
   * 2025-07-25: 实现微信官方resetUserSessionKey接口
   * @param {string} openid - 用户openid
   * @param {string} sessionKey - 当前session_key
   * @returns {Promise<boolean>} 重置是否成功
   */
  async resetUserSessionKey(openid, sessionKey) {
    try {
      console.log('[WechatAPI] 重置用户session_key:', { openid });

      // 演示模式
      if (WECHAT_CONFIG.appid === 'demo_appid') {
        console.log('[WechatAPI] 演示模式，跳过session重置');
        return true;
      }

      // 获取access_token
      const accessToken = await this.getAccessToken();

      // 生成签名
      const signature = crypto
        .createHmac('sha256', sessionKey)
        .update('')
        .digest('hex');

      const params = {
        access_token: accessToken,
        openid: openid,
        signature: signature,
        sig_method: 'hmac_sha256'
      };

      console.log('[WechatAPI] 请求resetUserSessionKey接口');

      const response = await axios.get(WECHAT_API.RESET_SESSION, {
        params,
        timeout: 8000
      });

      const result = response.data;

      console.log('[WechatAPI] resetSession响应:', {
        errcode: result.errcode,
        errmsg: result.errmsg
      });

      if (result.errcode === 0) {
        console.log('[WechatAPI] session_key重置成功');
        return true;
      }

      const errorMsg = WECHAT_ERROR_CODES[result.errcode] || result.errmsg || '重置session失败';
      console.error('[WechatAPI] resetSession失败:', errorMsg);
      return false;

    } catch (error) {
      console.error('[WechatAPI] resetSession异常:', error);
      return false;
    }
  }

  /**
   * 验证用户数据完整性
   * 2025-07-25: 验证从小程序传来的用户数据
   * @param {Object} encryptedData - 加密的用户数据
   * @param {string} iv - 初始向量
   * @param {string} sessionKey - 会话密钥
   * @returns {Object} 解密后的用户数据
   */
  decryptUserData(encryptedData, iv, sessionKey) {
    try {
      console.log('[WechatAPI] 解密用户数据');

      // 演示模式返回模拟数据
      if (WECHAT_CONFIG.appid === 'demo_appid') {
        return {
          nickName: '演示用户',
          gender: 0,
          city: '',
          province: '',
          country: '',
          avatarUrl: '',
          openId: `demo_openid_${Date.now()}`,
          unionId: null
        };
      }

      // Base64解码
      const sessionKeyBuffer = Buffer.from(sessionKey, 'base64');
      const encryptedDataBuffer = Buffer.from(encryptedData, 'base64');
      const ivBuffer = Buffer.from(iv, 'base64');

      // AES-128-CBC解密
      const decipher = crypto.createDecipheriv('aes-128-cbc', sessionKeyBuffer, ivBuffer);
      decipher.setAutoPadding(true);

      let decrypted = decipher.update(encryptedDataBuffer, null, 'utf8');
      decrypted += decipher.final('utf8');

      const decryptedData = JSON.parse(decrypted);

      console.log('[WechatAPI] 用户数据解密成功:', {
        hasNickName: !!decryptedData.nickName,
        hasOpenId: !!decryptedData.openId,
        hasUnionId: !!decryptedData.unionId
      });

      return decryptedData;

    } catch (error) {
      console.error('[WechatAPI] 用户数据解密失败:', error);
      throw new Error('用户数据解密失败，可能session_key已过期');
    }
  }

  /**
   * 获取错误信息
   * 2025-07-25: 将微信错误码转换为用户友好的错误信息
   * @param {number} errcode - 微信错误码
   * @returns {string} 错误信息
   */
  getErrorMessage(errcode) {
    return WECHAT_ERROR_CODES[errcode] || `未知错误 (${errcode})`;
  }

  /**
   * 检查配置有效性
   * 2025-07-25: 验证微信小程序配置是否正确
   * @returns {boolean} 配置是否有效
   */
  isConfigValid() {
    return WECHAT_CONFIG.appid !== 'demo_appid' && 
           WECHAT_CONFIG.secret !== 'demo_secret' &&
           WECHAT_CONFIG.appid && 
           WECHAT_CONFIG.secret;
  }

  /**
   * 获取配置状态
   * 2025-07-25: 获取当前配置状态信息
   * @returns {Object} 配置状态
   */
  getConfigStatus() {
    return {
      isDemo: WECHAT_CONFIG.appid === 'demo_appid',
      hasAppId: !!WECHAT_CONFIG.appid && WECHAT_CONFIG.appid !== 'demo_appid',
      hasSecret: !!WECHAT_CONFIG.secret && WECHAT_CONFIG.secret !== 'demo_secret',
      isValid: this.isConfigValid()
    };
  }
}

// 导出单例实例
module.exports = new WechatApiService();