import { Response } from 'express';
import type { PoolClient } from 'pg';
import { AuthRequest } from '../middleware/auth';
import pool from '../config/database';

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

// PostgreSQL LIKE uses backslash as its default escape, including LIKE ANY patterns.
const containsPattern = (term: string) =>
  '%' + term.replace(/[\\%_]/g, (character) => '\\' + character) + '%';

function extractKeywords(filename: string): string[] {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  const words = nameWithoutExt.toLowerCase().split(/[_\-\s]+/);
  const stopWords = ['img', 'image', 'photo', 'pic', 'thumb', 'small', 'large', 'original', 'screenshot', 'capture'];
  return words.filter(w => w.length > 1 && !stopWords.includes(w));
}

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

export const getInventory = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await pool.query(
      'SELECT * FROM inventory ORDER BY id DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
};

export const addInventory = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { name, sku, quantity, min_stock_level, unit_price, category, location, image_url, description } = req.body;
    
    const result = await pool.query(
      `INSERT INTO inventory (name, sku, quantity, min_stock_level, unit_price, category, location, image_url, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [name, sku, quantity, min_stock_level ?? 10, unit_price ?? 0, category || 'General', location, image_url, description]
    );
    
    res.status(201).json(result.rows[0]);
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
      res.json({ results: [], suggestion: 'Enter a search term' });
      return;
    }
    
    const searchTerm = query.toString().toLowerCase();
    const relatedTerms = getAllRelatedTerms(searchTerm);
    const allTerms = [searchTerm, ...relatedTerms];
    
    const result = await pool.query(
      `SELECT * FROM inventory WHERE 
       LOWER(name) LIKE ANY($1) OR 
       LOWER(sku) LIKE ANY($1) OR 
       LOWER(category) LIKE ANY($1) OR 
       LOWER(COALESCE(description, '')) LIKE ANY($1)
       ORDER BY name`,
      [allTerms.map(containsPattern)]
    );
    
    res.json({
      results: result.rows,
      suggestion: result.rows.length > 0 
        ? `Found ${result.rows.length} item(s)`
        : `No items found matching "${query}". Try different keywords.`
    });
  } catch (error) {
    console.error('Error searching inventory:', error);
    res.status(500).json({ error: 'Failed to search inventory' });
  }
};

export const matchImage = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { filename } = req.body;
    
    if (!filename) {
      res.status(400).json({ error: 'No filename provided' });
      return;
    }
    
    const keywords = extractKeywords(filename);
    const allTerms = keywords.flatMap(k => [k, ...getAllRelatedTerms(k)]);
    
    const result = await pool.query(
      `SELECT * FROM inventory WHERE image_url IS NOT NULL AND (
       LOWER(name) LIKE ANY($1) OR 
       LOWER(category) LIKE ANY($1) OR
       LOWER(COALESCE(description, '')) LIKE ANY($1)
      ) ORDER BY name LIMIT 10`,
      [allTerms.map(containsPattern)]
    );
    
    res.json({
      matches: result.rows,
      totalMatches: result.rows.length,
      keywordsFound: keywords,
      message: result.rows.length > 0 
        ? `Found ${result.rows.length} matching items`
        : 'No matches found. Try uploading with a descriptive filename.'
    });
  } catch (error) {
    console.error('Error matching image:', error);
    res.status(500).json({ error: 'Failed to match image' });
  }
};

export const updateStock = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const { productId, adjustmentType, quantity, reason } = req.body;
    // Lock before reading the old quantity, so concurrent adjustments see the latest committed stock.
    // BIGINT arithmetic allows the bounds check to reject overflow before casting to INTEGER.
    const result = await client.query(
      `WITH current_stock AS (
         SELECT id, quantity FROM inventory WHERE id = $1 FOR UPDATE
       ), adjusted AS (
         SELECT id, quantity AS previous_quantity,
           CASE $2::text
             WHEN 'add' THEN quantity::bigint + $3::bigint
             WHEN 'remove' THEN quantity::bigint - $3::bigint
             WHEN 'set' THEN $3::bigint
           END AS new_quantity
         FROM current_stock
       )
       UPDATE inventory AS item
       SET quantity = adjusted.new_quantity::integer, updated_at = CURRENT_TIMESTAMP
       FROM adjusted
       WHERE item.id = adjusted.id AND adjusted.new_quantity BETWEEN 0 AND 2147483647
       RETURNING adjusted.previous_quantity, item.quantity AS new_quantity`,
      [productId, adjustmentType, quantity]
    );
    if (!result.rows.length) {
      const exists = await client.query('SELECT 1 FROM inventory WHERE id = $1', [productId]);
      await client.query('ROLLBACK');
      res.status(exists.rows.length ? 409 : 404).json({
        error: exists.rows.length ? 'Adjustment would put stock outside the allowed range.' : 'Product not found',
      });
      return;
    }
    const { previous_quantity: previousQuantity, new_quantity: newQuantity } = result.rows[0];
    await client.query(
      `INSERT INTO inventory_history
         (product_id, user_id, adjustment_type, quantity, previous_quantity, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [productId, req.userId, adjustmentType, quantity, previousQuantity, reason]
    );
    await client.query('COMMIT');
    res.json({ success: true, newQuantity, previousQuantity });
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // A failed rollback means the connection must not return to the pool.
        client.release(true);
        client = undefined;
      }
    }
    console.error('Error updating stock:', error);
    res.status(500).json({ error: 'Failed to update stock' });
  } finally {
    client?.release();
  }
};

export const getLowStockItems = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const result = await pool.query(
      'SELECT * FROM inventory WHERE quantity <= min_stock_level ORDER BY quantity'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching low stock items:', error);
    res.status(500).json({ error: 'Failed to fetch low stock items' });
  }
};

export const getInventoryHistory = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { productId } = req.params;
    const result = await pool.query(
      `SELECT ih.*, u.name as user_name
       FROM inventory_history ih
       LEFT JOIN users u ON ih.user_id = u.id
       WHERE ih.product_id = $1
       ORDER BY ih.created_at DESC`,
      [productId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching inventory history:', error);
    res.status(500).json({ error: 'Failed to fetch inventory history' });
  }
};
