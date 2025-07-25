/**
 * 简单数据库连接测试
 * 创建时间: 2025-07-25
 * 功能: 测试基本的MySQL连接
 */

const mysql = require('mysql2/promise');

async function testConnection() {
  console.log('开始简单数据库连接测试...');
  
  const config = {
    host: '49.233.136.85',
    port: 13306,
    user: 'root',
    password: '7HSEG6NB64Cy3ZpH',
    connectTimeout: 30000,
    ssl: false
  };
  
  let connection = null;
  
  try {
    console.log('尝试连接到数据库服务器...');
    connection = await mysql.createConnection(config);
    console.log('数据库服务器连接成功！');
    
    // 测试查询
    const [rows] = await connection.execute('SELECT VERSION() as version, NOW() as now_time');
    console.log('MySQL版本信息:', rows[0]);
    
    // 检查数据库是否存在
    const [databases] = await connection.execute('SHOW DATABASES');
    console.log('可用数据库:', databases.map(db => db.Database));
    
    // 尝试选择目标数据库
    try {
      await connection.execute('USE witch_poison_game');
      console.log('成功选择数据库 witch_poison_game');
      
      // 检查表
      const [tables] = await connection.execute('SHOW TABLES');
      console.log('数据库中的表:', tables);
      
    } catch (dbError) {
      console.log('数据库 witch_poison_game 不存在，需要创建');
      
      // 创建数据库
      await connection.execute('CREATE DATABASE IF NOT EXISTS witch_poison_game CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
      console.log('数据库 witch_poison_game 创建成功');
    }
    
  } catch (error) {
    console.error('数据库连接失败:', error.message);
    console.error('错误代码:', error.code);
    console.error('完整错误:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

testConnection();