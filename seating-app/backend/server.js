const path = require('path');
const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./db/database');
const guestsRouter = require('./routes/guests');

const PORT = 3001;
const publicDir = path.join(__dirname, '..', 'frontend', 'public');

async function main() {
  await initDatabase();

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.static(publicDir));
  app.use('/api/guests', guestsRouter);

  app.listen(PORT, () => {
    console.log(`Seating app server listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
