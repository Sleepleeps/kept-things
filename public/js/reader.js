const params = new URLSearchParams(location.search);
const itemId = params.get('item');

let book = null;
let rendition = null;
let fontSize = 100;
let lastLocation = null;
let saveTimer = null;

async function init() {
  if (!itemId) {
    toast('缺少书籍参数');
    return;
  }
  let item;
  try {
    const res = await fetch(`/api/items/${itemId}`);
    if (!res.ok) throw new Error('找不到这本书');
    item = await res.json();
  } catch (e) {
    toast(e.message);
    return;
  }
  if (item.type !== 'epub' || !item.fileUrl) {
    toast('这不是一本 EPUB 电子书');
    return;
  }

  document.getElementById('bookTitle').textContent = item.title;
  document.title = item.title + ' — Kept Things';
  fontSize = (item.progress && item.progress.fontSize) || 100;

  book = ePub(item.fileUrl);
  rendition = book.renderTo('viewer', { width: '100%', height: '100%', flow: 'paginated' });
  rendition.themes.fontSize(fontSize + '%');

  const savedCfi = item.progress && item.progress.cfi;
  await rendition.display(savedCfi || undefined);

  book.loaded.navigation.then((nav) => renderToc(nav.toc));

  rendition.on('relocated', (loc) => {
    lastLocation = loc;
    updateProgressLabel(loc);
    scheduleSaveProgress();
  });

  document.getElementById('btnPrev').addEventListener('click', () => rendition.prev());
  document.getElementById('btnNext').addEventListener('click', () => rendition.next());
  document.getElementById('btnFontUp').addEventListener('click', () => changeFont(10));
  document.getElementById('btnFontDown').addEventListener('click', () => changeFont(-10));
  document.getElementById('btnToc').addEventListener('click', toggleToc);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') rendition.prev();
    if (e.key === 'ArrowRight') rendition.next();
  });
}

function changeFont(delta) {
  fontSize = Math.min(200, Math.max(60, fontSize + delta));
  rendition.themes.fontSize(fontSize + '%');
  scheduleSaveProgress();
}

function renderToc(toc) {
  const panel = document.getElementById('tocPanel');
  panel.innerHTML = '';
  const ul = document.createElement('ul');
  toc.forEach((chapter) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = '#';
    a.textContent = (chapter.label || '').trim() || chapter.href;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      rendition.display(chapter.href);
      panel.hidden = true;
    });
    li.appendChild(a);
    ul.appendChild(li);
  });
  panel.appendChild(ul);
}
function toggleToc() {
  const panel = document.getElementById('tocPanel');
  panel.hidden = !panel.hidden;
}

function updateProgressLabel(loc) {
  const pct = Math.round((loc.start.percentage || 0) * 100);
  document.getElementById('progressLabel').textContent = `已读 ${pct}% · 字号 ${fontSize}%`;
}

function scheduleSaveProgress() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const body = { fontSize };
    if (lastLocation) {
      body.cfi = lastLocation.start.cfi;
      body.percentage = lastLocation.start.percentage || 0;
    }
    try {
      await fetch(`/api/items/${itemId}/progress`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    } catch (e) {
      // 保存失败就算了，下次翻页/调字号会再存一次
    }
  }, 500);
}

init();
