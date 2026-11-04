import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StockTable from './StockTable';
import { getInventory, getInventoryHistory } from '../../services/api';

jest.mock('../../services/api', () => ({
  getInventory: jest.fn(),
  getInventoryHistory: jest.fn(),
}));
const mockInventory = getInventory as jest.Mock;
const mockHistory = getInventoryHistory as jest.Mock;
const entry = { id: 1, adjustment_type: 'add', quantity: 5, previous_quantity: 20,
  user_name: 'Ada Tester', reason: 'Delivery', created_at: '2026-11-04T10:00:00Z' };

function renderInventory() {
  mockInventory.mockResolvedValue({ data: [
    { id: 1, name: 'Bolt', sku: 'BLT-001', quantity: 25 },
    { id: 2, name: 'Gasket', sku: 'GAS-001', quantity: 10 },
  ] });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
    logger: { log: () => {}, warn: () => {}, error: () => {} },
  });
  render(<QueryClientProvider client={client}><MemoryRouter><StockTable /></MemoryRouter></QueryClientProvider>);
  return userEvent.setup();
}

test('opens item history and displays the actual author, change and reason', async () => {
  mockHistory.mockResolvedValue({ data: [entry] });
  const user = renderInventory();
  await user.click(await screen.findByRole('button', { name: 'View history for Bolt' }));
  const panel = screen.getByRole('region', { name: 'Stock history for Bolt' });
  expect(await within(panel).findByText('Ada Tester')).toBeInTheDocument();
  expect(within(panel).getByText('Delivery')).toBeInTheDocument();
  expect(within(panel).getByText('20')).toBeInTheDocument();
  expect(within(panel).getByText('5')).toBeInTheDocument();
  expect(mockHistory).toHaveBeenCalledWith('1');
  await user.click(within(panel).getByRole('button', { name: 'Close history' }));
  expect(screen.queryByRole('region', { name: 'Stock history for Bolt' })).not.toBeInTheDocument();
});

test('labels legacy or deleted authors as unknown without inventing a name', async () => {
  mockHistory.mockResolvedValue({ data: [{ ...entry, user_name: null }] });
  const user = renderInventory();
  await user.click(await screen.findByRole('button', { name: 'View history for Bolt' }));
  expect(await screen.findByText('Unknown user')).toBeInTheDocument();
  expect(screen.queryByText('Ada Tester')).not.toBeInTheDocument();
});

test('switching items fetches that item history and replaces the old author', async () => {
  mockHistory.mockImplementation((id) => Promise.resolve({
    data: [{ ...entry, user_name: id === '1' ? 'Ada Tester' : 'Grace Tester' }],
  }));
  const user = renderInventory();
  await user.click(await screen.findByRole('button', { name: 'View history for Bolt' }));
  expect(await screen.findByText('Ada Tester')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'View history for Gasket' }));
  expect(await screen.findByText('Grace Tester')).toBeInTheDocument();
  expect(mockHistory).toHaveBeenCalledWith('2');
  expect(screen.queryByText('Ada Tester')).not.toBeInTheDocument();
});

test('shows an empty history clearly', async () => {
  mockHistory.mockResolvedValue({ data: [] });
  const user = renderInventory();
  await user.click(await screen.findByRole('button', { name: 'View history for Bolt' }));
  expect(await screen.findByText('No stock changes recorded.')).toBeInTheDocument();
});

test('shows loading and allows closing the panel while the request is pending', async () => {
  mockHistory.mockReturnValue(new Promise(() => {}));
  const user = renderInventory();
  await user.click(await screen.findByRole('button', { name: 'View history for Bolt' }));
  expect(screen.getByRole('status')).toHaveTextContent('Loading stock history');
  await user.click(screen.getByRole('button', { name: 'Close history' }));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('reports request failures and retries', async () => {
  mockHistory.mockRejectedValue(new Error('unavailable'));
  const user = renderInventory();
  await user.click(await screen.findByRole('button', { name: 'View history for Bolt' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load stock history.');
  mockHistory.mockResolvedValue({ data: [entry] });
  await user.click(screen.getByRole('button', { name: 'Retry history' }));
  expect(await screen.findByText('Ada Tester')).toBeInTheDocument();
});
