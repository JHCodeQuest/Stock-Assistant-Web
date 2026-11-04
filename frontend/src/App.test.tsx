import React from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HashRouter, MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { login, register, getInventory } from './services/api';

jest.mock('axios', () => jest.requireActual('axios/dist/node/axios.cjs'));

// The HTTP layer is mocked, so no test reaches the network.
jest.mock('./services/api', () => ({
  __esModule: true,
  login: jest.fn(),
  register: jest.fn(),
  getInventory: jest.fn(),
  addInventory: jest.fn(),
  adjustStock: jest.fn(),
  default: {},
}));

const mockLogin = login as jest.Mock;
const mockRegister = register as jest.Mock;
const mockGetInventory = getInventory as jest.Mock;

// Fictional test data only.
const TEST_USER = { id: 1, email: 'test.user@example.com', name: 'Test User', role: 'staff' };
const TEST_PASSWORD = 'not-a-real-password';
const TEST_TOKEN = 'fake-jwt-token';

const LocationDisplay = () => <div data-testid="location">{useLocation().pathname}</div>;

function renderApp(route = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
    logger: { log: () => {}, warn: () => {}, error: () => {} },
  });
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <App />
        <LocationDisplay />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { user, queryClient };
}

function signIn() {
  sessionStorage.setItem('token', TEST_TOKEN);
  sessionStorage.setItem('user', JSON.stringify(TEST_USER));
}

