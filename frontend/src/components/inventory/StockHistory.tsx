import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getInventoryHistory } from '../../services/api';

interface HistoryEntry {
  id: number;
  adjustment_type: string;
  quantity: number;
  previous_quantity: number | null;
  user_name: string | null;
  reason: string | null;
  created_at: string;
}

interface Props {
  productId: string;
  productName: string;
  onClose: () => void;
}

export default function StockHistory({ productId, productName, onClose }: Props) {
  const { data, isLoading, error, refetch } = useQuery<HistoryEntry[]>({
    queryKey: ['inventory-history', productId],
    queryFn: async () => (await getInventoryHistory(productId)).data,
  });

  return (
    <section aria-label={'Stock history for ' + productName} className="bg-white border rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-3 gap-4">
        <h2 className="text-lg font-semibold">History: {productName}</h2>
        <button type="button" onClick={onClose} className="text-blue-600 underline">Close history</button>
      </div>
      {isLoading ? <p role="status">Loading stock history...</p> :
        error ? <div role="alert">
          <p>Unable to load stock history.</p>
          <button type="button" onClick={() => refetch()} className="text-blue-600 underline">Retry history</button>
        </div> :
        !data?.length ? <p>No stock changes recorded.</p> :
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            <thead><tr>
              <th className="p-2">When</th><th className="p-2">Change</th>
              <th className="p-2">Quantity</th><th className="p-2">Previous stock</th>
              <th className="p-2">Changed by</th><th className="p-2">Reason</th>
            </tr></thead>
            <tbody>{data.map((entry) => <tr key={entry.id} className="border-t">
              <td className="p-2"><time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString()}</time></td>
              <td className="p-2">{entry.adjustment_type}</td>
              <td className="p-2">{entry.quantity}</td>
              <td className="p-2">{entry.previous_quantity ?? '—'}</td>
              <td className="p-2">{entry.user_name || 'Unknown user'}</td>
              <td className="p-2">{entry.reason || '—'}</td>
            </tr>)}</tbody>
          </table>
        </div>
      }
    </section>
  );
}
