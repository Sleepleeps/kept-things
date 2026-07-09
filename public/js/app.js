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
      const got = extractDrop(e.dataTransfer);
      if (got) {
        const line = got.title ? `${got.title} | ${got.url}` : got.url;
        await submitText(line);
        return;
      }
      if (e.dataTransfer.files && e.dataTransfer.files.length) {
        await uploadFiles(m.id, [...e.dataTransfer.files]);
        return;
      }
      toast('没识别出链接或文件 — 试试拖地址栏左侧的小图标、页面里的超链接文字，或本地的 PDF/EPUB 文件');
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

/* ================= drop parsing (robust, ported from prototype) ================= */
function extractDrop(dt) {
  const html = dt.getData('text/html');
  if (html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const a = doc.querySelector('a[href^="http"]');
    if (a) {
      const txt = (a.textContent || '').trim();
      return { url: a.href, title: txt && txt !== a.href && !/^https?:\/\//.test(txt) ? txt : null };
    }
  }
  const moz = dt.getData('text/x-moz-url');
  if (moz) {
    const [u, t] = moz.split('\n');
    if (u && /^https?:\/\//i.test(u)) return { url: u.trim(), title: t ? t.trim() : null };
  }
  const uris = dt.getData('text/uri-list');
  if (uris) {
    const line = uris
      .split('\n')
      .map((s) => s.trim())
      .find((s) => s && !s.startsWith('#'));
    if (line && /^https?:\/\//i.test(line)) return { url: line, title: null };
  }
  const u2 = dt.getData('URL') || dt.getData('text/plain');
  if (u2) {
    const mtch = u2.match(/https?:\/\/[^\s"'<>]+/);
    if (mtch) return { url: mtch[0], title: null };
  }
  return null;
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
async function openPiP() {
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
    pipWin = await documentPictureInPicture.requestWindow({ width: 330, height: 480 });
  } catch (e) {
    toast('浏览器拒绝打开迷你窗（' + e.name + '）');
    pipWin = null;
    return;
  }
  const d = pipWin.document;
  const st = d.createElement('style');
  st.textContent = `
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Archivo',system-ui,sans-serif;background:#EFE44D;color:#1E2AA8;padding:12px 12px 20px;overflow-y:auto}
    h1{font-size:15px;font-weight:800;letter-spacing:-.01em;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center}
    h1 small{font-family:cursive;font-weight:400;font-size:12px;opacity:.7}
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
    .pdivider{border-top:1px dashed rgba(30,42,168,.3);margin:6px 0}`;
  d.head.appendChild(st);
  d.body.innerHTML = '<h1>Kept things <small>épinglé ↗</small></h1><div id="list"></div>';
  pipWin.addEventListener('pagehide', () => {
    pipWin = null;
  });
  renderPiP();
  toast('迷你窗已置顶 — 可拖到屏幕任意角落');
}
function renderPiP() {
  if (!pipWin) return;
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

// 拖拽到卡片以外的地方时，不要让浏览器整页跳转/打开文件
document.body.addEventListener('dragover', (e) => e.preventDefault());
document.body.addEventListener('drop', (e) => e.preventDefault());

refresh();
