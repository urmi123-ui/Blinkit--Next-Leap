const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Open Database connection
const dbPath = process.env.SQLITE_DB_PATH ? path.resolve(process.env.SQLITE_DB_PATH) : path.resolve(__dirname, 'blinkit_mvp.db');

// Ensure parent directory exists for database file
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database for server:', err.message);
    process.exit(1);
  }
  console.log('Server connected to SQLite database at:', dbPath);
});

// Database helper promises
function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Product-to-Brand lookup map for pilot categories
const productToBrandMap = {
  'p101': 'brand_beauty_co',
  'p102': 'brand_personal_care_pro',
  'p103': 'brand_baby_safe',
  'p104': 'brand_unverified'
};

// GET /health
// Monitors the API server health and SQLite database availability.
// Secured with a Health API Key configuration.
app.get('/health', async (req, res) => {
  const apiKey = req.headers['x-health-api-key'];
  const expectedKey = process.env.HEALTH_API_KEY;

  if (!expectedKey) {
    console.warn('HEALTH_API_KEY is not configured in the environment.');
    return res.status(500).json({ error: 'Health configuration missing.' });
  }

  if (apiKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized health probe. Invalid API Key.' });
  }

  try {
    // Perform quick verification query
    await getQuery('SELECT 1');
    res.json({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (err) {
    console.error('Health probe database error:', err.message);
    res.status(503).json({
      status: 'unhealthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: err.message
    });
  }
});

// 1. GET /v1/config/flags
// Returns the status of remote feature flags
app.get('/v1/config/flags', async (req, res) => {
  try {
    const rows = await allQuery('SELECT flag_name, is_enabled FROM feature_flags');
    const flags = {};
    rows.forEach(row => {
      flags[row.flag_name] = !!row.is_enabled;
    });
    res.json(flags);
  } catch (err) {
    console.error('Error fetching flags:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 2. GET /v1/finds/feed
// Returns the short-form video discovery feed with pagination (cursor-based)
app.get('/v1/finds/feed', async (req, res) => {
  try {
    // Read feature flags first
    const flagRow = await getQuery("SELECT is_enabled FROM feature_flags WHERE flag_name = 'finds_enabled'");
    if (flagRow && !flagRow.is_enabled) {
      return res.json({ data: [], next_cursor: null, has_more: false });
    }

    const limit = parseInt(req.query.limit, 10) || 5;
    const cursor = req.query.cursor;

    let sql = 'SELECT * FROM finds_feed WHERE status = "active"';
    let params = [];

    if (cursor) {
      sql = `
        SELECT * FROM finds_feed 
        WHERE status = "active" 
          AND priority > (SELECT priority FROM finds_feed WHERE id = ?) 
        ORDER BY priority ASC 
        LIMIT ?
      `;
      params = [cursor, limit];
    } else {
      sql = 'SELECT * FROM finds_feed WHERE status = "active" ORDER BY priority ASC LIMIT ?';
      params = [limit];
    }

    const items = await allQuery(sql, params);

    let nextCursor = null;
    let hasMore = false;

    if (items.length > 0) {
      const lastItem = items[items.length - 1];
      // Check if there are more items beyond the last loaded one
      const checkMore = await getQuery(
        'SELECT id FROM finds_feed WHERE status = "active" AND priority > ? LIMIT 1',
        [lastItem.priority]
      );
      if (checkMore) {
        nextCursor = lastItem.id;
        hasMore = true;
      }
    }

    res.json({
      data: items.map(item => ({
        id: item.id,
        video_url: item.video_url,
        product_id: item.product_id,
        product_title: item.product_title,
        product_price: item.product_price,
        category: item.category,
        priority: item.priority
      })),
      next_cursor: nextCursor,
      has_more: hasMore
    });
  } catch (err) {
    console.error('Error fetching finds feed:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 3. GET /v1/trust/products/:product_id
// Returns ratings summary, reviews, aggregated customer photos, and authenticity badges for a PDP
app.get('/v1/trust/products/:product_id', async (req, res) => {
  const productId = req.params.product_id;
  if (productId === 'fail') {
    return res.status(500).json({ error: 'Database connection failed. (Simulated Error)' });
  }
  try {
    // Read PDP trust layer flag first
    const flagRow = await getQuery("SELECT is_enabled FROM feature_flags WHERE flag_name = 'enhanced_pdp_trust'");
    if (flagRow && !flagRow.is_enabled) {
      return res.status(404).json({ error: 'Trust layer is currently disabled.' });
    }

    // Fetch rating summary
    const summary = await getQuery(`
      SELECT 
        AVG(rating) as average, 
        COUNT(*) as count 
      FROM product_reviews 
      WHERE product_id = ? AND moderation_status = 'approved'
    `, [productId]);

    // Fetch reviews
    const reviews = await allQuery(`
      SELECT * FROM product_reviews 
      WHERE product_id = ? AND moderation_status = 'approved' 
      ORDER BY created_at DESC
    `, [productId]);

    // Parse and aggregate customer photos from reviews
    const customerPhotos = [];
    const parsedReviews = reviews.map(r => {
      let photosArray = [];
      try {
        photosArray = JSON.parse(r.photos || '[]');
      } catch (e) {
        photosArray = [];
      }
      photosArray.forEach(p => customerPhotos.push(p));
      return {
        id: r.id,
        rating: r.rating,
        text: r.review_text,
        verified_buyer: !!r.verified_buyer,
        photos: photosArray,
        created_at: r.created_at
      };
    });

    // Fetch brand authenticity info
    let authenticityBadge = null;
    const brandId = productToBrandMap[productId];
    if (brandId && summary.count >= 3) {
      const brandRow = await getQuery(
        'SELECT brand_name, badge_type FROM brand_authenticity WHERE brand_id = ?',
        [brandId]
      );
      if (brandRow) {
        authenticityBadge = {
          brand_name: brandRow.brand_name,
          badge_type: brandRow.badge_type
        };
      }
    }

    res.json({
      product_id: productId,
      rating_summary: {
        average_rating: summary.count > 0 ? parseFloat(summary.average.toFixed(2)) : 0,
        total_reviews: summary.count
      },
      reviews: parsedReviews,
      customer_photos: customerPhotos,
      authenticity_badge: authenticityBadge
    });
  } catch (err) {
    console.error('Error fetching product trust layer:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Blinkit Finds MVP server is running on port ${PORT}`);
});
