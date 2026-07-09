const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { detectType, titleFromUrl, fetchRealTitle } = require('../lib/titleFetch');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(db.getState());
});

router.post('/', (req, res) => {
  const name = (req.body && req.body.name ? String(req.body.name) : '').trim() || 'Nouveau module';
  const state = db.getState();
  const mod = { id: db.uid(), name, createdAt: new Date().toISOString(), items: [] };
  state.modules.push(mod);
  db.save();
  res.status(201).json(mod);
});

router.patch('/:id', (req, res) => {
  const mod = db.findModule(req.params.id);
  if (!mod) return res.status(404).json({ error: '模块不存在' });
  const name = (req.body && req.body.name ? String(req.body.name) : '').trim();
  if (name) mod.name = name;
  db.save();
  res.json(mod);
});

router.delete('/:id', (req, res) => {
  const state = db.getState();
  const mod = db.findModule(req.params.id);
  if (!mod) return res.status(404).json({ error: '模块不存在' });
  for (const item of mod.items) {
    if (item.file && item.file.storedName) {
      const p = path.join(db.LIBRARY_DIR, item.file.storedName);
      fs.rm(p, { force: true }, () => {});
    }
  }
  state.modules = state.modules.filter((m) => m.id !== mod.id);
  db.save();
  res.json({ ok: true });
});

const URL_RE = /https?:\/\/[^\s<>"']+/i;

// 每行可能是：纯链接 / 「标题 | 链接」/ 夹着链接的一段话 / 完全没有链接的纯文本。
// 只要这一行里找不到任何链接，就当成一条手写文本条目（备忘/待办），不再要求
// 整行必须是链接
function parseLine(line) {
  const sep = line.indexOf('|');
  if (sep !== -1) {
    const knownTitle = line.slice(0, sep).trim();
    const rest = line.slice(sep + 1).trim();
    const m = rest.match(URL_RE);
    if (m) return { kind: 'link', url: m[0], knownTitle };
    return { kind: 'text', text: line };
  }
  const m = line.match(URL_RE);
  if (m) {
    const rest = (line.slice(0, m.index) + line.slice(m.index + m[0].length)).trim();
    return { kind: 'link', url: m[0], knownTitle: rest };
  }
  return { kind: 'text', text: line };
}

// 批量加条目：每行「标题 | 链接」、纯链接、夹着链接的一段话，或纯文本（备忘/待办）
router.post('/:id/items', (req, res) => {
  const mod = db.findModule(req.params.id);
  if (!mod) return res.status(404).json({ error: '模块不存在' });
  const text = (req.body && req.body.text ? String(req.body.text) : '');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return res.status(400).json({ error: '没有可添加的内容' });

  const created = [];
  const skipped = [];
  const toResolve = [];

  for (const line of lines) {
    const parsed = parseLine(line);

    if (parsed.kind === 'text') {
      const item = {
        id: db.uid(),
        type: 'text',
        url: null,
        title: parsed.text,
        titleManual: true,
        done: false,
        pending: false,
        file: null,
        progress: null,
        addedAt: new Date().toISOString(),
        doneAt: null
      };
      mod.items.push(item);
      created.push(item);
      continue;
    }

    const { url, knownTitle } = parsed;
    if (mod.items.some((i) => i.url === url)) {
      skipped.push(line);
      continue;
    }
    const item = {
      id: db.uid(),
      type: detectType(url),
      url,
      title: knownTitle || titleFromUrl(url),
      titleManual: !!knownTitle,
      done: false,
      pending: !knownTitle,
      file: null,
      progress: null,
      addedAt: new Date().toISOString(),
      doneAt: null
    };
    mod.items.push(item);
    created.push(item);
    if (!knownTitle) toResolve.push(item);
  }

  db.sortItems(mod.items);
  db.save();
  res.status(201).json({ created, skipped });

  for (const item of toResolve) {
    resolveTitle(mod.id, item.id);
  }
});

async function resolveTitle(moduleId, itemId) {
  let title = null;
  try {
    const found = db.findItem(itemId);
    if (!found) return;
    const result = await fetchRealTitle(found.item.url);
    if (result && result.title) {
      title = result.author && found.item.type === 'video' ? `${result.title} - ${result.author}` : result.title;
    }
  } catch (e) {
    title = null;
  }
  const found = db.findItem(itemId);
  if (!found) return;
  const { module: mod, item } = found;
  item.pending = false;
  if (title && !item.titleManual) item.title = title;
  db.sortItems(mod.items);
  db.save();
}

module.exports = router;
