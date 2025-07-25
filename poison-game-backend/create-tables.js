/**
 * 创建数据库表结构脚本
 * 创建时间: 2025-07-25
 * 功能: 执行SQL脚本创建所需的数据库表
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

async function createTables() {
  console.log('开始创建数据库表结构...');
  
  const config = {
    host: '49.233.136.85',
    port: 13306,
    user: 'root',
    password: '7HSEG6NB64Cy3ZpH',
    database: 'witch_poison_game',
    multipleStatements: true,
    connectTimeout: 30000,
    ssl: false
  };
  
  let connection = null;
  
  try {
    // 读取SQL文件
    const sqlFilePath = path.join(__dirname, '..', 'database', 'schema.sql');
    console.log('读取SQL文件:', sqlFilePath);
    
    const sqlContent = await fs.readFile(sqlFilePath, 'utf8');
    console.log('SQL文件内容长度:', sqlContent.length, '字符');
    
    // 连接数据库
    connection = await mysql.createConnection(config);
    console.log('数据库连接成功');
    
    // 执行SQL脚本 - 分割成多个语句执行
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('/*'));
    
    console.log('准备执行', statements.length, '条SQL语句');
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.includes('CREATE DATABASE') || statement.includes('USE ')) {
        continue; // 跳过数据库创建和USE语句
      }
      
      try {
        console.log(`执行第${i + 1}条语句:`, statement.substring(0, 60) + '...');
        await connection.execute(statement);
        console.log(`第${i + 1}条语句执行成功`);
      } catch (error) {
        console.error(`第${i + 1}条语句执行失败:`, error.message);
        if (error.code !== 'ER_TABLE_EXISTS_ERROR') {
          throw error;
        }
      }
    }
    
    // 验证表创建
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('创建的表:', tables.map(t => t[`Tables_in_witch_poison_game`]));
    
    console.log('数据库表结构创建完成！');
    
  } catch (error) {
    console.error('创建表结构失败:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

createTables();