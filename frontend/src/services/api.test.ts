import api from './api';

// CRA's Jest runtime needs Axios's CommonJS build.
jest.mock('axios', () => jest.requireActual('axios/dist/node/axios.cjs'));

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

async function authorizationHeader() {
  let authorization: unknown;
  await api.get('/inventory', {
    adapter: async (config) => {
      authorization = config.headers.Authorization;
      return { data: [], status: 200, statusText: 'OK', headers: {}, config };
    },
  });
  return authorization;
}

test('#2 API requests send the token stored by login in sessionStorage', async () => {
  sessionStorage.setItem('token', 'session-token');
  localStorage.setItem('token', 'stale-local-token');

  expect(await authorizationHeader()).toBe('Bearer session-token');
});

test('signed-out requests ignore stale localStorage tokens', async () => {
  localStorage.setItem('token', 'stale-local-token');

  expect(await authorizationHeader()).toBeUndefined();
});

test('requests stop sending the token after logout clears the session', async () => {
  sessionStorage.setItem('token', 'session-token');
  expect(await authorizationHeader()).toBe('Bearer session-token');

  sessionStorage.removeItem('token');

  expect(await authorizationHeader()).toBeUndefined();
});

test.each([401, 403, 500])('HTTP %s clears the session only for 401 and preserves the rejection', async (status) => {
  sessionStorage.setItem('token', 'session-token');
  sessionStorage.setItem('user', JSON.stringify({ name: 'Test User' }));
  const error = { response: { status } };

  await expect(api.get('/inventory', {
    adapter: async () => { throw error; },
  })).rejects.toBe(error);

  if (status === 401) {
    expect(sessionStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('user')).toBeNull();
  } else {
    expect(sessionStorage.getItem('token')).toBe('session-token');
    expect(sessionStorage.getItem('user')).not.toBeNull();
  }
});
