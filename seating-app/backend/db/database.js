const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_FILE =
  process.env.DATABASE_PATH ||
  path.join(process.env.DATA_DIR || path.join(__dirname, '..'), 'seating.db');

let db = null;

/**
 * Load sql.js, open or create seating.db, ensure schema.
 */
async function initDatabase() {
  const SQL = await initSqlJs({
    locateFile: (file) =>
      path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
  });

  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS guests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullName TEXT NOT NULL,
      tableName TEXT NOT NULL,
      seatNumber INTEGER
    )
  `);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_guests_fullName ON guests (fullName)`
  );
}

/**
 * @returns {import('sql.js').Database}
 */
function getDb() {
  if (!db) {
    throw new Error('Database not initialized; call initDatabase() first');
  }
  return db;
}

function persist() {
  const data = getDb().export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

module.exports = {
  initDatabase,
  getDb,
  persist,
};
