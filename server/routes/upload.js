const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { resolveItemTitle } = require('../lib/metadata');

const router = express.Router();

const ALLOWED_EXT = new Set(['.pdf', '.epub']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, db.LIBRARY_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${db.uid()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  // busboy defaults to latin1 for the filename header param, which mangles
  // any non-ASCII filename (e.g. Chinese titles) into mojibake
  defParamCharset: 'utf8',
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) return cb(new Error('只支持 PDF 和 EPUB 文件'));
    cb(null, true);
  }
});

router.post('/:id/upload', (req, res) => {
  upload.array('files', 20)(req, res, async (err) => {
    const mod = db.findModule(req.params.id);
    const files = req.files || [];

    if (!mod) {
      for (const f of files) fs.rm(f.path, { force: true }, () => {});
      return res.status(404).json({ error: '模块不存在' });
    }
    if (err) {
      for (const f of files) fs.rm(f.path, { force: true }, () => {});
      return res.status(400).json({ error: err.message });
    }
    if (!files.length) return res.status(400).json({ error: '没有收到文件（只支持 .pdf / .epub）' });

    try {
      const created = [];
      for (const f of files) {
        const ext = path.extname(f.originalname).toLowerCase().slice(1);
        const filePath = path.join(db.LIBRARY_DIR, f.filename);
        const { title, titleVerified } = await resolveItemTitle({ filePath, ext, originalName: f.originalname });
        const item = {
          id: db.uid(),
          type: ext === 'pdf' ? 'pdf' : 'epub',
          url: null,
          title,
          titleVerified,
          titleManual: false,
          done: false,
          pending: false,
          file: { storedName: f.filename, originalName: f.originalname, ext },
          progress: ext === 'epub' ? { cfi: null, percentage: 0, fontSize: 100 } : null,
          addedAt: new Date().toISOString(),
          doneAt: null
        };
        mod.items.push(item);
        created.push(item);
      }
      db.sortItems(mod.items);
      db.save();
      res.status(201).json({ created });
    } catch (e) {
      for (const f of files) fs.rm(f.path, { force: true }, () => {});
      res.status(500).json({ error: '解析文件失败：' + e.message });
    }
  });
});

module.exports = router;
