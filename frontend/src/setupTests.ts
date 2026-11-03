// Loaded by react-scripts before every test file.
import '@testing-library/jest-dom';

// jsdom can't run these libraries, so every test gets a stand-in.
// Plain functions (not jest.fn) because CRA's Jest config resets mocks
// before each test, which would wipe jest.fn implementations.

jest.mock('@tensorflow/tfjs', () => ({
  ready: () => Promise.resolve(),
}));

jest.mock('@tensorflow-models/mobilenet', () => ({
  load: () => Promise.resolve({ classify: () => Promise.resolve([]) }),
}));

jest.mock('socket.io-client', () => {
  const socket = {
    on: () => socket,
    off: () => socket,
    emit: () => socket,
    connect: () => socket,
    disconnect: () => socket,
    connected: false,
  };
  const io = () => socket;
  return { __esModule: true, io, default: io };
});

// Charts draw on <canvas>, which jsdom doesn't implement.
jest.mock('chart.js', () => ({
  Chart: { register: () => {} },
  CategoryScale: {},
  LinearScale: {},
  BarElement: {},
  Title: {},
  Tooltip: {},
  Legend: {},
  ArcElement: {},
}));

jest.mock('react-chartjs-2', () => ({
  Bar: () => null,
  Pie: () => null,
}));
