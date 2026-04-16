# AI Stock Assistant

An intelligent inventory management system with AI-powered image recognition for warehouse operations.

## Features

- **Dashboard** - Real-time inventory metrics and visualizations
- **Inventory Management** - Track stock levels, locations, and items
- **AI Image Search** - Upload photos to find matching items using TensorFlow.js
- **Warehouse Query** - Search items by location, SKU, or name
- **Smart Suggestions** - Auto-detect category and SKU prefix from images
- **User Authentication** - Login/register system with JWT tokens

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **React Query** - Data fetching and caching
- **React Router** - Navigation
- **Chart.js** - Dashboard visualizations
- **TensorFlow.js** - Browser-based AI image classification
- **Tailwind CSS** - Styling

### Backend
- **Node.js** with Express
- **TypeScript**
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **Socket.io** - Real-time updates
- **Multer** - File uploads

### Data
- **In-memory storage** (default) - No database setup required
- **PostgreSQL** - Optional database for production

## Project Structure

```
AIStockAssistant/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.ts       # Database connection
│   │   ├── controllers/
│   │   │   ├── auth.controllers.ts   # Login/register logic
│   │   │   └── inventory.controller.ts  # Inventory CRUD + AI matching
│   │   ├── middleware/
│   │   │   └── auth.ts          # JWT authentication
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   └── inventory.routes.ts
│   │   ├── uploads/
│   │   │   └── images/          # Product images
│   │   └── index.ts             # Express server setup
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── dashboard/
│   │   │   │   └── InventoryMetrics.tsx
│   │   │   └── inventory/
│   │   │       ├── ImageSearch.tsx    # AI image search
│   │   │       └── StockTable.tsx
│   │   ├── services/
│   │   │   └── api.ts           # API client
│   │   ├── App.tsx              # Main app with routes
│   │   ├── index.tsx            # React entry point
│   │   └── index.css            # Tailwind styles
│   └── package.json
├── database/                     # Database schemas (optional)
├── run.sh                        # Start both services
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

1. **Install backend dependencies:**
```bash
cd backend
npm install
```

2. **Install frontend dependencies:**
```bash
cd frontend
npm install
```

### Running the Application

**Option 1: Run both services together**
```bash
bash run.sh
```

**Option 2: Run separately**

Terminal 1 - Backend (port 5000):
```bash
cd backend
npm run dev
```

Terminal 2 - Frontend (port 3000):
```bash
cd frontend
npm start
```

Access the app at: http://localhost:3000

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |

### Inventory
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inventory` | Get all items |
| POST | `/api/inventory/add` | Add new item |
| POST | `/api/inventory/adjust` | Adjust stock level |
| GET | `/api/inventory/search` | Search items |
| POST | `/api/inventory/match-image` | Match image to items |
| GET | `/api/inventory/low-stock` | Get low stock items |

### Other
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/dashboard/metrics` | Dashboard statistics |
| POST | `/api/upload` | Upload product image |

## Location Format

All warehouse locations use the format: `Isle-Row-Shelf`

Examples:
- `A-1-3` = Isle A, Row 1, Shelf 3
- `B-3-1` = Isle B, Row 3, Shelf 1

## SKU Prefix Mappings

The system auto-suggests SKU prefixes based on item type:

| Category | Prefix | Examples |
|---------|--------|---------|
| Fasteners | BLT, SCW, RVT | Bolts, Screws, Rivets |
| Tools | HMR, WRN, SDV | Hammers, Wrenches, Screwdrivers |
| Electrical | WIR, CBL, PLG | Wires, Cables, Plugs |
| Plumbing | PIP, HSE, VLV | Pipes, Hoses, Valves |
| Safety | HLM, GLV, GOG | Helmets, Gloves, Goggles |
| Weather | UMB, PRL | Umbrellas, Parasols |

## AI Image Search

The system uses TensorFlow.js with MobileNet for browser-based image classification:

1. Upload a photo of an item
2. AI analyzes the image to identify what it is
3. Matches against inventory using semantic understanding
4. Shows results ranked by match confidence

### Synonym Matching

The AI understands related terms:
- `bolt` ↔ `screw` ↔ `rivet` ↔ `fastener`
- `pipe` ↔ `tube` ↔ `hose`
- `metal` ↔ `steel` ↔ `iron` ↔ `brass`

## Adding Inventory

When adding items, you can:
1. **Enter details manually** - Name, SKU, quantity, location
2. **Upload an image** - AI will auto-detect category and suggest SKU prefix
3. **Set location** - Use format `Isle-Row-Shelf` (e.g., `A-1-3`)

## Image Storage

Product images are stored in:
```
backend/uploads/images/
```

Images are served at: `http://localhost:5000/uploads/images/<filename>`

## User Roles

Currently implemented:
- **Admin** - Full access to add inventory, view all data
- **User** - Can search and find items, view warehouse locations

## Environment Variables

### Backend (.env)
```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=stock_inventory
DB_USER=postgres
DB_PASSWORD=yourpassword
JWT_SECRET=your-secret-key
FRONTEND_URL=http://localhost:3000
```

### Frontend
```env
REACT_APP_API_URL=http://localhost:5000/api
```

## Production Deployment

1. Set up PostgreSQL database
2. Run database migrations from `/database/` folder
3. Set environment variables
4. Build frontend: `npm run build`
5. Serve static files from backend or use CDN

## License

MIT
