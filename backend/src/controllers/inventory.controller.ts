import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';

let pool: any;
try {
  pool = require('../config/database').default;
} catch (error) {
  console.warn('Database not connected:', error);
}

const MOCK_INVENTORY: any[] = [
  {
    id: 1,
    name: 'Blue Umbrella',
    sku: 'UMB-BLU-001',
    quantity: 25,
    min_stock_level: 5,
    category: 'Weather Protection',
    location: 'A-1-3',
    image_url: '/uploads/images/blue_umb.jpeg',
    description: 'Standard blue umbrella, 23-inch canopy',
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    name: 'Metal Bolt',
    sku: 'BLT-MTL-001',
    quantity: 150,
    min_stock_level: 50,
    category: 'Fasteners',
    location: 'B-3-1',
    image_url: '/uploads/images/bolt.jpeg',
    description: 'Stainless steel hex bolt, M8x30mm',
    created_at: new Date().toISOString(),
  },
  {
    id: 3,
    name: 'Metal Clamp',
    sku: 'CLP-MTL-001',
    quantity: 80,
    min_stock_level: 20,
    category: 'Hardware',
    location: 'B-3-2',
    image_url: '/uploads/images/metal_clamp.jpeg',
    description: 'Heavy-duty metal C-clamp, 6-inch',
    created_at: new Date().toISOString(),
  },
  {
    id: 4,
    name: 'Red Bolt',
    sku: 'BLT-RED-001',
    quantity: 45,
    min_stock_level: 15,
    category: 'Fasteners',
    location: 'B-3-3',
    image_url: '/uploads/images/red_bolt.jpeg',
    description: 'Red painted hex bolt, M10x40mm',
    created_at: new Date().toISOString(),
  },
  {
    id: 5,
    name: 'Standard Umbrella',
    sku: 'UMB-STD-001',
    quantity: 30,
    min_stock_level: 10,
    category: 'Weather Protection',
    location: 'A-1-4',
    image_url: '/uploads/images/umbrella.jpeg',
    description: 'Black standard umbrella, 21-inch canopy',
    created_at: new Date().toISOString(),
  },
  {
    id: 6,
    name: 'Widget B',
    sku: 'WDG-B-001',
    quantity: 12,
    min_stock_level: 5,
    category: 'Components',
    location: 'C-2-1',
    image_url: '/uploads/images/widget_b.jpg',
    description: 'Widget type B, assembly component',
    created_at: new Date().toISOString(),
  },
  {
    id: 7,
    name: 'Product Photo 1',
    sku: 'PHOTO-001',
    quantity: 3,
    min_stock_level: 2,
    category: 'Documentation',
    location: 'D-5-1',
    image_url: '/uploads/images/photo_20251023_043829.jpg',
    description: 'Product reference photo',
    created_at: new Date().toISOString(),
  },
  {
    id: 8,
    name: 'Product Photo 2',
    sku: 'PHOTO-002',
    quantity: 3,
    min_stock_level: 2,
    category: 'Documentation',
    location: 'D-5-2',
    image_url: '/uploads/images/photo_20251023_171346.jpg',
    description: 'Product reference photo',
    created_at: new Date().toISOString(),
  },
  {
    id: 9,
    name: 'Product Photo 3',
    sku: 'PHOTO-003',
    quantity: 3,
    min_stock_level: 2,
    category: 'Documentation',
    location: 'D-5-3',
    image_url: '/uploads/images/photo_20251024_013216.jpg',
    description: 'Product reference photo',
    created_at: new Date().toISOString(),
  },
  {
    id: 10,
    name: 'Product Photo 4',
    sku: 'PHOTO-004',
    quantity: 3,
    min_stock_level: 2,
    category: 'Documentation',
    location: 'D-5-4',
    image_url: '/uploads/images/photo_20251030_001146.jpg',
    description: 'Product reference photo',
    created_at: new Date().toISOString(),
  },
  {
    id: 11,
    name: 'Product Photo 5',
    sku: 'PHOTO-005',
    quantity: 3,
    min_stock_level: 2,
    category: 'Documentation',
    location: 'D-5-5',
    image_url: '/uploads/images/photo_20251030_001207.jpg',
    description: 'Product reference photo',
    created_at: new Date().toISOString(),
  },
];

