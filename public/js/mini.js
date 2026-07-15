/* 独立的 Mini 窗口页面——打包成桌面应用时，Chrome 的 documentPictureInPicture
   API 在 WebView2 里不可用（那是"浏览器标签页"才有的功能，嵌入式 WebView 没有
   自己的浏览器外壳来承载它），所以在 Tauri 环境下改用一个真正的原生窗口
   （置顶、常驻）承载同样的内容，这个文件就是那个窗口加载的页面逻辑。跟主
   窗口是两个独立的 JS 环境，所以这里自己拉取数据、自己维护刷新。 */

let state = { modules: [] };
const PIP_LAST_MOD_KEY = 'kt-pip-last-module';

async function api(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  if (!res.ok) {
    let msg = '请求失败';
    try {
      const j = await res.json();
      msg = j.error || msg;
    } catch (e) {
      // ignore
    }
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

function itemTarget(item) {
  if (item.file) {
    const fileUrl = `/library/${encodeURIComponent(item.file.storedName)}`;
    if (item.type === 'epub') return { kind: 'reader', href: `/reader.html?item=${item.id}` };
    return { kind: 'external', href: fileUrl };
  }
  if (item.url) return { kind: 'external', href: item.url };
  return { kind: 'none', href: null };
}

function shortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const now = new Date();
  return d.getFullYear() !== now.getFullYear() ? `${dd}/${mm}/${d.getFullYear()}` : `${dd}/${mm}`;
}

async function refresh() {
  state = await api('GET', '/api/modules');
  render();
}

function renderModSelect() {
  const sel = document.getElementById('pipAddMod');
  const prev = sel.value || localStorage.getItem(PIP_LAST_MOD_KEY);
  sel.innerHTML = '';
  state.modules.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name;
    sel.appendChild(opt);
  });
  if (prev && state.modules.some((m) => m.id === prev)) sel.value = prev;
}

function render() {
  renderModSelect();
  const list = document.getElementById('list');
  list.innerHTML = '';
  state.modules.forEach((m) => {
    const box = document.createElement('div');
    box.className = 'm';
    box.innerHTML = '<h2></h2>';
    box.querySelector('h2').textContent = m.name;
    if (!m.items.length) {
      box.insertAdjacentHTML('beforeend', '<div class="none">— vide —</div>');
    }
    let dividerInserted = false;
    m.items.forEach((it, idx) => {
      if (!dividerInserted && it.type === 'text' && idx > 0 && m.items[idx - 1].type !== 'text') {
        box.insertAdjacentHTML('beforeend', '<div class="pdivider"></div>');
        dividerInserted = true;
      }
      const row = document.createElement('label');
      row.className = 'row' + (it.done ? ' done' : '');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!it.done;
      cb.addEventListener('change', async () => {
        try {
          await api('PATCH', `/api/items/${it.id}`, { done: cb.checked });
        } catch (e) {
          // ignore
        }
        refresh();
      });
      row.appendChild(cb);
      const t = itemTarget(it);
      if (t.kind !== 'none') {
        const a = document.createElement('a');
        a.className = 'txt';
        a.href = t.href;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = it.title;
        row.appendChild(a);
      } else {
        const sp = document.createElement('span');
        sp.className = 'txt';
        sp.textContent = it.title;
        row.appendChild(sp);
      }
      if (it.type === 'text' && it.addedAt) {
        const dsp = document.createElement('span');
        dsp.className = 'pdate';
        dsp.textContent = shortDate(it.addedAt);
        row.appendChild(dsp);
      }
      box.appendChild(row);
    });
    list.appendChild(box);
  });
}

async function onAddSubmit(e) {
  e.preventDefault();
  const sel = document.getElementById('pipAddMod');
  const input = document.getElementById('pipAddText');
  const btn = e.target.querySelector('button[type=submit]');
  const modId = sel.value;
  const text = input.value.trim();
  if (!modId || !text) return;
  btn.disabled = true;
  try {
    await api('POST', `/api/modules/${modId}/items`, { text });
    localStorage.setItem(PIP_LAST_MOD_KEY, modId);
    input.value = '';
    await refresh();
  } catch (err) {
    // ignore
  }
  btn.disabled = false;
  input.focus();
}
document.getElementById('pipAdd').addEventListener('submit', onAddSubmit);

document.getElementById('pipGoBig').addEventListener('click', async () => {
  if (!window.__TAURI__) return;
  try {
    const main = await window.__TAURI__.webviewWindow.WebviewWindow.getByLabel('main');
    if (main) await main.setFocus();
  } catch (e) {
    // ignore
  }
});

// 跟主窗口用的是同一套 capture 阶段链接接管逻辑（见 app.js 里的详细注释）：
// WebView2 会在事件到达页面脚本前就拦掉 target="_blank" 的 http(s) 点击，
// 所以统一在 capture 阶段自己转发给 opener 插件。
if (window.__TAURI__) {
  document.addEventListener(
    'click',
    (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.composedPath().find((el) => el instanceof Element && el.nodeName === 'A');
      if (!a || !a.href) return;
      try {
        // eslint-disable-next-line no-new
        new URL(a.href);
      } catch (err) {
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      window.__TAURI__.core.invoke('plugin:opener|open_url', { url: a.href }).catch(() => {});
    },
    true
  );
}

refresh();
setInterval(refresh, 3000);
