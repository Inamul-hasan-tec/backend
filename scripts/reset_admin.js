const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function resetSuperAdminPassword() {
  let connection;
  try {
    const dbConfig = {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.DB_HOST.includes('aiven') ? {
        rejectUnauthorized: false
      } : undefined
    };

    console.log(`Connecting to ${dbConfig.host}...`);
    connection = await mysql.createConnection(dbConfig);

    const email = process.env.SUPER_ADMIN_EMAIL;
    const plainPassword = process.env.SUPER_ADMIN_PASSWORD;

    if (!email || !plainPassword || plainPassword.length < 12) {
      throw new Error(
        'Set SUPER_ADMIN_EMAIL and a SUPER_ADMIN_PASSWORD of at least 12 characters'
      );
    }
    
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(plainPassword, salt);
    
    // Check if super admin exists
    const [rows] = await connection.execute('SELECT * FROM users WHERE email = ?', [email]);
    
    if (rows.length === 0) {
      console.log(`User ${email} not found. Creating Super Admin...`);
      // Create if it doesn't exist
      await connection.execute(
        `INSERT INTO users (name, email, password, is_super_admin, status) 
         VALUES ('Super Admin', ?, ?, TRUE, 'active')`,
        [email, hashedPassword]
      );
      console.log(`✅ Super Admin created with password: ${plainPassword}`);
    } else {
      // Update existing
      console.log(`User ${email} found. Resetting password...`);
      await connection.execute(
        'UPDATE users SET password = ?, is_super_admin = TRUE WHERE email = ?',
        [hashedPassword, email]
      );
      console.log(`✅ Super Admin password reset successfully to: ${plainPassword}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

resetSuperAdminPassword();
