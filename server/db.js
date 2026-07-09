const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'kept-things.json');
const LIBRARY_DIR = path.join(DATA_DIR, 'library');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

function ensureDirs() {
  for (const d of [DATA_DIR, LIBRARY_DIR, BACKUPS_DIR]) {
    fs.mkdirSync(d, { recursive: true });
  }
}

function uid() {
  return crypto.randomUUID();
}

const TYPE_ORDER = { video: 0, pdf: 1, epub: 2, lien: 3 };

// 资源条目（链接/PDF/EPUB）在前，按类型再按字母排；文本条目整组排在后面，
// 组内不打乱手动创建顺序，只把已完成的沉到组底 —— Array#sort 是稳定排序，
// 比较结果为 0 时会保留原有的相对顺序
function sortItems(items) {
  items.sort((a, b) => {
    const aText = a.type === 'text';
    const bText = b.type === 'text';
    if (aText !== bText) return aText ? 1 : -1;
    if (!aText) {
      const oa = TYPE_ORDER[a.type] ?? 9;
      const ob = TYPE_ORDER[b.type] ?? 9;
      if (oa !== ob) return oa - ob;
      return (a.title || '').localeCompare(b.title || '', 'fr');
    }
    if (!!a.done !== !!b.done) return a.done ? 1 : -1;
    return 0;
  });
}

// 早期原型里试过把"Notes & To-dos"做成独立的卡片类型（module.type === 'notes'，
// 备忘用 module.memo，待办用 module.todos），后来改成了现在这种"每个模块都能混装
// 资源和文本条目"的方案。这里做个防御性迁移：如果数据文件里还留着旧形状的模块，
// 把它的备忘/待办转换成普通文本条目，塞进同一张卡片里，而不是丢弃这些数据
function migrateLegacyNotesModules(modules) {
  for (const m of modules) {
    if (m.type !== 'notes' && !('memo' in m) && !('todos' in m)) continue;
    if (!Array.isArray(m.items)) m.items = [];
    if (typeof m.memo === 'string' && m.memo.trim()) {
      m.items.push({
        id: uid(),
        type: 'text',
        url: null,
        title: m.memo.trim(),
        titleManual: true,
        done: false,
        pending: false,
        file: null,
        progress: null,
        addedAt: m.createdAt || new Date().toISOString(),
        doneAt: null
      });
    }
    if (Array.isArray(m.todos)) {
      for (const t of m.todos) {
        if (!t || !String(t.title || t.text || '').trim()) continue;
        m.items.push({
          id: uid(),
          type: 'text',
          url: null,
          title: String(t.title || t.text).trim(),
          titleManual: true,
          done: !!t.done,
          pending: false,
          file: null,
          progress: null,
          addedAt: t.addedAt || m.createdAt || new Date().toISOString(),
          doneAt: t.done ? t.doneAt || null : null
        });
      }
    }
    delete m.type;
    delete m.memo;
    delete m.todos;
  }
}

function sortAll() {
  for (const m of state.modules) sortItems(m.items);
}

function defaultState() {
  const now = new Date().toISOString();
  return {
    modules: [
      { id: uid(), name: 'Développement — 从零开始', createdAt: now, items: [] },
      { id: uid(), name: 'IA & données', createdAt: now, items: [] },
      { id: uid(), name: 'Français C1 → C2', createdAt: now, items: [] }
    ]
  };
}

let state = null;
let saveTimer = null;

function load() {
  ensureDirs();
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (!raw || !Array.isArray(raw.modules)) throw new Error('数据格式不对');
      state = raw;
      migrateLegacyNotesModules(state.modules);
    } catch (e) {
      console.error('[db] 数据文件读取失败，本次改用默认数据（原文件没有被覆盖，可以手动检查）：', e.message);
      state = defaultState();
    }
  } else {
    state = defaultState();
    persistNow();
  }
  sortAll();
  return state;
}

function persistNow() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 300);
}

function getState() {
  return state;
}

function findModule(moduleId) {
  return state.modules.find((m) => m.id === moduleId);
}

function findItem(itemId) {
  for (const m of state.modules) {
    const item = m.items.find((i) => i.id === itemId);
    if (item) return { module: m, item };
  }
  return null;
}

function replaceState(newState) {
  if (!newState || !Array.isArray(newState.modules)) throw new Error('导入的数据格式不对');
  state = newState;
  migrateLegacyNotesModules(state.modules);
  sortAll();
  persistNow();
}

module.exports = {
  load,
  save,
  persistNow,
  getState,
  findModule,
  findItem,
  replaceState,
  sortItems,
  sortAll,
  uid,
  DATA_FILE,
  DATA_DIR,
  LIBRARY_DIR,
  BACKUPS_DIR
};
