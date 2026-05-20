const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_FILE = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'seating.db')
  : path.join(__dirname, '..', 'seating.db');

let db = null;

function ensureDbDirectory() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Load sql.js, open or create seating.db, ensure schema.
 */
async function initDatabase() {
  ensureDbDirectory();

  let wasmPath;
  try {
    wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
  } catch {
    wasmPath = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  }
  const wasmBinary = fs.readFileSync(wasmPath);
  const SQL = await initSqlJs({ wasmBinary });

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
  ensureDbDirectory();
  const data = getDb().export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

module.exports = {
  initDatabase,
  getDb,
  persist,
};
