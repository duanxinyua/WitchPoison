/**
 * 数据库连接测试脚本
 * 创建时间: 2025-07-25
 * 功能: 测试MySQL数据库连接和表结构创建
 */

const { initDatabase, query, closeDatabase } = require('./config/database');

async function testDatabase() {
  console.log('开始数据库连接测试...');
  
  try {
    // 初始化数据库连接
    const success = await initDatabase();
    
    if (!success) {
      console.error('数据库连接失败');
      return;
    }
    
    console.log('数据库连接成功！');
    
    // 测试基本查询
    const result = await query('SELECT 1 as test, NOW() as now_time');
    console.log('测试查询结果:', result);
    
    // 检查表是否存在
    const tables = await query('SHOW TABLES');
    console.log('数据库中的表:', tables);
    
    // 如果没有表，提示需要创建
    if (tables.length === 0) {
      console.log('数据库中没有表，请运行 database/schema.sql 创建表结构');
    }
    
  } catch (error) {
    console.error('数据库测试失败:', error);
  } finally {
    await closeDatabase();
    console.log('数据库连接已关闭');
  }
}

testDatabase();