#!/bin/bash

# 1. Setup PostgreSQL
echo "Setting up PostgreSQL..."
sudo -u postgres psql -c "CREATE USER joe WITH PASSWORD 'password123' SUPERUSER;"
sudo -u postgres createdb -O joe stock_inventory

# 2. Setup Backend
echo "Setting up backend..."
cd backend
npm install
cp .env.example .env

# 3. Setup Frontend
echo "Setting up frontend..."
cd ../frontend
npm install

echo "Setup complete!"
echo "1. Start PostgreSQL: sudo service postgresql start"
echo "2. Start backend: cd backend && npm run dev"
echo "3. Start frontend: cd frontend && npm start"
