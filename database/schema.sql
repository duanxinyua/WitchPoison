-- 女巫的毒药游戏数据库表结构
-- 创建时间: 2025-07-25
-- 数据库版本: MySQL 9.0
-- 功能: 用户登录、房间管理、游戏记录持久化

-- 创建数据库
CREATE DATABASE IF NOT EXISTS witch_poison_game 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE witch_poison_game;

-- 1. 用户表 - 存储微信小程序用户信息
CREATE TABLE users (
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
    has_customized BOOLEAN DEFAULT FALSE COMMENT '用户是否自定义过昵称和头像',
    custom_nickname VARCHAR(50) DEFAULT NULL COMMENT '用户自定义昵称',
    custom_avatar_emoji VARCHAR(10) DEFAULT NULL COMMENT '用户自定义头像emoji',
    login_ip VARCHAR(45) DEFAULT NULL COMMENT '最后登录IP地址(支持IPv6)',
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后登录时间',
    last_login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '上次登录时间',
    total_games INT DEFAULT 0 COMMENT '总游戏场次',
    total_wins INT DEFAULT 0 COMMENT '总胜利次数',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    INDEX idx_openid (openid),
    INDEX idx_unionid (unionid),
    INDEX idx_has_customized (has_customized),
    INDEX idx_login_ip (login_ip),
    INDEX idx_last_login (last_login_time),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 2. 房间表 - 存储游戏房间信息
CREATE TABLE rooms (
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
    
    FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_room_id (room_id),
    INDEX idx_creator (creator_user_id),
    INDEX idx_status (status),
    INDEX idx_active (is_active),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='房间表';

-- 3. 房间玩家表 - 存储房间内的玩家信息
CREATE TABLE room_players (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '记录ID',
    room_id BIGINT NOT NULL COMMENT '房间ID',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    player_index TINYINT NOT NULL COMMENT '玩家索引（0-4）',
    nickname VARCHAR(64) NOT NULL COMMENT '玩家昵称',
    avatar_emoji VARCHAR(10) DEFAULT '😺' COMMENT '玩家头像emoji',
    is_room_owner BOOLEAN DEFAULT FALSE COMMENT '是否为房主',
    is_ready BOOLEAN DEFAULT FALSE COMMENT '是否准备就绪',
    poison_position JSON DEFAULT NULL COMMENT '毒药位置 {x: number, y: number}',
    is_eliminated BOOLEAN DEFAULT FALSE COMMENT '是否已出局',
    join_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '加入时间',
    leave_time TIMESTAMP NULL DEFAULT NULL COMMENT '离开时间',
    
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_room_user (room_id, user_id),
    INDEX idx_room_id (room_id),
    INDEX idx_user_id (user_id),
    INDEX idx_join_time (join_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='房间玩家表';

-- 4. 游戏记录表 - 存储完整的游戏过程
CREATE TABLE game_records (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '游戏记录ID',
    room_id BIGINT NOT NULL COMMENT '房间ID',
    game_number INT DEFAULT 1 COMMENT '房间内游戏轮次',
    board_size TINYINT NOT NULL COMMENT '棋盘大小',
    total_players TINYINT NOT NULL COMMENT '参与玩家数',
    winner_user_id BIGINT DEFAULT NULL COMMENT '获胜者用户ID',
    game_duration INT DEFAULT 0 COMMENT '游戏时长（秒）',
    total_moves INT DEFAULT 0 COMMENT '总移动次数',
    game_data JSON DEFAULT NULL COMMENT '游戏详细数据（棋盘状态、移动记录等）',
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '游戏开始时间',
    end_time TIMESTAMP NULL DEFAULT NULL COMMENT '游戏结束时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
    
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (winner_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_room_id (room_id),
    INDEX idx_winner (winner_user_id),
    INDEX idx_start_time (start_time),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='游戏记录表';

-- 5. 游戏玩家记录表 - 存储游戏中每个玩家的详细表现
CREATE TABLE game_player_records (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '记录ID',
    game_record_id BIGINT NOT NULL COMMENT '游戏记录ID',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    player_index TINYINT NOT NULL COMMENT '玩家索引',
    nickname VARCHAR(64) NOT NULL COMMENT '玩家昵称',
    avatar_emoji VARCHAR(10) DEFAULT '😺' COMMENT '玩家头像',
    poison_position JSON NOT NULL COMMENT '毒药位置',
    moves_made INT DEFAULT 0 COMMENT '移动次数',
    is_winner BOOLEAN DEFAULT FALSE COMMENT '是否获胜',
    elimination_order TINYINT DEFAULT NULL COMMENT '出局顺序（1-最先出局）',
    performance_score INT DEFAULT 0 COMMENT '表现分数',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    FOREIGN KEY (game_record_id) REFERENCES game_records(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_game_record (game_record_id),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='游戏玩家记录表';

-- 6. 用户会话表 - 管理用户登录会话
CREATE TABLE user_sessions (
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
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_session_token (session_token),
    INDEX idx_client_id (client_id),
    INDEX idx_expires_at (expires_at),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户会话表';

-- 创建一些初始数据（可选）
-- 插入游客用户模板
INSERT INTO users (openid, nickname, is_guest, avatar_emoji) VALUES 
('guest_default', '游客用户', TRUE, '😺');

-- 查看表结构
SHOW TABLES;