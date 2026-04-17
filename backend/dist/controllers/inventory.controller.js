"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInventoryHistory = exports.getLowStockItems = exports.updateStock = exports.matchImage = exports.searchInventory = exports.addInventory = exports.getInventory = void 0;
const database_1 = __importDefault(require("../config/database"));
const MOCK_INVENTORY = [];
const SYNONYMS = {
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
function extractKeywords(filename) {
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    const words = nameWithoutExt.toLowerCase().split(/[_\-\s]+/);
    const stopWords = ['img', 'image', 'photo', 'pic', 'thumb', 'small', 'large', 'original', 'screenshot', 'capture'];
    return words.filter(w => w.length > 1 && !stopWords.includes(w));
}
function getAllRelatedTerms(word) {
    const wordLower = word.toLowerCase();
    const related = new Set();
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
function fuzzyMatch(searchTerm, text) {
    const search = searchTerm.toLowerCase();
    const target = text.toLowerCase();
    if (target.includes(search))
        return true;
    if (search.length >= 3 && target.length >= 3) {
        if (target.startsWith(search.substring(0, 3)))
            return true;
        if (search.startsWith(target.substring(0, 3)))
            return true;
    }
    return false;
}
const getInventory = async (req, res) => {
    try {
        const result = await database_1.default.query('SELECT * FROM inventory ORDER BY id DESC');
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error fetching inventory:', error);
        res.json(MOCK_INVENTORY);
    }
};
exports.getInventory = getInventory;
const addInventory = async (req, res) => {
    try {
        const { name, sku, quantity, min_stock_level, unit_price, category, location, image_url, description } = req.body;
        const result = await database_1.default.query(`INSERT INTO inventory (name, sku, quantity, min_stock_level, unit_price, category, location, image_url, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`, [name, sku, quantity, min_stock_level || 10, unit_price || 0, category || 'General', location, image_url, description]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        console.error('Error adding inventory:', error);
        res.status(500).json({ error: 'Failed to add inventory item' });
    }
};
exports.addInventory = addInventory;
const searchInventory = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            res.json({ results: [], suggestion: 'Enter a search term' });
            return;
        }
        const searchTerm = query.toString().toLowerCase();
        const relatedTerms = getAllRelatedTerms(searchTerm);
        const allTerms = [searchTerm, ...relatedTerms];
        const result = await database_1.default.query(`SELECT * FROM inventory WHERE 
       LOWER(name) LIKE ANY($1) OR 
       LOWER(sku) LIKE ANY($1) OR 
       LOWER(category) LIKE ANY($1) OR 
       LOWER(COALESCE(description, '')) LIKE ANY($1)
       ORDER BY name`, [allTerms.map(t => `%${t}%`)]);
        res.json({
            results: result.rows,
            suggestion: result.rows.length > 0
                ? `Found ${result.rows.length} item(s)`
                : `No items found matching "${query}". Try different keywords.`
        });
    }
    catch (error) {
        console.error('Error searching inventory:', error);
        res.status(500).json({ error: 'Failed to search inventory' });
    }
};
exports.searchInventory = searchInventory;
const matchImage = async (req, res) => {
    try {
        const { filename } = req.body;
        if (!filename) {
            res.status(400).json({ error: 'No filename provided' });
            return;
        }
        const keywords = extractKeywords(filename);
        const allTerms = keywords.flatMap(k => [k, ...getAllRelatedTerms(k)]);
        const result = await database_1.default.query(`SELECT * FROM inventory WHERE image_url IS NOT NULL AND (
       LOWER(name) LIKE ANY($1) OR 
       LOWER(category) LIKE ANY($1) OR
       LOWER(COALESCE(description, '')) LIKE ANY($1)
      ) ORDER BY name LIMIT 10`, [allTerms.map(t => `%${t}%`)]);
        res.json({
            matches: result.rows,
            totalMatches: result.rows.length,
            keywordsFound: keywords,
            message: result.rows.length > 0
                ? `Found ${result.rows.length} matching items`
                : 'No matches found. Try uploading with a descriptive filename.'
        });
    }
    catch (error) {
        console.error('Error matching image:', error);
        res.status(500).json({ error: 'Failed to match image' });
    }
};
exports.matchImage = matchImage;
const updateStock = async (req, res) => {
    try {
        const { productId, adjustmentType, quantity, reason } = req.body;
        const userId = req.userId;
        const itemResult = await database_1.default.query('SELECT quantity FROM inventory WHERE id = $1', [productId]);
        if (itemResult.rows.length === 0) {
            res.status(404).json({ error: 'Product not found' });
            return;
        }
        const previousQuantity = itemResult.rows[0].quantity;
        let newQuantity = previousQuantity;
        switch (adjustmentType) {
            case 'add':
                newQuantity = previousQuantity + quantity;
                break;
            case 'remove':
                newQuantity = previousQuantity - quantity;
                break;
            case 'set':
                newQuantity = quantity;
                break;
        }
        await database_1.default.query('BEGIN');
        await database_1.default.query('UPDATE inventory SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newQuantity, productId]);
        await database_1.default.query(`INSERT INTO inventory_history (product_id, adjustment_type, quantity, previous_quantity, reason)
       VALUES ($1, $2, $3, $4, $5)`, [productId, adjustmentType, quantity, previousQuantity, reason]);
        await database_1.default.query('COMMIT');
        res.json({ success: true, newQuantity, previousQuantity });
    }
    catch (error) {
        await database_1.default.query('ROLLBACK');
        console.error('Error updating stock:', error);
        res.status(500).json({ error: 'Failed to update stock' });
    }
};
exports.updateStock = updateStock;
const getLowStockItems = async (req, res) => {
    try {
        const result = await database_1.default.query('SELECT * FROM inventory WHERE quantity <= min_stock_level ORDER BY quantity');
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error fetching low stock items:', error);
        res.json([]);
    }
};
exports.getLowStockItems = getLowStockItems;
const getInventoryHistory = async (req, res) => {
    try {
        const { productId } = req.params;
        const result = await database_1.default.query(`SELECT ih.*, u.name as user_name
       FROM inventory_history ih
       LEFT JOIN users u ON ih.previous_quantity = u.id
       WHERE ih.product_id = $1
       ORDER BY ih.created_at DESC`, [productId]);
        res.json(result.rows);
    }
    catch (error) {
        console.error('Error fetching inventory history:', error);
        res.json([]);
    }
};
exports.getInventoryHistory = getInventoryHistory;
//# sourceMappingURL=inventory.controller.js.map