const currentPath = () => screen.getByTestId('location').textContent;
const nav = () => screen.getByRole('navigation');

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  mockGetInventory.mockResolvedValue({ data: [] });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('login', () => {
  test('renders the login form', () => {
    renderApp('/login');

    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Register' })).toHaveAttribute('href', '/register');
  });

  test('a successful login stores the session and shows the dashboard', async () => {
    mockLogin.mockResolvedValue({ data: { token: TEST_TOKEN, user: TEST_USER } });
    const { user } = renderApp('/login');

    await user.type(screen.getByPlaceholderText('Enter your email'), TEST_USER.email);
    await user.type(screen.getByPlaceholderText('Enter your password'), TEST_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Login' }));

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(within(nav()).getByRole('link', { name: TEST_USER.name })).toBeInTheDocument();
    expect(currentPath()).toBe('/');
    expect(mockLogin).toHaveBeenCalledWith({ email: TEST_USER.email, password: TEST_PASSWORD });
    expect(sessionStorage.getItem('token')).toBe(TEST_TOKEN);
    expect(JSON.parse(sessionStorage.getItem('user') as string)).toEqual(TEST_USER);
    expect(localStorage.getItem('token')).toBeNull();
  });

  test('a failed login shows the server error and stays on the login page', async () => {
    mockLogin.mockRejectedValue({ response: { data: { error: 'Invalid credentials' } } });
    const { user } = renderApp('/login');

    await user.type(screen.getByPlaceholderText('Enter your email'), TEST_USER.email);
    await user.type(screen.getByPlaceholderText('Enter your password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument();
    expect(currentPath()).toBe('/login');
    expect(sessionStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('user')).toBeNull();
  });

  test('a login that fails without a server message shows a generic error', async () => {
    mockLogin.mockRejectedValue(new Error('Network Error'));
    const { user } = renderApp('/login');

    await user.type(screen.getByPlaceholderText('Enter your email'), TEST_USER.email);
    await user.type(screen.getByPlaceholderText('Enter your password'), TEST_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Login' }));

    expect(await screen.findByText('Login failed')).toBeInTheDocument();
    expect(currentPath()).toBe('/login');
  });

});

describe('register', () => {
  test('renders the register form', () => {
    renderApp('/register');

    expect(screen.getByRole('heading', { name: 'Register' })).toBeInTheDocument();
    expect(screen.getByLabelText('Invite code')).toBeRequired();
    expect(screen.getByPlaceholderText('Enter your name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
  });

  test('a successful registration stores the session and shows the dashboard', async () => {
    mockRegister.mockResolvedValue({ data: { token: TEST_TOKEN, user: TEST_USER } });
    const { user } = renderApp('/register');

    await user.type(screen.getByLabelText('Invite code'), 'test-invitation');
    await user.type(screen.getByPlaceholderText('Enter your name'), TEST_USER.name);
    await user.type(screen.getByPlaceholderText('Enter your email'), TEST_USER.email);
    await user.type(screen.getByPlaceholderText('Enter your password'), TEST_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(within(nav()).getByRole('link', { name: TEST_USER.name })).toBeInTheDocument();
    expect(mockRegister).toHaveBeenCalledWith({
      name: TEST_USER.name,
      email: TEST_USER.email,
      password: TEST_PASSWORD,
      inviteCode: 'test-invitation',
    });
    expect(sessionStorage.getItem('token')).toBe(TEST_TOKEN);
  });

  test('a failed registration shows the server error and stays on the register page', async () => {
    mockRegister.mockRejectedValue({ response: { data: { error: 'Email already registered' } } });
    const { user } = renderApp('/register');

    await user.type(screen.getByLabelText('Invite code'), 'test-invitation');
    await user.type(screen.getByPlaceholderText('Enter your name'), TEST_USER.name);
    await user.type(screen.getByPlaceholderText('Enter your email'), TEST_USER.email);
    await user.type(screen.getByPlaceholderText('Enter your password'), TEST_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByText('Email already registered')).toBeInTheDocument();
    expect(currentPath()).toBe('/register');
    expect(sessionStorage.getItem('token')).toBeNull();
  });
});

describe('logout', () => {
  test('the nav shows the stored user and its Logout clears the session', async () => {
    signIn();
    const { user } = renderApp('/');

    expect(await within(nav()).findByRole('link', { name: TEST_USER.name })).toBeInTheDocument();
    await user.click(within(nav()).getByRole('button', { name: 'Logout' }));

    expect(sessionStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('user')).toBeNull();
    expect(within(nav()).getByRole('link', { name: 'Login' })).toBeInTheDocument();
    expect(within(nav()).queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
  });

  test('the profile page shows the user and its Logout clears the session', async () => {
    signIn();
    const { user } = renderApp('/profile');

    const main = screen.getByRole('main');
    expect(within(main).getByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    expect(within(main).getByText(TEST_USER.email)).toBeInTheDocument();

    await user.click(within(main).getByRole('button', { name: 'Logout' }));

    expect(sessionStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('user')).toBeNull();
    expect(currentPath()).toBe('/login');
    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument();
    expect(within(nav()).queryByText(TEST_USER.name)).not.toBeInTheDocument();
  });

});

const protectedRoutes = [
  ['/', 'Dashboard'],
  ['/inventory', 'Inventory'],
  ['/find-items', 'Find Items'],
  ['/warehouse', 'Warehouse Query'],
  ['/add-inventory', 'Add Inventory Item'],
  ['/image-search', 'AI Image Search'],
  ['/profile', 'Profile'],
];

describe('protected routes', () => {
  test.each(protectedRoutes)('%s redirects to login when signed out', async (route) => {
    renderApp(route);
    expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
    expect(currentPath()).toBe('/login');
    expect(mockGetInventory).not.toHaveBeenCalled();
  });

  test.each(protectedRoutes)('%s renders %s with a session token', async (route, heading) => {
    signIn();
    renderApp(route);
    expect(await within(screen.getByRole('main')).findByRole('heading', { name: heading })).toBeInTheDocument();
    expect(currentPath()).toBe(route);
    if (route === '/image-search') {
      expect(await screen.findByText(/AI model ready/)).toBeInTheDocument();
    }
  });

  test.each([['/login', 'Login'], ['/register', 'Register']])(
    '%s remains public', async (route, heading) => {
      renderApp(route);
      expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
      expect(currentPath()).toBe(route);
    }
  );

  test('a stored user without a token cannot open protected pages', async () => {
    sessionStorage.setItem('user', JSON.stringify(TEST_USER));
    renderApp('/profile');
    expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
    expect(currentPath()).toBe('/login');
    expect(within(nav()).queryByText(TEST_USER.name)).not.toBeInTheDocument();
  });

  test('a 401 clears the session, cached data and member navigation, then redirects', async () => {
    signIn();
    const { queryClient } = renderApp('/inventory');
    expect(await screen.findByRole('heading', { name: 'Inventory' })).toBeInTheDocument();
    queryClient.setQueryData(['private-example'], { confidential: true });
    const api = jest.requireActual('./services/api').default;
    const error = { response: { status: 401 } };

    await act(async () => {
      await expect(api.get('/inventory', {
        adapter: async () => { throw error; },
      })).rejects.toBe(error);
    });

    expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
    expect(currentPath()).toBe('/login');
    expect(sessionStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('user')).toBeNull();
    expect(queryClient.getQueryData(['private-example'])).toBeUndefined();
    expect(within(nav()).queryByText(TEST_USER.name)).not.toBeInTheDocument();
    expect(within(nav()).queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
  });

  test('signed-out nav shows only public links', () => {
    renderApp('/login');
    const links = within(nav()).getAllByRole('link').map((a) => a.textContent);
    expect(links).toEqual(['Dashboard', 'Inventory', 'Login']);
  });

  test('signed-in nav shows the member links', async () => {
    signIn();
    renderApp('/');
    expect(await within(nav()).findByRole('link', { name: 'Find Items' })).toBeInTheDocument();
    expect(within(nav()).getByRole('link', { name: 'Warehouse' })).toBeInTheDocument();
    expect(within(nav()).getByRole('link', { name: '+ Add Item' })).toBeInTheDocument();
  });

  test('an unknown path renders no page', () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    renderApp('/no-such-page');
    expect(screen.getByRole('main')).toBeEmptyDOMElement();
  });

});

describe('inventory image URLs', () => {
  const apiOrigin = new URL(process.env.REACT_APP_API_URL ||
    'https://stock-assistant-api-3x6i.onrender.com/api', window.location.origin).origin;
  const item = { id: 1, name: 'Hex Bolt M8', sku: 'BLT-001', quantity: 5,
    min_stock_level: 1, category: 'Fasteners', image_url: '/uploads/images/bolt.png' };

  test.each([
    ['/inventory', '/uploads/images/bolt.png', apiOrigin + '/uploads/images/bolt.png'],
    ['/inventory', 'https://res.cloudinary.com/demo/image/upload/bolt.png', 'https://res.cloudinary.com/demo/image/upload/bolt.png'],
    ['/find-items', '/uploads/images/bolt.png', apiOrigin + '/uploads/images/bolt.png'],
    ['/find-items', 'https://res.cloudinary.com/demo/image/upload/bolt.png', 'https://res.cloudinary.com/demo/image/upload/bolt.png'],
  ])('%s renders stored image %s from the correct origin', async (route, imageUrl, expected) => {
    signIn();
    mockGetInventory.mockResolvedValue({ data: [{ ...item, image_url: imageUrl }] });
    const { user } = renderApp(route);
    if (route === '/find-items') {
      await waitFor(() => expect(mockGetInventory).toHaveBeenCalled());
      await user.type(screen.getByPlaceholderText(/laptop charger/), 'bolt');
      await user.click(screen.getByRole('button', { name: 'Search' }));
    }
    expect(await screen.findByRole('img', { name: item.name })).toHaveAttribute('src', expected);
  });

  test('image-search thumbnails and selected previews use the API origin', async () => {
    signIn();
    mockGetInventory.mockResolvedValue({ data: [item] });
    // jsdom does not load image pixels. Simulate the browser load event while
    // the shared test model returns no labels, exercising filename matching.
    jest.spyOn(window, 'Image').mockImplementation(() => {
      const image = document.createElement('img');
      Object.defineProperty(image, 'src', {
        set: () => Promise.resolve().then(() => image.dispatchEvent(new Event('load'))),
      });
      return image;
    });
    const { user } = renderApp('/image-search');
    expect(await screen.findByText(/AI model ready/)).toBeInTheDocument();
    await waitFor(() => expect(mockGetInventory).toHaveBeenCalled());
    await user.upload(screen.getByLabelText(/Click or drag to upload/),
      new File(['photo'], 'bolt.png', { type: 'image/png' }));
    const thumbnail = await screen.findByRole('img', { name: item.name });
    expect(thumbnail).toHaveAttribute('src', apiOrigin + '/uploads/images/bolt.png');
    await user.click(thumbnail);
    expect(screen.getByRole('img', { name: 'Selected' })).toHaveAttribute('src', apiOrigin + '/uploads/images/bolt.png');
  });
});

describe('inventory outages', () => {
  test.each([
    ['/', 'Failed to load metrics.'],
    ['/inventory', 'Error loading inventory'],
    ['/find-items', 'Unable to load inventory. Please try again.'],
    ['/warehouse', 'Unable to load inventory. Please try again.'],
    ['/image-search', 'Unable to load inventory. Please try again.'],
  ])('%s displays a failed request instead of an empty warehouse', async (route, message) => {
    signIn();
    mockGetInventory.mockRejectedValue({ response: { status: 500, data: { error: 'Failed to fetch inventory' } } });
    renderApp(route);
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByText('No inventory data to display.')).not.toBeInTheDocument();
    expect(screen.queryByText('No inventory items yet.')).not.toBeInTheDocument();
    expect(screen.queryByText('Upload an image to find matching items')).not.toBeInTheDocument();
    expect(screen.queryByText('Total Products')).not.toBeInTheDocument();
  });

  test('find-items retries a failed inventory request', async () => {
    signIn();
    mockGetInventory.mockRejectedValue(new Error('unavailable'));
    const { user } = renderApp('/find-items');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    mockGetInventory.mockResolvedValue({ data: [] });
    await user.click(screen.getByRole('button', { name: 'Retry inventory' }));
    expect(await screen.findByRole('heading', { name: 'Find Items' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('dashboard retries an outage and shows real empty metrics only after success', async () => {
    signIn();
    mockGetInventory.mockRejectedValue(new Error('unavailable'));
    const { user } = renderApp('/');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    mockGetInventory.mockResolvedValue({ data: [] });
    await user.click(screen.getByRole('button', { name: 'Retry metrics' }));
    expect(await screen.findByText('No inventory data to display.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('a failed background refresh hides cached metrics and reports the outage', async () => {
    signIn();
    const { queryClient } = renderApp('/');
    expect(await screen.findByText('Total Products')).toBeInTheDocument();
    mockGetInventory.mockRejectedValue(new Error('outage after successful load'));
    await act(async () => { await queryClient.refetchQueries(['inventory']); });
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load metrics.');
    expect(screen.queryByText('Total Products')).not.toBeInTheDocument();
  });
});

function renderPagesApp() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
    logger: { log: () => {}, warn: () => {}, error: () => {} },
  });
  return render(<QueryClientProvider client={client}><HashRouter><App /></HashRouter></QueryClientProvider>);
}

describe('GitHub Pages hash routing', () => {
  afterEach(() => window.history.replaceState({}, '', '/'));

  test.each(protectedRoutes)('%s renders at the Pages subpath and survives a fresh mount', async (route, heading) => {
    signIn();
    window.history.replaceState({}, '', '/Stock-Assistant-Web/#' + route);
    const first = renderPagesApp();
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    if (route === '/image-search') expect(await screen.findByText(/AI model ready/)).toBeInTheDocument();
    first.unmount();
    renderPagesApp();
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    if (route === '/image-search') expect(await screen.findByText(/AI model ready/)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/Stock-Assistant-Web/');
    expect(window.location.hash).toBe('#' + route);
  });

  test.each([['/login', 'Login'], ['/register', 'Register']])('%s is public under the Pages path', async (route, heading) => {
    window.history.replaceState({}, '', '/Stock-Assistant-Web/#' + route);
    renderPagesApp();
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });

  test('signed-out deep links redirect within the hash while keeping the served Pages path', async () => {
    window.history.replaceState({}, '', '/Stock-Assistant-Web/#/inventory');
    renderPagesApp();
    expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/Stock-Assistant-Web/');
    expect(window.location.hash).toBe('#/login');
  });

  test('navigation links keep the repository path and change only the hash', async () => {
    signIn();
    window.history.replaceState({}, '', '/Stock-Assistant-Web/#/');
    renderPagesApp();
    const link = within(nav()).getByRole('link', { name: 'Inventory' });
    expect(link).toHaveAttribute('href', '#/inventory');
    await userEvent.setup().click(link);
    expect(await screen.findByRole('heading', { name: 'Inventory' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/Stock-Assistant-Web/');
    expect(window.location.hash).toBe('#/inventory');
  });
});
