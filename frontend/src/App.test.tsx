import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { login, register, getInventory } from './services/api';

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
  return { user };
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
    expect(currentPath()).toBe('/');
    expect(mockLogin).toHaveBeenCalledWith({ email: TEST_USER.email, password: TEST_PASSWORD });
    // App.tsx stores the session in sessionStorage today; api.ts reads localStorage (#2).
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

  test.todo('#2 API requests send the token that login stored');
  test.todo('nav shows the signed-in user straight after login, without a reload');
});

describe('register', () => {
  test('renders the register form', () => {
    renderApp('/register');

    expect(screen.getByRole('heading', { name: 'Register' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login');
  });

  test('a successful registration stores the session and shows the dashboard', async () => {
    mockRegister.mockResolvedValue({ data: { token: TEST_TOKEN, user: TEST_USER } });
    const { user } = renderApp('/register');

    await user.type(screen.getByPlaceholderText('Enter your name'), TEST_USER.name);
    await user.type(screen.getByPlaceholderText('Enter your email'), TEST_USER.email);
    await user.type(screen.getByPlaceholderText('Enter your password'), TEST_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Register' }));

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(mockRegister).toHaveBeenCalledWith({
      name: TEST_USER.name,
      email: TEST_USER.email,
      password: TEST_PASSWORD,
    });
    expect(sessionStorage.getItem('token')).toBe(TEST_TOKEN);
  });

  test('a failed registration shows the server error and stays on the register page', async () => {
    mockRegister.mockRejectedValue({ response: { data: { error: 'Email already registered' } } });
    const { user } = renderApp('/register');

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
  });

  test.todo('the nav forgets the user after logging out from the profile page');
});

describe('routes as they render today', () => {
  test.each([
    ['/', 'Dashboard'],
    ['/inventory', 'Inventory'],
    ['/find-items', 'Find Items'],
    ['/warehouse', 'Warehouse Query'],
    ['/add-inventory', 'Add Inventory Item'],
    ['/login', 'Login'],
    ['/register', 'Register'],
  ])('%s renders the %s page when signed out', async (route, heading) => {
    renderApp(route);
    const main = screen.getByRole('main');
    expect(await within(main).findByRole('heading', { name: heading })).toBeInTheDocument();
    expect(currentPath()).toBe(route);
  });

  test('/image-search renders the image search page when signed out', async () => {
    renderApp('/image-search');
    const main = screen.getByRole('main');
    expect(within(main).getByRole('heading', { name: 'AI Image Search' })).toBeInTheDocument();
    // The mocked mobilenet model loads, so the page reports it as ready.
    expect(await within(main).findByText(/AI model ready/)).toBeInTheDocument();
    expect(currentPath()).toBe('/image-search');
  });

  test('/profile renders nothing when signed out and does not redirect', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    renderApp('/profile');
    expect(screen.getByRole('main')).toBeEmptyDOMElement();
    expect(currentPath()).toBe('/profile');
    // Profile calls navigate() during render, which React Router ignores.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('You should call navigate() in a React.useEffect()'));
  });

  test('signed-out nav shows only public links', () => {
    renderApp('/');
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

  test.todo('#12 (details in the private task)');
  test.todo('#1 serves routes under the GitHub Pages basename');
});
