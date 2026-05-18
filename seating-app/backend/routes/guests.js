const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.status(200).json({ ok: true });
});

router.get('/search', (req, res) => {
  res.status(200).json({ ok: true });
});

router.post('/', (req, res) => {
  res.status(200).json({ ok: true });
});

router.put('/:id', (req, res) => {
  res.status(200).json({ ok: true });
});

router.delete('/:id', (req, res) => {
  res.status(200).json({ ok: true });
});

router.post('/import-csv', (req, res) => {
  res.status(200).json({ ok: true });
});

module.exports = router;
