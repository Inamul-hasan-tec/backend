const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hall_sync',
  multipleStatements: true // REQUIRED to run SQL files with multiple statements
};

async function initDB() {
  console.log('Connecting to database:', dbConfig.host);
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected successfully!');

    const sqlFilePath = path.join(__dirname, '../database/schema_v2.sql');
    const sql = fs.readFileSync(sqlFilePath, 'utf8');

    console.log('Executing schema_v2.sql...');
    await connection.query(sql);
    
    console.log('✅ Database initialization complete! V2 Schema applied.');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

initDB();
