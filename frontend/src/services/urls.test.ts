const originalApiUrl = process.env.REACT_APP_API_URL;

afterEach(() => {
  if (originalApiUrl === undefined) delete process.env.REACT_APP_API_URL;
  else process.env.REACT_APP_API_URL = originalApiUrl;
  jest.resetModules();
});

test.each([
  ['https://api.example.com/api', '/uploads/images/bolt.png', 'https://api.example.com/uploads/images/bolt.png'],
  ['https://api.example.com/api/', 'uploads/images/bolt.png', 'https://api.example.com/uploads/images/bolt.png'],
  ['http://localhost:5000/api', '/uploads/images/bolt.png', 'http://localhost:5000/uploads/images/bolt.png'],
  ['https://api.example.com/api', 'https://res.cloudinary.com/demo/image/upload/bolt.png', 'https://res.cloudinary.com/demo/image/upload/bolt.png'],
  ['https://api.example.com/api', 'https://cdn.example.com/photo.jpg?version=2', 'https://cdn.example.com/photo.jpg?version=2'],
])('resolves image URLs for %s and %s', (apiUrl, imageUrl, expected) => {
  process.env.REACT_APP_API_URL = apiUrl;
  jest.resetModules();
  const { resolveImageUrl } = require('./urls');
  expect(resolveImageUrl(imageUrl)).toBe(expected);
});