export const addInventory = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, sku, quantity, min_stock_level, category, location, image_url, description } = req.body;
    
    const newItem = {
      id: MOCK_INVENTORY.length > 0 ? Math.max(...MOCK_INVENTORY.map(i => i.id)) + 1 : 1,
      name,
      sku,
      quantity,
      min_stock_level: min_stock_level || 10,
      category: category || 'Uncategorized',
      location: location || null,
      image_url: image_url || null,
      description: description || null,
      created_at: new Date().toISOString(),
    };
    
    MOCK_INVENTORY.push(newItem);
    res.status(201).json(newItem);
  } catch (error) {
    console.error('Error adding inventory:', error);
    res.status(500).json({ error: 'Failed to add inventory item' });
  }
};

export const searchInventory = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { query } = req.query;
    
    if (!query) {
      res.json([]);
      return;
    }
    
    const searchTerm = query.toString().toLowerCase();
    
    const results = MOCK_INVENTORY.filter((item: any) => {
      return (
        item.name?.toLowerCase().includes(searchTerm) ||
        item.sku?.toLowerCase().includes(searchTerm) ||
        item.category?.toLowerCase().includes(searchTerm) ||
        item.description?.toLowerCase().includes(searchTerm)
      );
    });
    
    res.json({
      results,
      suggestion: results.length === 0 
        ? `No exact matches found. Try different keywords or check spelling.`
        : `Found ${results.length} item(s) matching your search.`
    });
  } catch (error) {
    console.error('Error searching inventory:', error);
    res.status(500).json({ error: 'Failed to search inventory' });
  }
};

function extractKeywords(filename: string): string[] {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  const words = nameWithoutExt.toLowerCase().split(/[_\-\s]+/);
  const stopWords = ['img', 'image', 'photo', 'pic', 'thumb', 'small', 'large', 'original', 'screenshot', 'capture', 'img'];
  return words.filter(w => w.length > 1 && !stopWords.includes(w));
}

const SYNONYMS: { [key: string]: string[] } = {
  'bolt': ['screw', 'fastener', 'stud', 'rod', 'pole', 'pin', 'rivet'],
  'screw': ['bolt', 'fastener', 'rivet', 'nail'],
  'pole': ['rod', 'stick', 'post', 'bar', 'shaft'],
  'rod': ['pole', 'stick', 'bar', 'shaft', 'pipe'],
  'pipe': ['tube', 'cylinder', 'hose', 'conduit'],
  'clamp': ['clip', 'holder', 'bracket', 'grip', 'vice'],
  'umbrella': ['parasol', 'sunshade', 'canopy'],
  'metal': ['steel', 'iron', 'aluminum', 'brass', 'copper'],
  'blue': ['azure', 'cobalt', 'navy', 'sky'],
  'red': ['crimson', 'scarlet', 'ruby', 'maroon'],
  'widget': ['gadget', 'component', 'part', 'device', 'unit'],
  'standard': ['regular', 'normal', 'basic', 'typical'],
  'product': ['item', 'goods', 'merchandise', 'article'],
};

function getAllRelatedTerms(word: string): string[] {
  const wordLower = word.toLowerCase();
  const related = new Set<string>();
  related.add(wordLower);
  
  if (SYNONYMS[wordLower]) {
    SYNONYMS[wordLower].forEach(syn => related.add(syn));
  }
  
  for (const [key, synonyms] of Object.entries(SYNONYMS)) {
    if (synonyms.includes(wordLower)) {
      related.add(key);
      synonyms.forEach(s => related.add(s));
    }
  }
  
  return Array.from(related);
}

