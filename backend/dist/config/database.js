"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testConnection = void 0;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const pool = new pg_1.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'stock_inventory',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
});
const testConnection = async () => {
    try {
        const client = await pool.connect();
        console.log('Database connected successfully');
        client.release();
    }
    catch (error) {
        console.error('Database connection error:', error);
        console.log('Trying to create database if it does not exist...');
        const adminPool = new pg_1.Pool({
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: 'postgres',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || '',
        });
        try {
            const adminClient = await adminPool.connect();
            await adminClient.query(`CREATE DATABASE ${process.env.DB_NAME || 'stock_inventory'}`);
            adminClient.release();
            console.log('Database created successfully');
        }
        catch (createError) {
            console.error('Failed to create database:', createError);
        }
        adminPool.end();
    }
};
exports.testConnection = testConnection;
exports.default = pool;
//# sourceMappingURL=database.js.map