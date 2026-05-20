const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_FILE = path.join(__dirname, 'seating.db');
const OUT_FILE = path.join(__dirname, 'current-guests.csv');

function escapeCsvField(value) {
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function main() {
  if (!fs.existsSync(DB_FILE)) {
    console.error(`Database not found: ${DB_FILE}`);
    process.exit(1);
  }

  let wasmPath;
  try {
    wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
  } catch {
    wasmPath = path.join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  }
  const wasmBinary = fs.readFileSync(wasmPath);
  const SQL = await initSqlJs({ wasmBinary });
  const db = new SQL.Database(fs.readFileSync(DB_FILE));

  const stmt = db.prepare(
    `SELECT fullName, tableName FROM guests ORDER BY tableName`
  );

  const lines = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    lines.push(
      `${escapeCsvField(row.fullName)},${escapeCsvField(row.tableName)}`
    );
  }
  stmt.free();
  db.close();

  fs.writeFileSync(OUT_FILE, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Exported ${lines.length} rows to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
