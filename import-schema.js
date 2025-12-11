const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function importSchema() {
  console.log('📦 Starting database schema import...\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true
    });

    console.log('✅ Connected to database');

    // Read the SQL file
    const sqlFile = path.join(__dirname, 'freesql_deployment.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('📄 Reading SQL file...');
    console.log(`   File size: ${(sql.length / 1024).toFixed(2)} KB`);

    // Split by semicolons and filter out empty statements
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`   Found ${statements.length} SQL statements\n`);
    console.log('⚙️  Executing SQL statements...');

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments
      if (statement.startsWith('--') || statement.length < 10) {
        continue;
      }

      try {
        await connection.execute(statement);
        successCount++;
        
        // Show progress every 10 statements
        if ((i + 1) % 10 === 0) {
          console.log(`   Progress: ${i + 1}/${statements.length} statements executed`);
        }
      } catch (error) {
        errorCount++;
        console.error(`   ⚠️  Error in statement ${i + 1}:`, error.message.substring(0, 100));
        // Continue with other statements
      }
    }

    console.log('\n📊 Import Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);

    // Verify tables were created
    const [tables] = await connection.execute('SHOW TABLES');
    console.log(`\n✅ Database now has ${tables.length} tables:`);
    tables.forEach(table => {
      console.log(`   - ${Object.values(table)[0]}`);
    });

    await connection.end();
    console.log('\n🎉 Schema import completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Import failed:');
    console.error(error);
    process.exit(1);
  }
}

importSchema();
