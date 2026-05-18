const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./db/database');
const guestsRouter = require('./routes/guests');

// Railway must reach the process from outside the container — never bind to localhost.
const PORT = Number(process.env.PORT) || 3001;
const HOST = '0.0.0.0';

function resolvePublicDir() {
  const candidates = [
    path.join(__dirname, 'public'),
    path.join(__dirname, '..', 'frontend', 'public'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'index.html'))) {
      return dir;
    }
  }
  return candidates[0];
}

async function main() {
  console.log('Initializing database…');
  await initDatabase();
  console.log('Database ready.');

  const publicDir = resolvePublicDir();
  if (!fs.existsSync(path.join(publicDir, 'index.html'))) {
    console.warn('Warning: frontend not found at', publicDir);
  } else {
    console.log('Serving static files from', publicDir);
  }

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use(express.static(publicDir));
  app.use('/api/guests', guestsRouter);

  app.listen(PORT, HOST, () => {
    console.log(`Seating app server listening on ${HOST}:${PORT}`);
    console.log(`Health check: http://${HOST}:${PORT}/health`);
  });
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  process.exit(1);
});

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
