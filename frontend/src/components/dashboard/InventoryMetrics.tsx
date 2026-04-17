import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getInventory } from '../../services/api';
import { CardSkeleton } from '../common/Loading';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const InventoryMetrics: React.FC = () => {
  const { data: inventory, isLoading, error } = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const response = await getInventory();
      return response.data;
    },
    refetchInterval: 30000,
  });

  const totalProducts = inventory?.length || 0;
  const lowStockItems = inventory?.filter((item: any) => 
    item.quantity > 0 && item.quantity <= (item.min_stock_level || 10)
  ).length || 0;
  const outOfStockItems = inventory?.filter((item: any) => 
    item.quantity === 0
  ).length || 0;
  const totalValue = inventory?.reduce((sum: number, item: any) => 
    sum + (item.quantity * (parseFloat(item.unit_price) || 0)), 0
  ) || 0;

  const barData = {
    labels: ['Total', 'Low Stock', 'Out of Stock'],
    datasets: [
      {
        label: 'Inventory Count',
        data: [totalProducts, lowStockItems, outOfStockItems],
        backgroundColor: ['#3B82F6', '#F59E0B', '#EF4444'],
        borderRadius: 8,
      },
    ],
  };

  const categoryData = {
    labels: inventory?.reduce((acc: string[], item: any) => {
      if (item.category && !acc.includes(item.category)) acc.push(item.category);
      return acc;
    }, []) || [],
    datasets: [
      {
        data: inventory?.reduce((acc: { [key: string]: number }, item: any) => {
          if (item.category) {
            acc[item.category] = (acc[item.category] || 0) + item.quantity;
          }
          return acc;
        }, {}) ? Object.values(inventory.reduce((acc: { [key: string]: number }, item: any) => {
          if (item.category) {
            acc[item.category] = (acc[item.category] || 0) + item.quantity;
          }
          return acc;
        }, {})) : [],
        backgroundColor: [
          '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
          '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
        ],
      },
    ],
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-red-500">
        Failed to load metrics. Please refresh.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl shadow-sm">
          <p className="text-blue-600 text-sm font-medium">Total Products</p>
          <p className="text-3xl font-bold text-blue-700 mt-1">{totalProducts}</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-xl shadow-sm">
          <p className="text-yellow-600 text-sm font-medium">Low Stock</p>
          <p className="text-3xl font-bold text-yellow-700 mt-1">{lowStockItems}</p>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl shadow-sm">
          <p className="text-red-600 text-sm font-medium">Out of Stock</p>
          <p className="text-3xl font-bold text-red-700 mt-1">{outOfStockItems}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl shadow-sm">
          <p className="text-green-600 text-sm font-medium">Total Value</p>
          <p className="text-3xl font-bold text-green-700 mt-1">${totalValue.toFixed(2)}</p>
        </div>
      </div>

      {totalProducts > 0 && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Inventory Overview</h3>
            <div className="h-64">
              <Bar 
                data={barData} 
                options={{ 
                  responsive: true, 
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false }
                  }
                }} 
              />
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Stock by Category</h3>
            <div className="h-64">
              {categoryData.labels.length > 0 ? (
                <Pie 
                  data={categoryData} 
                  options={{ 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { position: 'right' }
                    }
                  }} 
                />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400">
                  No categories yet
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {totalProducts === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <div className="mb-4">
            <svg className="w-16 h-16 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-gray-500">No inventory data to display.</p>
          <p className="text-sm text-gray-400 mt-1">Add items to see metrics.</p>
        </div>
      )}
    </div>
  );
};

export default InventoryMetrics;
