import axios from 'axios';
import { clearSession } from './session';

import { API_URL, resolveImageUrl } from './urls';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) clearSession();
    return Promise.reject(error);
  }
);

// Auth endpoints
export const login = (credentials: { email: string; password: string }) =>
  api.post('/auth/login', credentials);

export const register = (userData: any) => 
  api.post('/auth/register', userData);

export const uploadImage = async (file: File) => {
  const formData = new FormData();
  formData.append('image', file);
  const response = await api.post('/upload', formData, {
    headers: { 'Content-Type': undefined },
  });
  return resolveImageUrl(response.data.url);
};

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
