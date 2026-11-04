import api, { uploadImage } from './api';

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

test('uploads use the configured API, session token and multipart data', async () => {
  sessionStorage.setItem('token', 'session-token');
  const file = new File(['image'], 'test.png', { type: 'image/png' });
  const previousAdapter = api.defaults.adapter;
  let observed: any;
  api.defaults.adapter = async (config) => {
    observed = config;
    return { data: { url: '/uploads/images/server-name.png' }, status: 200,
      statusText: 'OK', headers: {}, config };
  };
  try {
    const url = await uploadImage(file);
    expect(observed.url).toBe('/upload');
    expect(observed.baseURL).toBe(api.defaults.baseURL);
    expect(observed.headers.Authorization).toBe('Bearer session-token');
    expect(observed.headers['Content-Type']).not.toBe('application/json');
    expect(observed.data).toBeInstanceOf(FormData);
    expect(observed.data.get('image')).toBe(file);
    expect(url).toBe(new URL('/uploads/images/server-name.png',
      new URL(api.defaults.baseURL!, window.location.origin)).href);
  } finally {
    api.defaults.adapter = previousAdapter;
  }
});
