const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.SQLITE_DB_PATH ? path.resolve(process.env.SQLITE_DB_PATH) : path.resolve(__dirname, 'blinkit_mvp.db');

// Ensure parent directory exists for database file
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database at:', dbPath);
});

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
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

async function initDb() {
  try {
    console.log('Initializing database schemas...');

    // 1. Feature Flags Table
    await runQuery(`
      CREATE TABLE IF NOT EXISTS feature_flags (
        flag_name TEXT PRIMARY KEY,
        is_enabled INTEGER DEFAULT 0,
        description TEXT
      )
    `);

    // 2. Brand Authenticity Table
    await runQuery(`
      CREATE TABLE IF NOT EXISTS brand_authenticity (
        brand_id TEXT PRIMARY KEY,
        brand_name TEXT NOT NULL,
        badge_type TEXT CHECK(badge_type IN ('verified_brand', 'genuine_100'))
      )
    `);

    // 3. Product Reviews Table
    await runQuery(`
      CREATE TABLE IF NOT EXISTS product_reviews (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
        review_text TEXT,
        verified_buyer INTEGER DEFAULT 1 CHECK(verified_buyer IN (0, 1)),
        moderation_status TEXT DEFAULT 'approved',
        photos TEXT, -- JSON array of strings: '["url1", "url2"]'
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 4. Finds Feed Table
    await runQuery(`
      CREATE TABLE IF NOT EXISTS finds_feed (
        id TEXT PRIMARY KEY,
        video_url TEXT NOT NULL,
        product_id TEXT NOT NULL,
        product_title TEXT NOT NULL,
        product_price REAL NOT NULL,
        category TEXT NOT NULL,
        priority INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active'
      )
    `);

    console.log('Schemas initialized successfully. Seeding data...');

    // Seed Feature Flags
    const flags = [
      ['finds_enabled', 1, 'Gates the display of the Blinkit Finds tab/entry points in the app'],
      ['enhanced_pdp_trust', 1, 'Gates the display of ratings, reviews, buyer photos, and badges on PDP'],
      ['pilot_category_allowlist', 1, 'Enforces pilot categories (Beauty, Personal Care, Baby Care)'],
      ['finds_min_app_version', 1, 'Controls minimal mobile app version allowed to run Finds MVP']
    ];
    for (const [name, val, desc] of flags) {
      await runQuery(
        'INSERT OR REPLACE INTO feature_flags (flag_name, is_enabled, description) VALUES (?, ?, ?)',
        [name, val, desc]
      );
    }

    // Seed Brand Authenticity Allowlist
    const brands = [
      ['brand_beauty_co', 'The Beauty Co.', 'verified_brand'],
      ['brand_pet_life', 'Pet Life', 'verified_brand'],
      ['brand_decor_pro', 'DecorPro', 'genuine_100'],
      ['brand_safeguard', 'SafeGuard', 'verified_brand'],
      ['brand_sonic_sound', 'SonicSound', 'genuine_100']
    ];
    for (const [id, name, type] of brands) {
      await runQuery(
        'INSERT OR REPLACE INTO brand_authenticity (brand_id, brand_name, badge_type) VALUES (?, ?, ?)',
        [id, name, type]
      );
    }

    // Seed Product Reviews
    const reviews = [
      // Product p101 - Beauty Co. Glycolic Vitamin C Serum
      ['r1', 'p101', 5, 'This Glycolic Vitamin C Serum is amazing! It faded my dark spots in two weeks.', 1, 'approved', JSON.stringify(['https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=120&auto=format&fit=crop&q=60', 'https://images.unsplash.com/photo-1612817288484-6f916006741a?w=120&auto=format&fit=crop&q=60']), '2026-07-28T10:00:00Z'],
      ['r2', 'p101', 4, 'Very light texture, absorbs quickly and gives a nice healthy glow.', 1, 'approved', JSON.stringify([]), '2026-07-27T14:30:00Z'],
      ['r3', 'p101', 5, 'Highly recommend. The formula is non-sticky and the brightening effect is visible within days.', 1, 'approved', JSON.stringify(['https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?w=120&auto=format&fit=crop&q=60']), '2026-07-25T09:15:00Z'],

      // Product p102 - Pet Life Waterless Shampoo
      ['r4', 'p102', 5, 'Perfect for my golden retriever! No water needed, leaves a great smell.', 1, 'approved', JSON.stringify(['https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=120&auto=format&fit=crop&q=60', 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=120&auto=format&fit=crop&q=60']), '2026-07-29T11:00:00Z'],
      ['r5', 'p102', 4, 'Really handy for quick cleanups after walks. The pump is super easy to use.', 1, 'approved', JSON.stringify([]), '2026-07-26T18:20:00Z'],
      ['r11', 'p102', 5, 'Excellent product, highly recommend for easy dry pet shampooing!', 1, 'approved', JSON.stringify([]), '2026-07-25T14:10:00Z'],

      // Product p103 - Copper String LED Fairy Lights
      ['r6', 'p103', 5, 'These copper string fairy lights look beautiful in my room! Safe to touch and bright.', 1, 'approved', JSON.stringify(['https://images.unsplash.com/photo-1517263904808-5dc91e3e7044?w=120&auto=format&fit=crop&q=60', 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=120&auto=format&fit=crop&q=60']), '2026-07-29T08:00:00Z'],
      ['r7', 'p103', 5, 'High quality wires. Reused them for multiple festivals already. 100% genuine.', 1, 'approved', JSON.stringify([]), '2026-07-24T12:00:00Z'],
      ['r12', 'p103', 4, 'Very soft glow, creates a warm and beautiful ambiance.', 1, 'approved', JSON.stringify([]), '2026-07-23T16:05:00Z'],

      // Product p104 - Pest Killer Spray
      ['r8', 'p104', 4, 'Decent mosquito repelling spray. Odorless and highly effective.', 1, 'approved', JSON.stringify(['https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=120&auto=format&fit=crop&q=60']), '2026-07-28T16:00:00Z'],

      // Product p105 - Wireless Over-Ear Headphones
      ['r9', 'p105', 5, 'Outstanding sound quality and active noise cancellation. Batteries last forever.', 1, 'approved', JSON.stringify(['https://images.unsplash.com/photo-1484704849700-f032a568e944?w=120&auto=format&fit=crop&q=60', 'https://images.unsplash.com/photo-1487215078519-e21cc028cb29?w=120&auto=format&fit=crop&q=60']), '2026-07-29T15:00:00Z'],
      ['r10', 'p105', 4, 'Very comfortable ear cups. Connects instantly to my phone. Premium product.', 1, 'approved', JSON.stringify([]), '2026-07-28T10:00:00Z'],
      ['r13', 'p105', 5, 'Highly durable build and incredible battery life. Best value!', 1, 'approved', JSON.stringify([]), '2026-07-27T11:45:00Z']
    ];
    for (const [id, pid, rating, text, vb, mod, photos, date] of reviews) {
      await runQuery(
        'INSERT OR REPLACE INTO product_reviews (id, product_id, rating, review_text, verified_buyer, moderation_status, photos, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, pid, rating, text, vb, mod, photos, date]
      );
    }

    // Seed Finds Feed (Curated discovery short-form videos)
    const feed = [
      ['f1', '/video/video_in_which_user_is_unboxin.mp4', 'p101', 'Glycolic Vitamin C Serum', 599.00, 'beauty', 1, 'active'],
      ['f2', '/video/1.mp4', 'p102', 'Pet Life Waterless Shampoo', 350.00, 'personal_care', 2, 'active'],
      ['f3', '/video/2.mp4', 'p103', 'Copper String LED Fairy Lights', 199.00, 'beauty', 3, 'active'],
      ['f4', '/video/4.mp4', 'p104', 'Pest Killer Insecticide Spray', 250.00, 'personal_care', 4, 'active'],
      ['f5', '/video/5.mp4', 'p105', 'Wireless Over-Ear Headphones', 1999.00, 'beauty', 5, 'active']
    ];
    for (const [id, url, pid, title, price, category, priority, status] of feed) {
      await runQuery(
        'INSERT OR REPLACE INTO finds_feed (id, video_url, product_id, product_title, product_price, category, priority, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, url, pid, title, price, category, priority, status]
      );
    }

    console.log('Database successfully initialized and seeded.');
  } catch (err) {
    console.error('Initialization failed:', err.message);
  } finally {
    db.close(() => {
      console.log('Database connection closed.');
    });
  }
}

// Run database script if executed directly
if (require.main === module) {
  initDb();
}

module.exports = {
  dbPath,
  initDb
};
