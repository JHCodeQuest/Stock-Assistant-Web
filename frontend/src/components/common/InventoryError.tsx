import React from 'react';

export default function InventoryError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="bg-white rounded-lg shadow p-6 text-center">
      <p className="text-red-600 mb-3">Unable to load inventory. Please try again.</p>
      <button type="button" onClick={onRetry} className="text-blue-600 underline">Retry inventory</button>
    </div>
  );
}
