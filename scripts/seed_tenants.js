const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '3306'),
  ssl: {
    rejectUnauthorized: false
  }
};

const tenantsData = [
  {
    name: "Grand Palace Hall",
    slug: "grand-palace",
    users: [
      { name: "Grand Admin", email: "admin@grandpalace.com", role: "admin" },
      { name: "Grand Manager", email: "manager@grandpalace.com", role: "staff_1" },
      { name: "Grand Staff", email: "staff@grandpalace.com", role: "staff_2" }
    ],
    halls: [
      { name: "Main Hall A", capacity: 500, price_per_day: 50000 },
      { name: "Lawn Area", capacity: 1000, price_per_day: 75000 }
    ],
    packages: [
      { name: "Premium Wedding Package", base_price: 150000, description: "Includes decoration, catering, and hall." }
    ],
    customers: [
      { name: "Rahul Sharma", email: "rahul@example.com", phone: "9876543210" },
      { name: "Priya Patel", email: "priya@example.com", phone: "9876543211" }
    ]
  },
  {
    name: "Royal Gardens",
    slug: "royal-gardens",
    users: [
      { name: "Royal Admin", email: "admin@royalgardens.com", role: "admin" },
      { name: "Royal Manager", email: "manager@royalgardens.com", role: "staff_1" },
      { name: "Royal Staff", email: "staff@royalgardens.com", role: "staff_2" }
    ],
    halls: [
      { name: "Royal Ballroom", capacity: 800, price_per_day: 100000 }
    ],
    packages: [
      { name: "Standard Wedding Package", base_price: 100000, description: "Includes standard decoration and seating." }
    ],
    customers: [
      { name: "Amit Kumar", email: "amit@example.com", phone: "9876543212" }
    ]
  },
  {
    name: "Silver Banquet",
    slug: "silver-banquet",
    users: [
      { name: "Silver Admin", email: "admin@silverbanquet.com", role: "admin" },
      { name: "Silver Manager", email: "manager@silverbanquet.com", role: "staff_1" },
      { name: "Silver Staff", email: "staff@silverbanquet.com", role: "staff_2" }
    ],
    halls: [
      { name: "Silver Hall", capacity: 300, price_per_day: 30000 }
    ],
    packages: [
      { name: "Budget Birthday Package", base_price: 25000, description: "Includes basic lighting and sound system." }
    ],
    customers: [
      { name: "Neha Singh", email: "neha@example.com", phone: "9876543213" }
    ]
  }
];