function fuzzyMatch(searchTerm: string, text: string): boolean {
  const search = searchTerm.toLowerCase();
  const target = text.toLowerCase();
  
  if (target.includes(search)) return true;
  
  if (search.length >= 3 && target.length >= 3) {
    if (target.startsWith(search.substring(0, 3))) return true;
    if (search.startsWith(target.substring(0, 3))) return true;
  }
  
  return false;
}

function calculateMatchScore(searchTerms: string[], item: any): { score: number; matchedTerms: string[] } {
  const itemText = `${item.name} ${item.sku} ${item.description || ''} ${item.category || ''}`.toLowerCase();
  let score = 0;
  const matchedTerms: string[] = [];
  
  for (const term of searchTerms) {
    const relatedTerms = getAllRelatedTerms(term);
    
    let termMatched = false;
    for (const relatedTerm of relatedTerms) {
      if (item.name.toLowerCase().includes(relatedTerm)) {
        score += 3;
        termMatched = true;
        matchedTerms.push(term);
        break;
      }
    }
    
    if (!termMatched) {
      for (const relatedTerm of relatedTerms) {
        if (itemText.includes(relatedTerm)) {
          score += 1;
          termMatched = true;
          matchedTerms.push(term);
          break;
        }
      }
    }
    
    if (!termMatched && fuzzyMatch(term, itemText)) {
      score += 0.5;
      matchedTerms.push(term);
    }
  }
  
  return { score, matchedTerms };
}

export const matchImage = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { filename, base64 } = req.body;
    
    if (!filename && !base64) {
      res.status(400).json({ error: 'No image provided' });
      return;
    }
    
    const keywords = extractKeywords(filename || 'unknown');
    
    const scoredItems = MOCK_INVENTORY
      .filter(item => item.image_url)
      .map(item => {
        const { score, matchedTerms } = calculateMatchScore(keywords, item);
        return {
          ...item,
          matchScore: score,
          matchReason: matchedTerms.length > 0 
            ? `Matched: ${matchedTerms.join(', ')}`
            : ''
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore);
    
    const threshold = 0.5;
    const matches = scoredItems.filter(item => item.matchScore >= threshold);
    
    res.json({
      matches: matches.slice(0, 10),
      totalMatches: matches.length,
      keywordsFound: keywords,
      message: matches.length > 0 
        ? `Found ${matches.length} item(s) matching your image`
        : 'No matches found. Try uploading with a descriptive filename.'
    });
  } catch (error) {
    console.error('Error matching image:', error);
    res.status(500).json({ error: 'Failed to match image' });
  }
};

export const getInventory = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!pool) {
      res.json(MOCK_INVENTORY);
      return;
    }
    const result = await pool.query(
      'SELECT * FROM inventory ORDER BY product_name'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.json(MOCK_INVENTORY);
  }
};

export const updateStock = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!pool) {
      res.status(500).json({ error: 'Database not connected' });
      return;
    }
    const { productId, quantity, reason } = req.body;
    const userId = req.userId;

    const result = await pool.query(
      `INSERT INTO inventory_history (product_id, quantity_change, reason, updated_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [productId, quantity, reason, userId]
    );

    await pool.query(
      'UPDATE inventory SET quantity = quantity + $1 WHERE id = $2',
      [quantity, productId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating stock:', error);
    res.status(500).json({ error: 'Failed to update stock' });
  }
};

export const getLowStockItems = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!pool) {
      res.json([]);
      return;
    }
    const threshold = parseInt(req.query.threshold as string) || 10;
    const result = await pool.query(
      'SELECT * FROM inventory WHERE quantity <= $1 ORDER BY quantity',
      [threshold]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching low stock items:', error);
    res.json([]);
  }
};

export const getInventoryHistory = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!pool) {
      res.json([]);
      return;
    }
    const { productId } = req.params;
    const result = await pool.query(
      `SELECT ih.*, u.name as updated_by_name
       FROM inventory_history ih
       LEFT JOIN users u ON ih.updated_by = u.id
       WHERE ih.product_id = $1
       ORDER BY ih.created_at DESC`,
      [productId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching inventory history:', error);
    res.json([]);
  }
};
