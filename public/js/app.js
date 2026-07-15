let state = { modules: [] };
let pipWin = null;
let pollTimer = null;

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

async function refresh() {
  state = await api('GET', '/api/modules');
  render();
  managePolling();
}

function hasPending() {
  return state.modules.some((m) => m.items.some((i) => i.pending));
}
function managePolling() {
  if (hasPending()) {
    if (!pollTimer) {
      pollTimer = setInterval(async () => {
        state = await api('GET', '/api/modules');
        render();
        if (!hasPending()) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      }, 1500);
    }
  } else if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

/* ================= 文本条目的日期显示（Part 3） ================= */
function shortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const now = new Date();
  return d.getFullYear() !== now.getFullYear() ? `${dd}/${mm}/${d.getFullYear()}` : `${dd}/${mm}`;
}
function fullDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mi}`;
}
function dateTooltip(it) {
  if (!it.addedAt) return '';
  let t = `added ${fullDateTime(it.addedAt)}`;
  if (it.doneAt) t += `, done ${fullDateTime(it.doneAt)}`;
  return t;
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

function findItemById(id) {
  for (const m of state.modules) {
    const it = m.items.find((i) => i.id === id);
    if (it) return it;
  }
  return null;
}

// 把某一条目的标题变成可编辑输入框；onDone 在编辑结束（保存或取消）后调用
function beginTitleEdit(li, it, onDone) {
  const targetEl = li.querySelector('.res,.noturl');
  if (!targetEl) {
    if (onDone) onDone();
    return;
  }
  const inp = document.createElement('input');
  inp.className = 'edit-in';
  inp.value = it.title;
  targetEl.replaceWith(inp);
  inp.focus();
  inp.select();
  let settled = false;
  const fin = async () => {
    if (settled) return;
    settled = true;
    const val = inp.value.trim();
    if (val && val !== it.title) {
      try {
        await api('PATCH', `/api/items/${it.id}`, { title: val });
      } catch (e) {
        toast(e.message);
      }
    }
    await refresh();
    if (onDone) onDone();
  };
  inp.addEventListener('blur', fin);
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') inp.blur();
    if (e.key === 'Escape') {
      settled = true;
      render();
      if (onDone) onDone();
    }
  });
}

// 上传后，标题来自“猜测”的条目依次自动进入编辑态，方便立刻手动确认/修正
function startAutoEditQueue(ids) {
  const queue = ids.slice();
  const step = () => {
    if (!queue.length) return;
    const id = queue.shift();
    const it = findItemById(id);
    const li = it && document.querySelector(`li.item[data-id="${id}"]`);
    if (!it || !li) {
      step();
      return;
    }
    beginTitleEdit(li, it, step);
  };
  step();
}

function render() {
  const board = document.getElementById('board');
  board.innerHTML = '';
  state.modules.forEach((m, mi) => {
    const card = document.createElement('section');
    card.className = 'card';
    card.dataset.modName = m.name;
    const doneN = m.items.filter((i) => i.done).length;
    card.innerHTML = `
      <svg class="pin" width="34" height="34" viewBox="0 0 30 30"><use href="#pinShape"/></svg>
      <span class="rule-tag">Module · ${String(mi + 1).padStart(2, '0')}</span>
      <button class="obs-sync" title="写入 Obsidian 今日日记">⇄</button>
      <button class="del-mod" title="删除模块">✕</button>
      <h2 data-role="name">${esc(m.name)}</h2>
      <div class="count">${m.items.length ? `${m.items.length} ressources · ${doneN} lues` : '—'}</div>
      <ul class="items"></ul>
      ${m.items.length ? '' : '<div class="empty">还空着 — 把链接或文件拖到这里 →</div>'}
      <div class="addline"><input type="text" placeholder="粘贴链接（支持多行），回车添加…"></div>`;

    const h2 = card.querySelector('h2');
    h2.addEventListener('click', () => {
      if (h2.querySelector('input')) return;
      const inp = document.createElement('input');
      inp.value = m.name;
      h2.textContent = '';
      h2.appendChild(inp);
      inp.focus();
      inp.select();
      const fin = async () => {
        const val = inp.value.trim();
        if (val && val !== m.name) {
          try {
            await api('PATCH', `/api/modules/${m.id}`, { name: val });
          } catch (e) {
            toast(e.message);
          }
        }
        refresh();
      };
      inp.addEventListener('blur', fin);
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') inp.blur();
        if (e.key === 'Escape') render();
      });
    });

    card.querySelector('.obs-sync').addEventListener('click', () => syncModuleToObsidian(m));

    card.querySelector('.del-mod').addEventListener('click', async () => {
      if (m.items.length && !confirm(`删除「${m.name}」和里面的 ${m.items.length} 条记录？本地文件也会一并删除。`)) return;
      try {
        await api('DELETE', `/api/modules/${m.id}`);
        toast('已删除');
      } catch (e) {
        toast(e.message);
      }
      refresh();
    });

    const ul = card.querySelector('ul');
    let dividerInserted = false;
    m.items.forEach((it, idx) => {
      if (!dividerInserted && it.type === 'text' && idx > 0 && m.items[idx - 1].type !== 'text') {
        const div = document.createElement('li');
        div.className = 'divider';
        ul.appendChild(div);
        dividerInserted = true;
      }
      const li = document.createElement('li');
      li.className = 'item';
      li.dataset.id = it.id;
      const unverifiedClass = it.titleVerified === false ? ' unverified' : '';
      const tagLabel = it.type === 'video' ? '▶ VIDÉO' : it.type === 'text' ? 'NOTE' : it.type.toUpperCase();
      const tag = `<span class="tag ${it.type === 'video' ? 'video' : ''}">${tagLabel}</span>`;
      const t = itemTarget(it);
      let body;
      if (t.kind === 'none') {
        body = `<span class="noturl${unverifiedClass} ${it.done ? 'done' : ''}">${esc(it.title)}</span>`;
      } else {
        const targetAttr = t.kind === 'external' ? ' target="_blank" rel="noopener"' : '';
        body = `<a class="res${unverifiedClass} ${it.done ? 'done' : ''}" href="${esc(t.href)}"${targetAttr}>${esc(it.title)}</a>`;
      }
      const dateBadge =
        it.type === 'text' && it.addedAt
          ? `<span class="idate" title="${esc(dateTooltip(it))}">${esc(shortDate(it.addedAt))}</span>`
          : '';
      li.innerHTML = `${tag}${body}${it.pending ? '<span class="pending">titre…</span>' : ''}${dateBadge}
        <span class="ibtns">
          <button class="ib" data-a="done" title="标记读完">${it.done ? '●' : '○'}</button>
          <button class="ib" data-a="edit" title="改标题">✎</button>
          <button class="ib" data-a="del" title="删除">✕</button>
        </span>`;
      li.querySelector('[data-a=done]').addEventListener('click', async () => {
        try {
          await api('PATCH', `/api/items/${it.id}`, { done: !it.done });
        } catch (e) {
          toast(e.message);
        }
        refresh();
      });
      li.querySelector('[data-a=del]').addEventListener('click', async () => {
        try {
          await api('DELETE', `/api/items/${it.id}`);
        } catch (e) {
          toast(e.message);
        }
        refresh();
      });
      li.querySelector('[data-a=edit]').addEventListener('click', () => beginTitleEdit(li, it));
      ul.appendChild(li);
    });

    const inp = card.querySelector('.addline input');
    async function submitText(text) {
      if (!text.trim()) return;
      try {
        const r = await api('POST', `/api/modules/${m.id}/items`, { text });
        if (r.skipped && r.skipped.length) toast(`已添加 ${r.created.length} 条，跳过 ${r.skipped.length} 条无法识别的内容`);
        else toast('已别上 📌');
      } catch (e) {
        toast(e.message);
      }
      refresh();
    }
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && inp.value.trim()) {
        submitText(inp.value);
        inp.value = '';
      }
    });
    inp.addEventListener('paste', (e) => {
      const text = (e.clipboardData || window.clipboardData).getData('text');
      if (text && text.includes('\n')) {
        e.preventDefault();
        submitText(text);
        inp.value = '';
      }
    });

    ['dragenter', 'dragover'].forEach((ev) =>
      card.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        card.classList.add('dragover');
      })
    );
    card.addEventListener('dragleave', (e) => {
      if (card.contains(e.relatedTarget)) return;
      card.classList.remove('dragover');
    });
    card.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      card.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length) {
        await uploadFiles(m.id, [...e.dataTransfer.files]);
        return;
      }
      toast('如需保存链接，请使用 Chrome 扩展，或粘贴到下方输入框');
    });

    board.appendChild(card);
  });

  const add = document.createElement('button');
  add.className = 'card new';
  add.innerHTML = '<span>+ épingler un module</span>';
  add.addEventListener('click', async () => {
    try {
      await api('POST', '/api/modules', { name: 'Nouveau module' });
    } catch (e) {
      toast(e.message);
      return;
    }
    await refresh();
    const hs = board.querySelectorAll('.card h2');
    if (hs.length) hs[hs.length - 1].click();
  });
  board.appendChild(add);

  const total = state.modules.reduce((n, m) => n + m.items.length, 0);
  document.getElementById('pgno').textContent = String(total).padStart(2, '0') + ' / kept';

  renderPiP();
}

async function uploadFiles(modId, files) {
  const allowed = files.filter((f) => /\.(pdf|epub)$/i.test(f.name));
  const rejected = files.length - allowed.length;
  if (!allowed.length) {
    toast('只支持拖入 .pdf / .epub 文件');
    return;
  }
  const fd = new FormData();
  allowed.forEach((f) => fd.append('files', f));
  try {
    const res = await fetch(`/api/modules/${modId}/upload`, { method: 'POST', body: fd });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || '上传失败');
    toast(rejected ? `已添加 ${allowed.length} 个文件，忽略 ${rejected} 个不支持的类型` : `已添加 ${allowed.length} 个文件`);
    await refresh();
    const needsEdit = (j.created || []).filter((it) => it.titleVerified === false).map((it) => it.id);
    if (needsEdit.length) startAutoEditQueue(needsEdit);
    return;
  } catch (e) {
    toast(e.message);
  }
  refresh();
}

/* ================= export / import ================= */
document.getElementById('btnExport').addEventListener('click', () => {
  window.location.href = '/api/export';
  toast('备份已下载');
});
document.getElementById('btnImport').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const fd = new FormData();
  fd.append('file', f);
  try {
    const res = await fetch('/api/import', { method: 'POST', body: fd });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || '导入失败');
    toast('已从备份恢复 ✓');
  } catch (err) {
    toast(err.message);
  }
  e.target.value = '';
  refresh();
});

/* ================= "+ Today" 按钮：新建/定位到今天的待办模块 ================= */
function todayModuleName() {
  const frDate = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return `To-do · ${frDate}`;
}
function focusModuleInput(name) {
  const card = [...document.querySelectorAll('.card')].find((c) => c.dataset.modName === name);
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const inp = card.querySelector('.addline input');
  if (inp) inp.focus();
}
document.getElementById('btnToday').addEventListener('click', async () => {
  const name = todayModuleName();
  const existing = state.modules.find((m) => m.name === name);
  if (existing) {
    focusModuleInput(name);
    return;
  }
  try {
    await api('POST', '/api/modules', { name });
  } catch (e) {
    toast(e.message);
    return;
  }
  await refresh();
  focusModuleInput(name);
});

/* ================= Picture-in-Picture mini todo (ported from prototype) ================= */
document.getElementById('btnPip').addEventListener('click', openPiP);
const PIP_LAST_MOD_KEY = 'kt-pip-last-module';

// 打包成桌面应用（Tauri）时用真正的原生置顶窗口做迷你面板——Chrome 的
// documentPictureInPicture 是"浏览器标签页"才有的功能（需要外层浏览器提供
// 承载窗口的能力），嵌入式的 WebView2 没有这个外壳，调用会直接被拒绝
// （NotAllowedError）。纯浏览器模式下 window.__TAURI__ 不存在，走下面原来
// 那套 documentPictureInPicture 逻辑。
let miniWin = null;
async function openMiniNative() {
  const { WebviewWindow } = window.__TAURI__.webviewWindow;
  const existing = await WebviewWindow.getByLabel('mini');
  if (existing) {
    await existing.close();
    miniWin = null;
    return;
  }
  miniWin = new WebviewWindow('mini', {
    // 用完整地址（跟主窗口同源），不能写成相对路径 'mini.html'——那样会被
    // 解析成 Tauri 打包资源协议的地址，跟本地 Express 服务器不是同一个源，
    // 里面的 fetch('/api/modules') 会请求不到，导致列表一直是空的。
    url: window.location.origin + '/mini.html',
    title: 'Kept Things · Mini',
    width: 340,
    height: 520,
    alwaysOnTop: true,
    resizable: true,
    decorations: true
  });
  miniWin.once('tauri://error', () => {
    toast('迷你窗打开失败');
    miniWin = null;
  });
}

async function openPiP() {
  if (window.__TAURI__) {
    openMiniNative();
    return;
  }
  if (pipWin) {
    try {
      pipWin.close();
    } catch (e) {
      // ignore
    }
    pipWin = null;
    return;
  }
  if (!('documentPictureInPicture' in window)) {
    toast('迷你窗需要 Chrome/Edge 116 及以上版本的浏览器才支持');
    return;
  }
  try {
    pipWin = await documentPictureInPicture.requestWindow({ width: 340, height: 520 });
  } catch (e) {
    toast('浏览器拒绝打开迷你窗（' + e.name + '）');
    pipWin = null;
    return;
  }
  const d = pipWin.document;
  d.title = 'Kept things · Mini';
  const st = d.createElement('style');
  st.textContent = `
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{height:100%}
    body{font-family:'Archivo',system-ui,sans-serif;background:#EFE44D;color:#1E2AA8;display:flex;flex-direction:column;overflow:hidden}
    .pip-head{flex:none;padding:12px 12px 8px;display:flex;justify-content:space-between;align-items:center;gap:8px}
    .pip-head h1{font-size:15px;font-weight:800;letter-spacing:-.01em;line-height:1.2}
    .pip-head h1 small{font-family:cursive;font-weight:400;font-size:12px;opacity:.7;display:block}
    .pip-go{flex:none;font:700 10px 'Archivo',sans-serif;letter-spacing:.04em;text-transform:uppercase;border:1.5px solid #1E2AA8;background:#FAF3D6;color:#1E2AA8;padding:5px 8px;cursor:pointer;box-shadow:2px 2px 0 rgba(19,27,112,.25)}
    .pip-go:hover{background:#1E2AA8;color:#FAF3D6}
    #list{flex:1;overflow-y:auto;padding:0 12px}
    .m{background:#FAF3D6;border:1.5px solid #1E2AA8;box-shadow:3px 3px 0 rgba(19,27,112,.25);padding:10px 10px 8px;margin-bottom:12px}
    .m h2{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
    .row{display:flex;gap:6px;align-items:baseline;padding:4px 0;border-bottom:1px solid rgba(30,42,168,.15);font-size:12px;line-height:1.3}
    .row:last-child{border-bottom:none}
    .row input{accent-color:#1E2AA8;transform:translateY(1px)}
    .row a{color:#131B70;font-weight:600;text-decoration:none;border-bottom:1px solid rgba(30,42,168,.35);word-break:break-word}
    .row a:hover{background:rgba(30,42,168,.1)}
    .row span.txt{flex:1}
    .row .pdate{flex:none;font-family:cursive;font-size:11px;opacity:.6}
    .done a,.done span.txt{opacity:.4;text-decoration:line-through}
    .none{font-family:cursive;font-size:13px;opacity:.7;padding:2px 0 4px}
    .pdivider{border-top:1px dashed rgba(30,42,168,.3);margin:6px 0}
    .pip-add{flex:none;display:flex;gap:6px;padding:8px 12px 12px;border-top:1.5px dashed rgba(30,42,168,.35)}
    .pip-add select{flex:none;max-width:76px;font:600 10px 'Archivo',sans-serif;color:#1E2AA8;background:#FAF3D6;border:1.5px solid #1E2AA8;padding:4px}
    .pip-add input{flex:1;min-width:0;font:500 12px 'Archivo',sans-serif;color:#1E2AA8;background:#FAF3D6;border:1.5px solid #1E2AA8;padding:4px 6px;outline:none}
    .pip-add button{flex:none;font:700 13px 'Archivo',sans-serif;border:1.5px solid #1E2AA8;background:#1E2AA8;color:#FAF3D6;padding:4px 10px;cursor:pointer}
    .pip-add button:disabled{opacity:.5;cursor:default}`;
  d.head.appendChild(st);
  d.body.innerHTML = `
    <div class="pip-head">
      <h1>Kept things <small>épinglé ↗</small></h1>
      <button type="button" class="pip-go" id="pipGoBig" title="回到大面板窗口">⤢ 大面板</button>
    </div>
    <div id="list"></div>
    <form class="pip-add" id="pipAdd">
      <select id="pipAddMod"></select>
      <input id="pipAddText" type="text" placeholder="快速添加待办/链接…" autocomplete="off">
      <button type="submit">+</button>
    </form>`;
  // 部分系统上 Document PiP 首帧不刷新（已知渲染问题）：强制触发一次重排
  void d.body.offsetHeight;
  d.body.style.display = 'none';
  void d.body.offsetHeight;
  d.body.style.display = 'flex';
  pipWin.requestAnimationFrame(() => pipWin.requestAnimationFrame(() => {}));

  d.getElementById('pipGoBig').addEventListener('click', () => {
    try {
      window.focus();
    } catch (e) {
      // ignore
    }
  });
  d.getElementById('pipAdd').addEventListener('submit', onPipAddSubmit);

  // 迷你窗口是独立的 document（documentPictureInPicture），主窗口那个转发
  // 链接点击的 capture 阶段监听不会跨文档生效，这里在迷你窗口自己的 document
  // 上再挂一份（同样用 capture 阶段抢在 WRY 内置逻辑前面），否则打包成桌面
  // 应用后迷你窗里的链接会点了没反应。
  if (window.__TAURI__) {
    d.addEventListener(
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
        window.__TAURI__.core.invoke('plugin:opener|open_url', { url: a.href }).catch((err) => toast('打不开：' + err));
      },
      true
    );
  }

  pipWin.addEventListener('pagehide', () => {
    pipWin = null;
  });
  renderPiP();
  toast('迷你窗已置顶 — 可拖到屏幕任意角落');
}
async function onPipAddSubmit(e) {
  e.preventDefault();
  if (!pipWin) return;
  const sel = pipWin.document.getElementById('pipAddMod');
  const input = pipWin.document.getElementById('pipAddText');
  const btn = e.target.querySelector('button[type=submit]');
  const modId = sel.value;
  const text = input.value.trim();
  if (!modId) {
    toast('先在大面板新建一个模块');
    return;
  }
  if (!text) return;
  btn.disabled = true;
  try {
    await api('POST', `/api/modules/${modId}/items`, { text });
    localStorage.setItem(PIP_LAST_MOD_KEY, modId);
    input.value = '';
    await refresh();
  } catch (err) {
    toast(err.message);
  }
  btn.disabled = false;
  input.focus();
}
function renderPipAddModSelect() {
  if (!pipWin) return;
  const sel = pipWin.document.getElementById('pipAddMod');
  if (!sel) return;
  const prev = sel.value || localStorage.getItem(PIP_LAST_MOD_KEY);
  sel.innerHTML = '';
  state.modules.forEach((m) => {
    const opt = pipWin.document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name;
    sel.appendChild(opt);
  });
  if (prev && state.modules.some((m) => m.id === prev)) sel.value = prev;
}
function renderPiP() {
  if (!pipWin) return;
  renderPipAddModSelect();
  const list = pipWin.document.getElementById('list');
  if (!list) return;
  list.innerHTML = '';
  state.modules.forEach((m) => {
    const box = pipWin.document.createElement('div');
    box.className = 'm';
    box.innerHTML = '<h2>' + esc(m.name) + '</h2>';
    if (!m.items.length) {
      box.insertAdjacentHTML('beforeend', '<div class="none">— vide —</div>');
    }
    let dividerInserted = false;
    m.items.forEach((it, idx) => {
      if (!dividerInserted && it.type === 'text' && idx > 0 && m.items[idx - 1].type !== 'text') {
        box.insertAdjacentHTML('beforeend', '<div class="pdivider"></div>');
        dividerInserted = true;
      }
      const row = pipWin.document.createElement('label');
      row.className = 'row' + (it.done ? ' done' : '');
      const cb = pipWin.document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!it.done;
      cb.addEventListener('change', async () => {
        try {
          await api('PATCH', `/api/items/${it.id}`, { done: cb.checked });
        } catch (e) {
          toast(e.message);
        }
        refresh();
      });
      row.appendChild(cb);
      const t = itemTarget(it);
      if (t.kind !== 'none') {
        const a = pipWin.document.createElement('a');
        a.className = 'txt';
        a.href = t.href;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = it.title;
        row.appendChild(a);
      } else {
        const sp = pipWin.document.createElement('span');
        sp.className = 'txt';
        sp.textContent = it.title;
        row.appendChild(sp);
      }
      if (it.type === 'text' && it.addedAt) {
        const dsp = pipWin.document.createElement('span');
        dsp.className = 'pdate';
        dsp.title = dateTooltip(it);
        dsp.textContent = shortDate(it.addedAt);
        row.appendChild(dsp);
      }
      box.appendChild(row);
    });
    list.appendChild(box);
  });
}

/* ================= Obsidian daily note 联动 ================= */
const OBS_KEYS = { vault: 'kt-obsidian-vault', folder: 'kt-obsidian-folder', dateFmt: 'kt-obsidian-date-fmt' };
function getObsidianSettings() {
  return {
    vault: localStorage.getItem(OBS_KEYS.vault) || '',
    folder: localStorage.getItem(OBS_KEYS.folder) || '',
    dateFmt: localStorage.getItem(OBS_KEYS.dateFmt) || 'YYYY-MM-DD'
  };
}
function promptObsidianSettings(prev) {
  const vault = prompt('Obsidian 仓库（vault）名字：', prev.vault);
  if (!vault || !vault.trim()) return null;
  const folder = prompt('日记所在文件夹（相对仓库根目录，没有子文件夹就留空）：', prev.folder) || '';
  const dateFmt = prompt('日记文件名的日期格式（支持 YYYY / MM / DD，比如 YYYY-MM-DD）：', prev.dateFmt || 'YYYY-MM-DD') || 'YYYY-MM-DD';
  const settings = {
    vault: vault.trim(),
    folder: folder.trim().replace(/^\/+|\/+$/g, ''),
    dateFmt: dateFmt.trim() || 'YYYY-MM-DD'
  };
  localStorage.setItem(OBS_KEYS.vault, settings.vault);
  localStorage.setItem(OBS_KEYS.folder, settings.folder);
  localStorage.setItem(OBS_KEYS.dateFmt, settings.dateFmt);
  return settings;
}
function formatObsidianDate(fmt) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return fmt.replace(/YYYY/g, d.getFullYear()).replace(/MM/g, pad(d.getMonth() + 1)).replace(/DD/g, pad(d.getDate()));
}
function mdSafe(s) {
  return String(s).replace(/[[\]]/g, '');
}
function moduleToObsidianChecklist(m) {
  if (!m.items.length) return '- （还没有条目）';
  return m.items
    .map((it) => {
      const box = it.done ? '[x]' : '[ ]';
      const label = it.url ? `[${mdSafe(it.title)}](${it.url})` : mdSafe(it.title);
      return `- ${box} ${label}`;
    })
    .join('\n');
}
function syncModuleToObsidian(m) {
  let settings = getObsidianSettings();
  if (!settings.vault) {
    settings = promptObsidianSettings(settings);
    if (!settings) return;
  }
  const fileBase = formatObsidianDate(settings.dateFmt);
  const filePath = settings.folder ? `${settings.folder}/${fileBase}` : fileBase;
  const content = `## ${mdSafe(m.name)} — Kept Things\n${moduleToObsidianChecklist(m)}\n`;
  const uri =
    `obsidian://new?vault=${encodeURIComponent(settings.vault)}` +
    `&file=${encodeURIComponent(filePath)}` +
    `&content=${encodeURIComponent(content)}` +
    `&append=true`;
  window.location.href = uri;
  toast('已尝试打开 Obsidian 写入今日日记 — 没反应的话检查一下仓库名是否拼对了');
}
document.getElementById('btnObsSettings').addEventListener('click', () => {
  const settings = promptObsidianSettings(getObsidianSettings());
  if (settings) toast('Obsidian 联动设置已保存');
});

// 打包成桌面应用（Tauri）时，<a target="_blank"> 在原生窗口里默认什么反应
// 都没有——普通浏览器里直接开新标签页那套行为不会自动发生。实测发现 Tauri /
// WRY 会在事件到达页面脚本之前就针对 target="_blank" 的 http(s) 链接把
// defaultPrevented 标成 true（应该是内置的"不让内嵌 webview 自己弹窗"逻辑），
// 导致 opener 插件自带的 bubble 阶段监听器和普通 JS 监听器都来不及处理，点了
// 没反应。这里改成在 capture 阶段抢在最前面接管所有链接点击（http(s) 和
// calibre://、obsidian:// 这类自定义协议都算），统一转发给 opener 插件的
// open_url。纯浏览器模式下 window.__TAURI__ 不存在，走普通的 <a> 默认行为
// 就行，不受影响。
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
      window.__TAURI__.core.invoke('plugin:opener|open_url', { url: a.href }).catch((err) => toast('打不开：' + err));
    },
    true
  );
}

// 拖拽到卡片以外的地方时，不要让浏览器整页跳转/打开文件
document.body.addEventListener('dragover', (e) => e.preventDefault());
document.body.addEventListener('drop', (e) => e.preventDefault());

refresh();
