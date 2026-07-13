const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', 39: "'" };

function decodeEntities(str) {
  return str.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/gi, (match, ent) => {
    if (ent[0] === '#') {
      const isHex = ent[1] === 'x' || ent[1] === 'X';
      const code = isHex ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    const key = ent.toLowerCase();
    return NAMED_ENTITIES[key] !== undefined ? NAMED_ENTITIES[key] : match;
  });
}

// 去掉常见的「 - 网站名」「 | 网站名」这类尾缀
const SEPARATORS = [' - ', ' — ', ' – ', ' | ', ' :: ', ' » ', ' ~ '];
function stripSiteSuffix(title) {
  for (const sep of SEPARATORS) {
    const idx = title.lastIndexOf(sep);
    if (idx >= 0) {
      const head = title.slice(0, idx).trim();
      const tail = title.slice(idx + sep.length).trim();
      if (tail.length > 0 && tail.length <= 30 && head.length >= 4) {
        return head;
      }
    }
  }
  return title;
}

function cleanTitle(raw) {
  if (!raw) return null;
  let t = decodeEntities(String(raw)).replace(/\s+/g, ' ').trim();
  if (!t || /^untitled$/i.test(t)) return null;
  t = stripSiteSuffix(t);
  if (t.length > 80) t = t.slice(0, 79).trim() + '…';
  return t;
}

function detectType(url) {
  const u = url.toLowerCase();
  if (!/^https?:\/\//.test(u)) return 'app';
  if (/\.pdf($|[?#])/.test(u)) return 'pdf';
  if (/\.epub($|[?#])/.test(u)) return 'epub';
  if (/(youtube\.com|youtu\.be|bilibili\.com|vimeo\.com|dailymotion\.com)/.test(u)) return 'video';
  return 'lien';
}

function titleFromUrl(url) {
  try {
    const u = new URL(url);
    let seg = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '');
    seg = seg.replace(/\.(pdf|epub|html?|php)$/i, '').replace(/[-_+]/g, ' ').trim();
    if (seg.length > 3 && !/^(watch|index|view|video)$/i.test(seg)) return seg;
    return u.hostname.replace(/^www\./, '');
  } catch (e) {
    return url;
  }
}

// 抓网页 <title> / og:title / 作者名。大多数网页 </head> 在最前面几 KB 就结束，
// 但像 YouTube 这类页面会把几百 KB 的内嵌数据塞在 <title> 前面，所以上限要留够余量。
async function fetchRealTitle(url) {
  let res;
  try {
    res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KeptThingsBot/1.0; local personal use)' }
    });
  } catch (e) {
    return null;
  }
  if (!res.ok || !res.body) return null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType && !/text\/html|application\/xhtml/i.test(contentType)) return null;

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let html = '';
  const CAP = 1024 * 1024;
  let received = 0;
  try {
    while (received < CAP) {
      const { value, done } = await reader.read();
      if (done) break;
      received += value.length;
      html += decoder.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
  } catch (e) {
    // 读到哪算哪，剩下的忽略
  } finally {
    try {
      await reader.cancel();
    } catch (e) {
      // ignore
    }
  }

  const ogMatch =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["'][^>]*>/i) ||
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["'][^>]*>/i);
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  // schema.org 的作者/频道名标注，YouTube 等视频站常用这个格式
  const authorMatch = html.match(/itemprop=["']author["'][\s\S]{0,400}?itemprop=["']name["']\s+content=["']([^"']*)["']/i);

  const og = ogMatch ? cleanTitle(ogMatch[1]) : null;
  const plain = titleMatch ? cleanTitle(titleMatch[1]) : null;
  const author = authorMatch ? cleanTitle(authorMatch[1]) : null;

  const title = og && og.length >= 4 ? og : plain;
  return { title, author };
}

module.exports = { detectType, titleFromUrl, cleanTitle, fetchRealTitle };
