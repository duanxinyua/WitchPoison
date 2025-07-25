/**
 * 数据库配置模块
 * 创建时间: 2025-07-25
 * 最后修改: 2025-07-25 by Claude
 * 功能: MySQL 9.0数据库连接配置和连接池管理
 * 特性: 
 * - 支持连接池
 * - 自动重连
 * - 错误处理
 * - 调试日志
 */

const mysql = require('mysql2/promise');

// 数据库配置 - 2025-07-25: 使用环境变量配置MySQL9.0数据库连接（安全考虑）
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'witch_poison_game',
  charset: 'utf8mb4',
  // 连接池配置
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 5,
  queueLimit: 0,
  // MySQL 9.0 兼容性配置
  ssl: false,
  // 移除已弃用的配置选项
  // connectTimeout, acquireTimeout, timeout 在新版本中不再支持
};

// 创建连接池
let pool = null;

/**
 * 初始化数据库连接池
 * 2025-07-25: 创建MySQL连接池，支持自动重连和错误处理
 * @returns {Promise<boolean>} 初始化是否成功
 */
async function initDatabase() {
  try {
    console.log('[Database] 正在初始化数据库连接池...');
    console.log('[Database] 连接配置:', {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      database: dbConfig.database
    });

    // 创建连接池
    pool = mysql.createPool(dbConfig);

    // 测试连接
    const connection = await pool.getConnection();
    console.log('[Database] 数据库连接成功!');
    
    // 测试查询
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('[Database] 数据库测试查询成功:', rows);
    
    // 释放连接
    connection.release();
    
    // 设置连接池事件监听
    pool.on('connection', (connection) => {
      console.log('[Database] 新的数据库连接建立:', connection.threadId);
    });
    
    pool.on('error', (err) => {
      console.error('[Database] 连接池错误:', err);
      if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log('[Database] 数据库连接丢失，尝试重新连接...');
        setTimeout(initDatabase, 2000);
      }
    });

    return true;
  } catch (error) {
    console.error('[Database] 数据库初始化失败:', error);
    console.error('[Database] 错误详情:', {
      code: error.code,
      errno: error.errno,
      sqlMessage: error.sqlMessage,
      sqlState: error.sqlState
    });
    return false;
  }
}

/**
 * 获取数据库连接
 * 2025-07-25: 从连接池获取数据库连接
 * @returns {Promise<Connection>} 数据库连接对象
 */
async function getConnection() {
  if (!pool) {
    throw new Error('数据库连接池未初始化');
  }
  return await pool.getConnection();
}

/**
 * 执行SQL查询
 * 2025-07-25: 封装数据库查询操作，自动处理连接获取和释放
 * @param {string} sql - SQL查询语句
 * @param {Array} params - 查询参数
 * @returns {Promise<Array>} 查询结果
 */
async function query(sql, params = []) {
  let connection = null;
  try {
    connection = await getConnection();
    console.log('[Database] 执行SQL:', sql);
    console.log('[Database] 参数:', params);
    
    const [rows, fields] = await connection.execute(sql, params);
    console.log('[Database] 查询成功，返回', Array.isArray(rows) ? rows.length : '1', '条记录');
    
    return rows;
  } catch (error) {
    console.error('[Database] SQL查询失败:', error);
    console.error('[Database] SQL语句:', sql);
    console.error('[Database] 参数:', params);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * 执行事务
 * 2025-07-25: 封装数据库事务操作
 * @param {Function} transactionFn - 事务执行函数
 * @returns {Promise<any>} 事务执行结果
 */
async function transaction(transactionFn) {
  let connection = null;
  try {
    connection = await getConnection();
    await connection.beginTransaction();
    console.log('[Database] 开始事务');
    
    const result = await transactionFn(connection);
    
    await connection.commit();
    console.log('[Database] 事务提交成功');
    
    return result;
  } catch (error) {
    if (connection) {
      await connection.rollback();
      console.log('[Database] 事务回滚');
    }
    console.error('[Database] 事务执行失败:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

/**
 * 关闭数据库连接池
 * 2025-07-25: 优雅关闭数据库连接池
 */
async function closeDatabase() {
  if (pool) {
    console.log('[Database] 正在关闭数据库连接池...');
    await pool.end();
    pool = null;
    console.log('[Database] 数据库连接池已关闭');
  }
}

/**
 * 检查数据库连接状态
 * 2025-07-25: 检查数据库连接是否正常
 * @returns {Promise<boolean>} 连接是否正常
 */
async function checkConnection() {
  try {
    const result = await query('SELECT 1 as status');
    return result && result.length > 0;
  } catch (error) {
    console.error('[Database] 连接检查失败:', error);
    return false;
  }
}

// 导出模块
module.exports = {
  initDatabase,
  getConnection,
  query,
  transaction,
  closeDatabase,
  checkConnection
};