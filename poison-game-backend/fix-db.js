/**
 * 修复数据库表结构
 * 创建时间: 2025-07-25
 * 功能: 修改session_token字段长度
 */

const mysql = require('mysql2/promise');

async function fixDatabase() {
  console.log('开始修复数据库表结构...');
  
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
    
    // 修改session_token字段长度
    console.log('修改session_token字段长度...');
    await connection.execute(`
      ALTER TABLE user_sessions 
      MODIFY COLUMN session_token VARCHAR(512) NOT NULL UNIQUE COMMENT '会话令牌'
    `);
    
    console.log('数据库表结构修复完成！');
    
  } catch (error) {
    console.error('数据库修复失败:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

fixDatabase();