async function seedData() {
  console.log('🌱 Starting tenant seeding process...');
  const seedPassword = process.env.SEED_USER_PASSWORD;
  if (!seedPassword || seedPassword.length < 12) {
    throw new Error('SEED_USER_PASSWORD must be set to at least 12 characters');
  }
  const connection = await mysql.createConnection(dbConfig);
  const passwordHash = await bcrypt.hash(seedPassword, 10);

  try {
    console.log('🔧 Updating user_tenants schema to support staff_1 and staff_2...');
    await connection.query("ALTER TABLE user_tenants MODIFY COLUMN role ENUM('admin', 'manager', 'staff', 'staff_1', 'staff_2', 'viewer') DEFAULT 'staff_2'");

    console.log('🧹 Cleaning up old dummy data...');
    const emails = tenantsData.flatMap(t => t.users.map(u => u.email));
    const slugs = tenantsData.map(t => t.slug);
    
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    if (emails.length > 0) {
      await connection.query('DELETE FROM users WHERE email IN (?)', [emails]);
    }
    if (slugs.length > 0) {
      await connection.query('DELETE FROM tenants WHERE slug IN (?)', [slugs]);
    }
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    for (const tenant of tenantsData) {
      console.log(`\nCreating tenant: ${tenant.name}...`);
      
      // 1. Create Tenant
      const [tenantResult] = await connection.query(
        'INSERT INTO tenants (name, slug, status, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
        [tenant.name, tenant.slug, 'active']
      );
      const tenantId = tenantResult.insertId;
      console.log(`✅ Tenant created with ID: ${tenantId}`);

      // 2. Create Users for Tenant
      for (const user of tenant.users) {
        const [userResult] = await connection.query(
          'INSERT INTO users (name, email, password, status, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
          [user.name, user.email, passwordHash, 'active']
        );
        const userId = userResult.insertId;

        await connection.query(
          'INSERT INTO user_tenants (user_id, tenant_id, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
          [userId, tenantId, user.role, true]
        );
        console.log(`  👤 Created ${user.role}: ${user.email}`);
      }

      // 3. Create Packages
      const packageIds = [];
      if (tenant.packages) {
        for (const pkg of tenant.packages) {
          const [pkgResult] = await connection.query(
            'INSERT INTO packages (tenant_id, name, base_price, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
            [tenantId, pkg.name, pkg.base_price, pkg.description, 'active']
          );
          packageIds.push(pkgResult.insertId);
          console.log(`  📦 Created Package: ${pkg.name}`);
        }
      }

      // 4. Create Halls
      const hallIds = [];
      for (const hall of tenant.halls) {
        const [hallResult] = await connection.query(
          'INSERT INTO halls (tenant_id, name, capacity, base_price, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
          [tenantId, hall.name, hall.capacity, hall.price_per_day, 'active']
        );
        const hallId = hallResult.insertId;
        hallIds.push(hallId);
        console.log(`  🏛️ Created Hall: ${hall.name}`);

        // 4.1 Create Slots for this Hall for the next 7 days
        for (let i = 0; i < 7; i++) {
          const slotDate = new Date();
          slotDate.setDate(slotDate.getDate() + i);
          const dateStr = slotDate.toISOString().split('T')[0];
          
          await connection.query(
            "INSERT INTO slots (tenant_id, hall_id, slot_date, slot_type, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())",
            [tenantId, hallId, dateStr, 'morning', 'available']
          );
          await connection.query(
            "INSERT INTO slots (tenant_id, hall_id, slot_date, slot_type, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())",
            [tenantId, hallId, dateStr, 'afternoon', 'available']
          );
          await connection.query(
            "INSERT INTO slots (tenant_id, hall_id, slot_date, slot_type, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())",
            [tenantId, hallId, dateStr, 'night', 'available']
          );
        }
        console.log(`  🕒 Created Slots for next 7 days for ${hall.name}`);
      }

      // 5. Create Customers
      const customerIds = [];
      for (const customer of tenant.customers) {
        const [customerResult] = await connection.query(
          'INSERT INTO customers (tenant_id, name, email, phone, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
          [tenantId, customer.name, customer.email, customer.phone]
        );
        customerIds.push(customerResult.insertId);
        console.log(`  👥 Created Customer: ${customer.name}`);
      }

      // 6. Create Bookings & Payments
      if (hallIds.length > 0 && customerIds.length > 0) {
        const hallId = hallIds[0];
        const customerId = customerIds[0];
        const packageId = packageIds.length > 0 ? packageIds[0] : null;
        
        // Future booking (tomorrow)
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 1); 
        const futureDateStr = futureDate.toISOString().split('T')[0];
        
        const [bookingResult] = await connection.query(
          `INSERT INTO bookings (
            tenant_id, customer_id, hall_id, package_id, event_date, time_slot,
            status, total_amount, advance_amount, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [tenantId, customerId, hallId, packageId, futureDateStr, 'morning', 'confirmed', 50000, 10000]
        );
        const bookingId = bookingResult.insertId;
        console.log(`  📅 Created Future Booking for ${tenant.name}`);

        // Update the slot to 'booked' for this booking
        await connection.query(
          "UPDATE slots SET status = 'booked', booking_id = ? WHERE tenant_id = ? AND hall_id = ? AND slot_date = ? AND slot_type = 'morning'",
          [bookingId, tenantId, hallId, futureDateStr]
        );

        // 6.1 Create Payment
        await connection.query(
          `INSERT INTO payments (
            tenant_id, booking_id, amount, payment_mode, payment_type, payment_date, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [tenantId, bookingId, 10000, 'cash', 'advance', new Date()]
        );
        console.log(`  💳 Created Payment for Booking ID: ${bookingId}`);

        // 6.2 Create Invoice
        await connection.query(
          `INSERT INTO invoices (
            tenant_id, invoice_number, invoice_type, invoice_date, booking_id, customer_id,
            subtotal, taxable_amount, total_tax, grand_total, amount_paid, balance_amount, payment_status, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            tenantId, `INV-${tenant.slug}-${bookingId}`, 'tax_invoice', new Date(), bookingId, customerId,
            50000, 50000, 0, 50000, 10000, 40000, 'partial', 'issued'
          ]
        );
        console.log(`  🧾 Created Invoice for Booking ID: ${bookingId}`);
      }
    }

    console.log('\n🎉 Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await connection.end();
  }
}

seedData();
