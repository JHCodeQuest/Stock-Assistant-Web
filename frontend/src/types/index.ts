export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category: string;
  unit_price: number;
  cost_price: number;
  barcode?: string;
  min_stock_level: number;
  created_at: string;
}

export interface StockItem {
  id: string;
  product: Product;
  quantity: number;
  location?: string;
  last_updated: string;
}

export interface InventoryTransaction {
  id: string;
  product_id: string;
  transaction_type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity_change: number;
  reference?: string;
  notes?: string;
  created_by: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_email?: string;
  phone?: string;
  address?: string;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  address?: string;
  capacity?: number;
}

export interface InventoryMetrics {
  totalProducts: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  recentTransactions: number;
}
