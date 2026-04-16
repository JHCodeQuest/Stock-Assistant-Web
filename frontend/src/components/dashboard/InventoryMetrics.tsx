import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getInventory } from '../../services/api';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const InventoryMetrics: React.FC = () => {
  const { data: inventory } = useQuery({
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
    sum + (item.quantity * (item.unit_price || 0)), 0
  ) || 0;

  const chartData = {
    labels: ['Total Products', 'Low Stock', 'Out of Stock'],
    datasets: [
      {
        label: 'Inventory Metrics',
        data: [totalProducts, lowStockItems, outOfStockItems],
        backgroundColor: ['#3B82F6', '#F59E0B', '#EF4444'],
      },
    ],
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">Inventory Overview</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="p-4 bg-blue-50 rounded">
          <p className="text-gray-600 text-sm">Total Products</p>
          <p className="text-2xl font-bold">{totalProducts}</p>
        </div>
        <div className="p-4 bg-yellow-50 rounded">
          <p className="text-gray-600 text-sm">Low Stock</p>
          <p className="text-2xl font-bold">{lowStockItems}</p>
        </div>
        <div className="p-4 bg-red-50 rounded">
          <p className="text-gray-600 text-sm">Out of Stock</p>
          <p className="text-2xl font-bold">{outOfStockItems}</p>
        </div>
        <div className="p-4 bg-green-50 rounded">
          <p className="text-gray-600 text-sm">Total Value</p>
          <p className="text-2xl font-bold">${totalValue.toFixed(2)}</p>
        </div>
      </div>
      {totalProducts > 0 && (
        <div className="h-64">
          <Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />
        </div>
      )}
      {totalProducts === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No inventory items yet.</p>
          <p className="text-sm">Add items to see metrics.</p>
        </div>
      )}
    </div>
  );
};

export default InventoryMetrics;
