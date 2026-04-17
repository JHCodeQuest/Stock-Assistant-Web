import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { login as loginApi, register as registerApi, getInventory } from './services/api';
import InventoryMetrics from './components/dashboard/InventoryMetrics';
import StockTable from './components/inventory/StockTable';
import ImageSearch from './components/inventory/ImageSearch';
import AddInventoryForm from './components/inventory/AddInventoryForm';
import { ToastProvider } from './components/common/ToastProvider';

const CATEGORY_MAPPINGS: { [key: string]: { category: string; skuPrefix: string } } = {
  bolt: { category: 'Fasteners', skuPrefix: 'BLT' },
  screw: { category: 'Fasteners', skuPrefix: 'SCW' },
  rivet: { category: 'Fasteners', skuPrefix: 'RVT' },
  nail: { category: 'Fasteners', skuPrefix: 'NIL' },
  nut: { category: 'Fasteners', skuPrefix: 'NUT' },
  washer: { category: 'Fasteners', skuPrefix: 'WSH' },
  bracket: { category: 'Hardware', skuPrefix: 'BRK' },
  hinge: { category: 'Hardware', skuPrefix: 'HNG' },
  clamp: { category: 'Hardware', skuPrefix: 'CLP' },
  hook: { category: 'Hardware', skuPrefix: 'HOK' },
  hammer: { category: 'Tools', skuPrefix: 'HMR' },
  wrench: { category: 'Tools', skuPrefix: 'WRN' },
  screwdriver: { category: 'Tools', skuPrefix: 'SDV' },
  pliers: { category: 'Tools', skuPrefix: 'PLY' },
  drill: { category: 'Power Tools', skuPrefix: 'DRL' },
  saw: { category: 'Tools', skuPrefix: 'SAW' },
  wire: { category: 'Electrical', skuPrefix: 'WIR' },
  cable: { category: 'Electrical', skuPrefix: 'CBL' },
  plug: { category: 'Electrical', skuPrefix: 'PLG' },
  switch: { category: 'Electrical', skuPrefix: 'SWT' },
  socket: { category: 'Electrical', skuPrefix: 'SCK' },
  pipe: { category: 'Plumbing', skuPrefix: 'PIP' },
  tube: { category: 'Plumbing', skuPrefix: 'TBE' },
  hose: { category: 'Plumbing', skuPrefix: 'HSE' },
  valve: { category: 'Plumbing', skuPrefix: 'VLV' },
  faucet: { category: 'Plumbing', skuPrefix: 'FCT' },
  brick: { category: 'Building Materials', skuPrefix: 'BRK' },
  tile: { category: 'Building Materials', skuPrefix: 'TIL' },
  board: { category: 'Building Materials', skuPrefix: 'BRD' },
  plywood: { category: 'Building Materials', skuPrefix: 'PLY' },
  helmet: { category: 'Safety Equipment', skuPrefix: 'HLM' },
  glove: { category: 'Safety Equipment', skuPrefix: 'GLV' },
  goggles: { category: 'Safety Equipment', skuPrefix: 'GOG' },
  vest: { category: 'Safety Equipment', skuPrefix: 'VST' },
  boots: { category: 'Safety Equipment', skuPrefix: 'BTS' },
  mask: { category: 'Safety Equipment', skuPrefix: 'MSK' },
  filter: { category: 'Automotive', skuPrefix: 'FLT' },
  belt: { category: 'Automotive', skuPrefix: 'BLT' },
  bearing: { category: 'Automotive', skuPrefix: 'BRG' },
  umbrella: { category: 'Weather Protection', skuPrefix: 'UMB' },
  parasol: { category: 'Weather Protection', skuPrefix: 'PRL' },
  shovel: { category: 'Garden Tools', skuPrefix: 'SHV' },
  rake: { category: 'Garden Tools', skuPrefix: 'RAK' },
  widget: { category: 'Components', skuPrefix: 'WDG' },
  gadget: { category: 'Components', skuPrefix: 'GDG' },
  component: { category: 'Components', skuPrefix: 'CMP' },
  metal: { category: 'Hardware', skuPrefix: 'MTL' },
  steel: { category: 'Hardware', skuPrefix: 'STL' },
  plastic: { category: 'General', skuPrefix: 'PLS' },
  rubber: { category: 'General', skuPrefix: 'RUB' },
  wood: { category: 'Materials', skuPrefix: 'WOD' },
  paper: { category: 'Office Supplies', skuPrefix: 'PPR' },
  pen: { category: 'Office Supplies', skuPrefix: 'PEN' },
  pencil: { category: 'Office Supplies', skuPrefix: 'PCL' },
};

