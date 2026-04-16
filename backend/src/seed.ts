import bcrypt from 'bcryptjs';
import pool from './config/database';
import jwt from 'jsonwebtoken';

const seed = async () => {
  try {
    console.log('Seeding database...');

    const email = 'test@example.com';
    const password = 'password123';
    const name = 'Test User';

    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (existingUser.rows.length === 0) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      await pool.query(
        'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4)',
        [email, hashedPassword, name, 'admin']
      );
      
      console.log(`Test user created: ${email} / ${password}`);
    } else {
      console.log(`Test user already exists: ${email}`);
    }

    const sampleInventory = [
      { name: 'Hex Bolt M8', sku: 'BLT-HX-001', quantity: 500, min_stock_level: 100, category: 'Fasteners', location: 'A-1-1' },
      { name: 'Flat Head Screw', sku: 'SCW-FH-002', quantity: 1000, min_stock_level: 200, category: 'Fasteners', location: 'A-1-2' },
      { name: 'Rubber Gasket', sku: 'GAS-RB-001', quantity: 50, min_stock_level: 25, category: 'Seals', location: 'B-2-1' },
      { name: 'Steel Pipe 2"', sku: 'PIP-ST-001', quantity: 25, min_stock_level: 10, category: 'Plumbing', location: 'C-1-3' },
      { name: 'Copper Wire 12AWG', sku: 'WIR-CU-012', quantity: 100, min_stock_level: 50, category: 'Electrical', location: 'D-1-1' },
    ];

    for (const item of sampleInventory) {
      const existing = await pool.query('SELECT id FROM inventory WHERE sku = $1', [item.sku]);
      if (existing.rows.length === 0) {
        await pool.query(
          'INSERT INTO inventory (name, sku, quantity, min_stock_level, category, location) VALUES ($1, $2, $3, $4, $5, $6)',
          [item.name, item.sku, item.quantity, item.min_stock_level, item.category, item.location]
        );
        console.log(`Added inventory: ${item.name}`);
      }
    }

    console.log('Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seed();
