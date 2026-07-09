const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');

const router = express.Router();

router.get('/:id', (req, res) => {
  const found = db.findItem(req.params.id);
  if (!found) return res.status(404).json({ error: '条目不存在' });
  const { item } = found;
  const fileUrl = item.file ? `/library/${encodeURIComponent(item.file.storedName)}` : null;
  res.json({ ...item, fileUrl });
});

router.patch('/:id', (req, res) => {
  const found = db.findItem(req.params.id);
  if (!found) return res.status(404).json({ error: '条目不存在' });
  const { module: mod, item } = found;
  const body = req.body || {};
  if (typeof body.title === 'string' && body.title.trim()) {
    item.title = body.title.trim();
    item.titleManual = true;
    item.titleVerified = true;
  }
  if (typeof body.done === 'boolean') {
    item.done = body.done;
    item.doneAt = body.done ? new Date().toISOString() : null;
  }
  db.sortItems(mod.items);
  db.save();
  res.json(item);
});

router.delete('/:id', (req, res) => {
  const found = db.findItem(req.params.id);
  if (!found) return res.status(404).json({ error: '条目不存在' });
  const { module: mod, item } = found;
  if (item.file && item.file.storedName) {
    fs.rm(path.join(db.LIBRARY_DIR, item.file.storedName), { force: true }, () => {});
  }
  mod.items = mod.items.filter((i) => i.id !== item.id);
  db.save();
  res.json({ ok: true });
});

router.patch('/:id/progress', (req, res) => {
  const found = db.findItem(req.params.id);
  if (!found) return res.status(404).json({ error: '条目不存在' });
  const { item } = found;
  if (item.type !== 'epub') return res.status(400).json({ error: '只有 EPUB 条目有阅读进度' });
  const body = req.body || {};
  item.progress = {
    cfi: typeof body.cfi === 'string' ? body.cfi : item.progress?.cfi ?? null,
    percentage: typeof body.percentage === 'number' ? body.percentage : item.progress?.percentage ?? 0,
    fontSize: typeof body.fontSize === 'number' ? body.fontSize : item.progress?.fontSize ?? 100
  };
  db.save();
  res.json(item);
});

module.exports = router;
