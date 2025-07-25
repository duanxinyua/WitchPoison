-- 更新用户表结构，添加自定义信息和IP记录字段
-- 创建时间: 2025-07-25
-- 功能: 支持用户信息层级化管理和登录IP记录

USE witch_poison_game;

-- 添加用户自定义信息字段
ALTER TABLE users 
ADD COLUMN has_customized BOOLEAN DEFAULT FALSE COMMENT '用户是否自定义过昵称和头像',
ADD COLUMN custom_nickname VARCHAR(50) NULL COMMENT '用户自定义昵称',
ADD COLUMN custom_avatar_emoji VARCHAR(10) NULL COMMENT '用户自定义头像emoji',
ADD COLUMN login_ip VARCHAR(45) NULL COMMENT '最后登录IP地址(支持IPv6)',
ADD COLUMN login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后登录时间';

-- 为has_customized字段添加索引，用于快速查询
ALTER TABLE users ADD INDEX idx_has_customized (has_customized);

-- 为login_ip字段添加索引，用于IP分析
ALTER TABLE users ADD INDEX idx_login_ip (login_ip);

-- 显示更新后的表结构
DESCRIBE users;