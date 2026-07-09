const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');
const { DOMParser } = require('@xmldom/xmldom');
const { PDFDocument } = require('pdf-lib');

// z-library (and mirrors like 1lib.sk / z-lib.sk) append "(Author) (site domains)"
// to downloaded filenames; this recognizes that trailing metadata block
const SITE_SUFFIX_RE = /\s*\((?:z-library|1lib|z-lib|libgen|library-genesis|annas-archive)[^()]*\)\s*$/i;
const CJK_RE = /[一-鿿㐀-䶿]/;

function silentParser() {
  return new DOMParser({ onError: (level, msg) => { if (level === 'fatalError') throw new Error(msg); } });
}

async function extractEpubMetadata(filePath) {
  const buf = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buf);

  const containerEntry = zip.file('META-INF/container.xml');
  if (!containerEntry) return null;
  const containerXml = await containerEntry.async('string');
  const containerDoc = silentParser().parseFromString(containerXml, 'text/xml');
  const rootfileEl = containerDoc.getElementsByTagName('rootfile')[0];
  const opfPath = rootfileEl && rootfileEl.getAttribute('full-path');
  if (!opfPath) return null;

  const opfEntry = zip.file(opfPath);
  if (!opfEntry) return null;
  const opfXml = await opfEntry.async('string');
  const opfDoc = silentParser().parseFromString(opfXml, 'text/xml');

  const title = firstTagText(opfDoc, ['dc:title', 'title']);
  const author = firstTagText(opfDoc, ['dc:creator', 'creator']);

  if (!title) return null;
  return { title, author };
}

function firstTagText(doc, tagNames) {
  for (const tag of tagNames) {
    const els = doc.getElementsByTagName(tag);
    if (els.length) {
      const txt = (els[0].textContent || '').trim();
      if (txt) return txt;
    }
  }
  return null;
}

async function extractPdfMetadata(filePath) {
  const bytes = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
  const title = safeStr(pdfDoc.getTitle());
  const author = safeStr(pdfDoc.getAuthor());
  if (!title) return null;
  return { title, author };
}

function safeStr(v) {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t || null;
}

function clean(s) {
  return String(s || '').replace(/[_+]/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatTitle(title, author) {
  return author ? `${title} - ${author}` : title;
}

function splitDash(name) {
  // CJK names rarely use hyphens as word-joiners, so an unspaced dash is safe to
  // treat as a separator; Latin/French names do ("Jean-Paul"), so require spaces there
  const hasCJK = CJK_RE.test(name);
  const re = hasCJK ? /^(.+)[-–—](.+)$/ : /^(.+)\s[-–—]\s(.+)$/;
  const m = name.match(re);
  if (!m) return null;
  const title = clean(m[1]);
  const author = clean(m[2]);
  if (!title || !author) return null;
  return { title, author };
}

// Fallback chain when a file has no usable internal metadata: try to recover
// "Title" and "Author" from common naming conventions before giving up.
function parseFilenameFallback(rawBaseName) {
  const name = rawBaseName.trim();

  const beforeSiteStrip = name;
  const deSuffixed = name.replace(SITE_SUFFIX_RE, '').trimEnd();
  if (deSuffixed !== beforeSiteStrip) {
    const am = deSuffixed.match(/^(.+?)\s*\(([^()]+)\)\s*$/);
    if (am) {
      const title = clean(am[1]);
      const author = clean(am[2]);
      if (title) return { title, author: author || null };
    }
    return { title: clean(deSuffixed) || deSuffixed, author: null };
  }

  // 《书名》作者
  let m = name.match(/^《(.+?)》\s*(.+)$/);
  if (m) {
    const title = clean(m[1]);
    const author = clean(m[2]);
    if (title) return { title, author: author || null };
  }

  // [作者]书名
  m = name.match(/^\[(.+?)\]\s*(.+)$/);
  if (m) {
    const author = clean(m[1]);
    const title = clean(m[2]);
    if (title) return { title, author: author || null };
  }

  // Title by Author
  m = name.match(/^(.+?)\s+by\s+(.+)$/i);
  if (m) {
    const title = clean(m[1]);
    const author = clean(m[2]);
    if (title && author) return { title, author };
  }

  // 书名-作者 / 书名 - 作者 / Title - Author (also covers "Author - Title" shape,
  // which is structurally identical — see note in resolveItemTitle callers)
  const dashSplit = splitDash(name);
  if (dashSplit) return dashSplit;

  return { title: clean(name) || name, author: null };
}

async function resolveItemTitle({ filePath, ext, originalName }) {
  let meta = null;
  try {
    if (ext === 'epub') meta = await extractEpubMetadata(filePath);
    else if (ext === 'pdf') meta = await extractPdfMetadata(filePath);
  } catch (e) {
    meta = null;
  }

  if (meta && meta.title) {
    return { title: formatTitle(meta.title, meta.author), titleVerified: true };
  }

  const base = path.basename(originalName, path.extname(originalName));
  const fallback = parseFilenameFallback(base);
  return { title: formatTitle(fallback.title, fallback.author), titleVerified: false };
}

module.exports = {
  resolveItemTitle,
  extractEpubMetadata,
  extractPdfMetadata,
  parseFilenameFallback,
  formatTitle
};
