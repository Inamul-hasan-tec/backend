const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnection() {
  console.log('🔍 Testing database connection...\n');
  console.log('Configuration:');
  console.log(`Host: ${process.env.DB_HOST}`);
  console.log(`Port: ${process.env.DB_PORT}`);
  console.log(`User: ${process.env.DB_USER}`);
  console.log(`Database: ${process.env.DB_NAME}\n`);

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });

    console.log('✅ Successfully connected to the database!');
    
    // Test query
    const [rows] = await connection.execute('SELECT 1 + 1 AS result');
    console.log('✅ Test query successful:', rows[0]);
    
    // Check if tables exist
    const [tables] = await connection.execute('SHOW TABLES');
    console.log(`\n📊 Found ${tables.length} tables in database:`);
    tables.forEach(table => {
      console.log(`  - ${Object.values(table)[0]}`);
    });

    await connection.end();
    console.log('\n✅ Connection test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error('Error:', error.message);
    console.error('\nPlease check:');
    console.error('1. Database credentials are correct');
    console.error('2. Database server is accessible');
    console.error('3. Firewall/network settings allow connection');
    process.exit(1);
  }
}

testConnection();
