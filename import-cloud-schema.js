const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function importSchema() {
  console.log('📦 Starting cloud database schema import...\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true
    });

    console.log('✅ Connected to FreeSQLDatabase');
    console.log(`   Host: ${process.env.DB_HOST}`);
    console.log(`   Database: ${process.env.DB_NAME}\n`);

    // Read the SQL file
    const sqlFile = path.join(__dirname, 'cloud_schema.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('📄 Reading SQL file...');
    console.log(`   File size: ${(sql.length / 1024).toFixed(2)} KB\n`);

    console.log('⚙️  Executing schema...');
    
    // Execute the entire SQL file
    await connection.query(sql);
    
    console.log('✅ Schema executed successfully!\n');

    // Verify tables were created
    const [tables] = await connection.execute('SHOW TABLES');
    console.log(`📊 Database now has ${tables.length} tables:`);
    tables.forEach(table => {
      console.log(`   ✓ ${Object.values(table)[0]}`);
    });

    // Check row counts
    console.log('\n📈 Initial data:');
    const [users] = await connection.execute('SELECT COUNT(*) as count FROM users');
    const [halls] = await connection.execute('SELECT COUNT(*) as count FROM halls');
    const [packages] = await connection.execute('SELECT COUNT(*) as count FROM packages');
    
    console.log(`   Users: ${users[0].count}`);
    console.log(`   Halls: ${halls[0].count}`);
    console.log(`   Packages: ${packages[0].count}`);

    await connection.end();
    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n📝 Default Admin Credentials:');
    console.log('   Email: admin@hallsync.com');
    console.log('   Password: admin123');
    console.log('\n⚠️  Remember to change the admin password after first login!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Import failed:');
    console.error(error.message);
    if (error.sql) {
      console.error('\nFailed SQL:', error.sql.substring(0, 200));
    }
    process.exit(1);
  }
}

importSchema();
