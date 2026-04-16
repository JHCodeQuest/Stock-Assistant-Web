import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'stock_inventory',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

// Test connection
export const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('Database connected successfully');
    client.release();
  } catch (error) {
    console.error('Database connection error:', error);
    console.log('Trying to create database if it does not exist...');
    
    // Try to create database if it doesn't exist
    const adminPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: 'postgres',  // Connect to default database
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
    });
    
    try {
      const adminClient = await adminPool.connect();
      await adminClient.query(`CREATE DATABASE ${process.env.DB_NAME || 'stock_inventory'}`);
      adminClient.release();
      console.log('Database created successfully');
    } catch (createError) {
      console.error('Failed to create database:', createError);
    }
    
    adminPool.end();
  }
};

export default pool;
