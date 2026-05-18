const fs = require('fs');
const path = require('path');

// From seating-app/backend/scripts → seating-app/frontend/public
const src = path.join(__dirname, '..', '..', 'frontend', 'public');
const dest = path.join(__dirname, '..', 'public');

if (!fs.existsSync(src)) {
  if (fs.existsSync(path.join(dest, 'index.html'))) {
    console.log('[copy-public] Using existing backend/public');
    process.exit(0);
  }
  console.error('[copy-public] Missing source:', src);
  process.exit(1);
}

fs.mkdirSync(dest, { recursive: true });
fs.cpSync(src, dest, { recursive: true });
console.log('[copy-public] Copied frontend to backend/public');
