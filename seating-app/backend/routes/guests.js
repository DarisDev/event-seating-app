const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { getDb, persist } = require('../db/database');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

let stmts = null;

function freeStmts() {
  if (!stmts) return;
  for (const stmt of Object.values(stmts)) {
    try {
      stmt.free();
    } catch (_) {
      /* already freed */
    }
  }
  stmts = null;
}

function persistDb() {
  persist();
  freeStmts();
}

function ensureStmts() {
  if (stmts) return stmts;
  const db = getDb();
  stmts = {
    selectAll: db.prepare(
      `SELECT id, fullName, tableName, seatNumber
       FROM guests
       ORDER BY tableName, seatNumber`
    ),
    search: db.prepare(
      `SELECT id, fullName, tableName, seatNumber
       FROM guests
       WHERE LOWER(fullName) LIKE LOWER(?)
       LIMIT 50`
    ),
    selectById: db.prepare(
      `SELECT id, fullName, tableName, seatNumber FROM guests WHERE id = ?`
    ),
    insert: db.prepare(
      `INSERT INTO guests (fullName, tableName, seatNumber) VALUES (?, ?, ?)`
    ),
    update: db.prepare(
      `UPDATE guests
       SET fullName = ?, tableName = ?, seatNumber = ?
       WHERE id = ?`
    ),
    delete: db.prepare(`DELETE FROM guests WHERE id = ?`),
    lastInsertId: db.prepare('SELECT last_insert_rowid() AS id'),
    exportCsv: db.prepare(
      `SELECT fullName, tableName FROM guests ORDER BY tableName`
    ),
    countByTable: db.prepare(
      `SELECT COUNT(*) AS count FROM guests WHERE tableName = ?`
    ),
    renameTable: db.prepare(
      `UPDATE guests SET tableName = ? WHERE tableName = ?`
    ),
  };
  return stmts;
}

function escapeCsvField(value) {
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function lastInsertRowId() {
  const { lastInsertId } = ensureStmts();
  lastInsertId.step();
  const { id } = lastInsertId.getAsObject();
  lastInsertId.reset();
  return id;
}

function rowsFromStmt(stmt) {
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.reset();
  return rows;
}

function getGuestById(id) {
  const { selectById } = ensureStmts();
  selectById.bind([id]);
  const rows = rowsFromStmt(selectById);
  return rows[0] || null;
}

function parseSeatNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    return undefined;
  }
  return n;
}

router.get('/', (req, res) => {
  const { selectAll } = ensureStmts();
  const guests = rowsFromStmt(selectAll);
  res.status(200).json(guests);
});

router.get('/search', (req, res) => {
  const query = (req.query.query || '').trim();
  if (!query) {
    return res.status(200).json([]);
  }

  const { search } = ensureStmts();
  search.bind([`%${query}%`]);
  const guests = rowsFromStmt(search);
  res.status(200).json(guests);
});

router.get('/export-csv', (req, res) => {
  const { exportCsv } = ensureStmts();
  const rows = rowsFromStmt(exportCsv);
  const csv = rows
    .map(
      (row) =>
        `${escapeCsvField(row.fullName)},${escapeCsvField(row.tableName)}`
    )
    .join('\n');
  const body = csv ? `${csv}\n` : '';
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="guests.csv"');
  res.status(200).send(body);
});

router.post('/', (req, res) => {
  const fullName = (req.body.fullName || '').trim();
  const tableName = (req.body.tableName || '').trim();
  const seatNumber = parseSeatNumber(req.body.seatNumber);

  if (!fullName || !tableName) {
    return res
      .status(400)
      .json({ error: 'fullName and tableName are required' });
  }
  if (req.body.seatNumber !== undefined && req.body.seatNumber !== null && req.body.seatNumber !== '' && seatNumber === undefined) {
    return res.status(400).json({ error: 'seatNumber must be a non-negative integer' });
  }

  const { insert } = ensureStmts();
  insert.bind([fullName, tableName, seatNumber]);
  insert.step();
  insert.reset();

  const id = lastInsertRowId();
  const guest = getGuestById(id);
  persistDb();

  res.status(201).json(guest);
});

router.put('/rename-table', (req, res) => {
  const from = (req.body.from || '').trim();
  const to = (req.body.to || '').trim();

  if (!from || !to) {
    return res.status(400).json({ error: 'from and to are required' });
  }

  const { countByTable, renameTable } = ensureStmts();

  countByTable.bind([from]);
  countByTable.step();
  const moved = countByTable.getAsObject().count;
  countByTable.reset();

  renameTable.bind([to, from]);
  renameTable.step();
  renameTable.reset();
  persistDb();

  res.status(200).json({ moved, from, to });
});

router.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'Invalid guest id' });
  }

  const existing = getGuestById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Guest not found' });
  }

  const fullName = (req.body.fullName ?? existing.fullName).toString().trim();
  const tableName = (req.body.tableName ?? existing.tableName).toString().trim();
  const seatProvided =
    req.body.seatNumber !== undefined && req.body.seatNumber !== null && req.body.seatNumber !== '';
  const seatNumber = seatProvided
    ? parseSeatNumber(req.body.seatNumber)
    : existing.seatNumber;

  if (!fullName || !tableName) {
    return res
      .status(400)
      .json({ error: 'fullName and tableName are required' });
  }
  if (seatProvided && seatNumber === undefined) {
    return res.status(400).json({ error: 'seatNumber must be a non-negative integer' });
  }

  const { update } = ensureStmts();
  update.bind([fullName, tableName, seatNumber, id]);
  update.step();
  update.reset();

  const guest = getGuestById(id);
  persistDb();

  res.status(200).json(guest);
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'Invalid guest id' });
  }

  const existing = getGuestById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Guest not found' });
  }

  const { delete: deleteStmt } = ensureStmts();
  deleteStmt.bind([id]);
  deleteStmt.step();
  deleteStmt.reset();
  persistDb();

  res.status(200).json({ message: 'Guest deleted successfully' });
});

router.post('/import-csv', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'CSV file is required (field: file)' });
  }

  let records;
  try {
    records = parse(req.file.buffer.toString('utf8'), {
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } catch {
    return res.status(400).json({ error: 'Invalid CSV file' });
  }

  const { insert } = ensureStmts();
  let inserted = 0;
  let skipped = 0;

  for (const row of records) {
    if (!Array.isArray(row) || row.length < 2) {
      skipped += 1;
      continue;
    }

    const fullName = (row[0] ?? '').toString().trim();
    const tableName = (row[1] ?? '').toString().trim();
    const seatRaw = row.length > 2 ? row[2] : null;
    const seatNumber = parseSeatNumber(seatRaw);

    if (!fullName || !tableName) {
      skipped += 1;
      continue;
    }
    if (seatRaw !== null && seatRaw !== undefined && String(seatRaw).trim() !== '' && seatNumber === undefined) {
      skipped += 1;
      continue;
    }

    insert.bind([fullName, tableName, seatNumber]);
    insert.step();
    insert.reset();
    inserted += 1;
  }

  persistDb();
  res.status(200).json({ inserted, skipped });
});

module.exports = router;
