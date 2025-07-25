/**
 * 数据库初始化脚本
 * 创建时间: 2025-07-25
 * 功能: 直接执行SQL语句创建表结构
 */

const mysql = require('mysql2/promise');

async function initDatabase() {
  console.log('开始初始化数据库...');
  
  const config = {
    host: '49.233.136.85',
    port: 13306,
    user: 'root',
    password: '7HSEG6NB64Cy3ZpH',
    database: 'witch_poison_game',
    connectTimeout: 30000,
    ssl: false
  };
  
  let connection = null;
  
  try {
    connection = await mysql.createConnection(config);
    console.log('数据库连接成功');
    
    // 1. 创建用户表
    console.log('创建用户表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '用户ID',
        openid VARCHAR(128) NOT NULL UNIQUE COMMENT '微信用户openid',
        unionid VARCHAR(128) DEFAULT NULL COMMENT '微信unionid（可选）',
        session_key VARCHAR(128) DEFAULT NULL COMMENT '微信会话密钥',
        nickname VARCHAR(64) NOT NULL COMMENT '用户昵称',
        avatar_url VARCHAR(512) DEFAULT NULL COMMENT '用户头像URL',
        avatar_emoji VARCHAR(10) DEFAULT '😺' COMMENT '游戏内头像emoji',
        gender TINYINT DEFAULT 0 COMMENT '性别 0-未知 1-男 2-女',
        city VARCHAR(64) DEFAULT NULL COMMENT '城市',
        province VARCHAR(64) DEFAULT NULL COMMENT '省份',
        country VARCHAR(64) DEFAULT NULL COMMENT '国家',
        is_guest BOOLEAN DEFAULT FALSE COMMENT '是否为游客模式',
        last_login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '最后登录时间',
        total_games INT DEFAULT 0 COMMENT '总游戏场次',
        total_wins INT DEFAULT 0 COMMENT '总胜利次数',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        
        INDEX idx_openid (openid),
        INDEX idx_unionid (unionid),
        INDEX idx_last_login (last_login_time),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表'
    `);
    
    // 2. 创建房间表
    console.log('创建房间表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS rooms (
        id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '房间自增ID',
        room_id VARCHAR(16) NOT NULL UNIQUE COMMENT '房间号（6位数字或8位UUID）',
        creator_user_id BIGINT NOT NULL COMMENT '房主用户ID',
        room_name VARCHAR(128) DEFAULT NULL COMMENT '房间名称',
        board_size TINYINT DEFAULT 5 COMMENT '棋盘大小 5-10',
        max_players TINYINT DEFAULT 4 COMMENT '最大玩家数 2-5',
        current_players TINYINT DEFAULT 0 COMMENT '当前玩家数',
        status ENUM('waiting', 'settingPoison', 'playing', 'ended', 'waitingForRestart') DEFAULT 'waiting' COMMENT '房间状态',
        game_settings JSON DEFAULT NULL COMMENT '游戏设置（JSON格式）',
        is_active BOOLEAN DEFAULT TRUE COMMENT '房间是否活跃',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        closed_at TIMESTAMP NULL DEFAULT NULL COMMENT '关闭时间',
        
        INDEX idx_room_id (room_id),
        INDEX idx_creator (creator_user_id),
        INDEX idx_status (status),
        INDEX idx_active (is_active),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='房间表'
    `);
    
    // 3. 创建用户会话表
    console.log('创建用户会话表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '会话ID',
        user_id BIGINT NOT NULL COMMENT '用户ID',
        session_token VARCHAR(128) NOT NULL UNIQUE COMMENT '会话令牌',
        client_id VARCHAR(64) DEFAULT NULL COMMENT '客户端ID（WebSocket连接ID）',
        ip_address VARCHAR(45) DEFAULT NULL COMMENT 'IP地址',
        user_agent TEXT DEFAULT NULL COMMENT '用户代理',
        expires_at TIMESTAMP NOT NULL COMMENT '过期时间',
        is_active BOOLEAN DEFAULT TRUE COMMENT '是否活跃',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        
        INDEX idx_user_id (user_id),
        INDEX idx_session_token (session_token),
        INDEX idx_client_id (client_id),
        INDEX idx_expires_at (expires_at),
        INDEX idx_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户会话表'
    `);
    
    // 4. 插入游客用户模板
    console.log('插入初始数据...');
    await connection.execute(`
      INSERT IGNORE INTO users (openid, nickname, is_guest, avatar_emoji) 
      VALUES ('guest_default', '游客用户', TRUE, '😺')
    `);
    
    // 验证表创建
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('创建的表:', tables.map(t => Object.values(t)[0]));
    
    // 检查每个表的结构
    for (const table of tables) {
      const tableName = Object.values(table)[0];
      const [columns] = await connection.execute(`DESCRIBE ${tableName}`);
      console.log(`表 ${tableName} 结构:`, columns.length, '个字段');
    }
    
    console.log('数据库初始化完成！');
    
  } catch (error) {
    console.error('数据库初始化失败:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

initDatabase();