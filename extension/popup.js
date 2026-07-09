// 服务器默认用 80 端口启动，80 用不了时会自动改用 3000 —— 这里两个都试一下，
// 哪个先连上就用哪个
const API_BASES = ['http://localhost', 'http://localhost:3000'];
let apiBase = null;

const selectEl = document.getElementById('modSelect');
const statusEl = document.getElementById('status');
const pageTitleEl = document.getElementById('pageTitle');
const btnSave = document.getElementById('btnSave');

function setStatus(msg, kind) {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (kind ? ' ' + kind : '');
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function findApiBase() {
  for (const base of API_BASES) {
    try {
      const res = await fetch(`${base}/api/modules`);
      if (res.ok) return base;
    } catch (e) {
      // 试下一个候选地址
    }
  }
  return null;
}

async function loadModules() {
  try {
    apiBase = apiBase || (await findApiBase());
    if (!apiBase) throw new Error('无法连接本地服务');
    const res = await fetch(`${apiBase}/api/modules`);
    if (!res.ok) throw new Error('服务器返回错误');
    const state = await res.json();
    selectEl.innerHTML = '';
    if (!state.modules.length) {
      selectEl.innerHTML = '<option value="">还没有模块，请先在看板里新建一个</option>';
      btnSave.disabled = true;
      return;
    }
    state.modules.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name;
      selectEl.appendChild(opt);
    });
    btnSave.disabled = false;
  } catch (e) {
    selectEl.innerHTML = '<option value="">无法连接本地服务</option>';
    btnSave.disabled = true;
    setStatus('连不上 http://localhost 或 http://localhost:3000 —— 请确认已经在电脑上用 npm start 启动了 Kept Things', 'error');
  }
}

async function init() {
  const tab = await getActiveTab();
  pageTitleEl.textContent = tab ? tab.title : '';
  await loadModules();

  btnSave.addEventListener('click', async () => {
    const modId = selectEl.value;
    if (!modId) return;
    if (!tab || !/^https?:\/\//i.test(tab.url || '')) {
      setStatus('这个页面不是一个网页链接，无法收藏', 'error');
      return;
    }
    if (!apiBase) {
      setStatus('无法连接本地服务', 'error');
      return;
    }
    btnSave.disabled = true;
    setStatus('正在收藏…');
    try {
      const text = `${(tab.title || '').trim()} | ${tab.url}`;
      const res = await fetch(`${apiBase}/api/modules/${modId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || '收藏失败');
      if (j.skipped && j.skipped.length) {
        setStatus('这个链接已经在这个模块里了', 'error');
      } else {
        setStatus('已收藏 📌 可以关闭这个小窗口了', 'ok');
      }
    } catch (e) {
      setStatus(e.message, 'error');
    }
    btnSave.disabled = false;
  });
}

init();