function getCategoryAndSku(term: string): { category: string; skuPrefix: string } {
  const termLower = term.toLowerCase();
  
  for (const [key, value] of Object.entries(CATEGORY_MAPPINGS)) {
    if (termLower.includes(key) || key.includes(termLower)) {
      return value;
    }
  }
  
  return { category: 'General', skuPrefix: 'GEN' };
}

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
}

const Dashboard: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <InventoryMetrics />
    </div>
  );
};

const Inventory: React.FC = () => {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Inventory</h1>
      <StockTable />
    </div>
  );
};

const FindItems: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { data: inventory } = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const response = await getInventory();
      return response.data;
    },
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    
    const query = searchQuery.toLowerCase();
    const results = (inventory || []).filter((item: any) => 
      item.name?.toLowerCase().includes(query) ||
      item.sku?.toLowerCase().includes(query) ||
      item.category?.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query)
    );
    
    setSearchResults(results);
    setIsSearching(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Find Items</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <p className="text-gray-600 mb-4">
          Type what you need or describe the item. The system will find matching stock.
        </p>
        <div className="flex gap-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="e.g., 'laptop charger', 'USB cable', 'battery'"
            className="flex-1 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {searchResults.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-4 bg-green-50 border-b">
            <h3 className="font-semibold text-green-800">
              Found {searchResults.length} matching items
            </h3>
            <p className="text-sm text-green-600 mt-1">
              Ask the warehouse staff for these items
            </p>
          </div>
          <div className="divide-y">
            {searchResults.map((item) => (
              <div key={item.id} className="p-4 flex items-center gap-4 hover:bg-gray-50">
                {item.image_url && (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-16 h-16 object-cover rounded"
                    onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                  />
                )}
                <div className="flex-1">
                  <h4 className="font-semibold">{item.name}</h4>
                  <p className="text-sm text-gray-500">
                    SKU: {item.sku} | Category: {item.category || 'N/A'}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    item.quantity === 0 ? 'bg-red-100 text-red-800' :
                    item.quantity <= (item.min_stock_level || 10) ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {item.quantity} in stock
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {searchQuery && searchResults.length === 0 && !isSearching && (
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          <p className="text-gray-500">No items found matching "{searchQuery}"</p>
          <p className="text-sm text-gray-400 mt-2">Try a different search term</p>
        </div>
      )}
    </div>
  );
};

const WarehouseQuery: React.FC = () => {
  const [locationQuery, setLocationQuery] = useState('');
  const [queryResults, setQueryResults] = useState<any[]>([]);
  const { data: inventory } = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const response = await getInventory();
      return response.data;
    },
  });

  const handleLocationSearch = () => {
    if (!locationQuery.trim()) {
      setQueryResults(inventory || []);
      return;
    }
    
    const query = locationQuery.toLowerCase();
    const results = (inventory || []).filter((item: any) =>
      item.location?.toLowerCase().includes(query) ||
      item.name?.toLowerCase().includes(query) ||
      item.sku?.toLowerCase().includes(query)
    );
    
    setQueryResults(results);
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Warehouse Query</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <p className="text-gray-600 mb-4">
          Search for items by location, name, or SKU to find where items are stored.
        </p>
        <div className="flex gap-4">
          <input
            type="text"
            value={locationQuery}
            onChange={(e) => setLocationQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLocationSearch()}
            placeholder="e.g., 'A-1-3', 'B-3', 'bolt'"
            className="flex-1 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleLocationSearch}
            className="bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600"
          >
            Find Location
          </button>
        </div>
      </div>

      <div className="grid gap-4">
        {queryResults.map((item) => (
          <div key={item.id} className="bg-white p-4 rounded-lg shadow-md">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-lg">{item.name}</h3>
                <p className="text-gray-500">SKU: {item.sku}</p>
                {item.location && (
                  <p className="text-purple-600 font-medium mt-1">
                    📍 Location: {item.location}
                  </p>
                )}
              </div>
              <div className="text-right">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  item.quantity === 0 ? 'bg-red-100 text-red-800' :
                  item.quantity <= (item.min_stock_level || 10) ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {item.quantity} units
                </span>
              </div>
            </div>
            {item.category && (
              <p className="text-sm text-gray-400 mt-2">Category: {item.category}</p>
            )}
          </div>
        ))}
      </div>

      {!locationQuery && queryResults.length === 0 && (
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          <p className="text-gray-500">Enter a search term to find items</p>
          <p className="text-sm text-gray-400 mt-2">Search by location, name, or SKU</p>
        </div>
      )}
    </div>
  );
};

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const response = await loginApi({ email, password });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">Login</h2>
        {error && <div className="mb-4 text-red-500 text-center">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your email"
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your password"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600"
          >
            Login
          </button>
          <p className="mt-4 text-center text-sm">
            Don't have an account? <Link to="/register" className="text-blue-500">Register</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

const Register: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const response = await registerApi({ name, email, password });
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">Register</h2>
        {error && <div className="mb-4 text-red-500 text-center">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your name"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your email"
              required
            />
          </div>
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your password"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-green-500 text-white py-2 rounded-lg hover:bg-green-600"
          >
            Register
          </button>
          <p className="mt-4 text-center text-sm">
            Already have an account? <Link to="/login" className="text-blue-500">Login</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const userJson = localStorage.getItem('user');
  const user: User | null = userJson ? JSON.parse(userJson) : null;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Profile</h1>
      <div className="bg-white p-6 rounded-lg shadow-md max-w-md">
        <div className="mb-4">
          <label className="block text-gray-500 text-sm">Name</label>
          <p className="text-lg font-semibold">{user.name}</p>
        </div>
        <div className="mb-4">
          <label className="block text-gray-500 text-sm">Email</label>
          <p className="text-lg font-semibold">{user.email}</p>
        </div>
        <div className="mb-6">
          <label className="block text-gray-500 text-sm">Role</label>
          <p className="text-lg font-semibold capitalize">{user.role}</p>
        </div>
        <button
          onClick={handleLogout}
          className="bg-red-500 text-white py-2 px-6 rounded-lg hover:bg-red-600"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const userJson = localStorage.getItem('user');
    if (userJson) {
      setUser(JSON.parse(userJson));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <ToastProvider>
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16">
            <div className="flex space-x-8">
              <Link
                to="/"
                className="inline-flex items-center px-1 pt-1 text-gray-900 hover:text-gray-600"
              >
                Dashboard
              </Link>
              <Link
                to="/inventory"
                className="inline-flex items-center px-1 pt-1 text-gray-900 hover:text-gray-600"
              >
                Inventory
              </Link>
              {user && (
                <>
                  <Link
                    to="/find-items"
                    className="inline-flex items-center px-1 pt-1 text-blue-600 hover:text-blue-800"
                  >
                    Find Items
                  </Link>
                  <Link
                    to="/image-search"
                    className="inline-flex items-center px-1 pt-1 text-orange-600 hover:text-orange-800"
                  >
                    📷 Image Search
                  </Link>
                  <Link
                    to="/warehouse"
                    className="inline-flex items-center px-1 pt-1 text-purple-600 hover:text-purple-800"
                  >
                    Warehouse
                  </Link>
                  <Link
                    to="/add-inventory"
                    className="inline-flex items-center px-1 pt-1 text-green-600 hover:text-green-800 font-medium"
                  >
                    + Add Item
                  </Link>
                </>
              )}
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <Link
                    to="/profile"
                    className="text-gray-900 hover:text-gray-600"
                  >
                    {user.name}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-red-500 hover:text-red-700"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="text-gray-900 hover:text-gray-600"
                >
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/find-items" element={<FindItems />} />
          <Route path="/image-search" element={<ImageSearch />} />
          <Route path="/warehouse" element={<WarehouseQuery />} />
          <Route path="/add-inventory" element={<AddInventoryForm />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </main>
    </div>
    </ToastProvider>
  );
};

export default App;
