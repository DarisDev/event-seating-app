const path = require('path');
const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./db/database');
const guestsRouter = require('./routes/guests');

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';
const publicDir = path.join(__dirname, '..', 'frontend', 'public');

async function main() {
  await initDatabase();

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.static(publicDir));
  app.use('/api/guests', guestsRouter);

  app.listen(PORT, HOST, () => {
    console.log(`Seating app server listening on http://${HOST}:${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
