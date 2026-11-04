import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import AddInventoryForm from './AddInventoryForm';
import { addInventory, uploadImage } from '../../services/api';

jest.mock('../../services/api', () => ({
  addInventory: jest.fn(),
  uploadImage: jest.fn(),
}));
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

const mockUpload = uploadImage as jest.Mock;
const mockAdd = addInventory as jest.Mock;

async function prepareForm() {
  mockUpload.mockResolvedValue('https://api.example.com/uploads/images/stored.png');
  mockAdd.mockResolvedValue({ data: {} });
  const user = userEvent.setup();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter>
    <AddInventoryForm />
  </MemoryRouter></QueryClientProvider>);
  await user.type(screen.getByPlaceholderText('e.g., Hex Bolt M8'), 'Hex Bolt M8');
  await user.type(screen.getByPlaceholderText('BLT-HX-001'), 'BLT-001');
  await user.type(screen.getByPlaceholderText('0'), '5');
  const file = new File(['image'], 'bolt.png', { type: 'image/png' });
  await user.upload(screen.getByLabelText(/Click to upload/), file);
  return { user, file };
}

test('saves the server image URL after the authenticated upload succeeds', async () => {
  const { user, file } = await prepareForm();
  await user.click(screen.getByRole('button', { name: 'Add Item' }));
  await waitFor(() => expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({
    image_url: 'https://api.example.com/uploads/images/stored.png',
  })));
  expect(mockUpload).toHaveBeenCalledWith(file);
});

test('an upload failure shows the server error and stops item creation', async () => {
  const { user } = await prepareForm();
  mockUpload.mockRejectedValue({ response: { data: { error: 'Images must be 5 MB or smaller.' } } });
  await user.click(screen.getByRole('button', { name: 'Add Item' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Images must be 5 MB or smaller.'));
  expect(mockAdd).not.toHaveBeenCalled();
});
