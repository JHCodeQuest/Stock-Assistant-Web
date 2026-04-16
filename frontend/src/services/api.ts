import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://stock-assistant-api-3x6i.onrender.com/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth endpoints
export const login = (credentials: { email: string; password: string }) =>
  api.post('/auth/login', credentials);

export const register = (userData: any) => 
  api.post('/auth/register', userData);

// Product endpoints
export const getProducts = () => api.get('/products');
export const createProduct = (productData: any) => 
  api.post('/products', productData);
export const updateProduct = (id: string, productData: any) => 
  api.put(`/products/${id}`, productData);
export const deleteProduct = (id: string) => api.delete(`/products/${id}`);

// Inventory endpoints
export const getInventory = () => api.get('/inventory');
export const searchInventory = (query: string) => api.get(`/inventory/search?query=${encodeURIComponent(query)}`);
export const matchImage = (filename: string) => api.post('/inventory/match-image', { filename });
export const addInventory = (item: {
  name: string;
  sku: string;
  quantity: number;
  min_stock_level?: number;
  category?: string;
  location?: string;
  image_url?: string;
  description?: string;
}) => api.post('/inventory/add', item);
export const adjustStock = (adjustmentData: {
  productId: string;
  adjustmentType: 'add' | 'remove' | 'set';
  quantity: number;
  reason: string;
}) => api.post('/inventory/adjust', adjustmentData);

export const getInventoryHistory = (productId: string) =>
  api.get(`/inventory/history/${productId}`);

export const getLowStockItems = () => api.get('/inventory/low-stock');

// Dashboard metrics
export const getInventoryMetrics = () => api.get('/dashboard/metrics');

export default api;
