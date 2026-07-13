#!/usr/bin/env node
// Tauri 的 sidecar 机制要求可执行文件放在 src-tauri/binaries/ 下，并且文件名
// 带上 Rust 的目标三元组后缀（如 node-x86_64-pc-windows-msvc.exe）。
// 默认直接复制"当前正在运行这个脚本的 Node"本身——这对绝大多数场景（在自己
// 要打包的那台机器上跑 npm run tauri:build）已经够用，不需要联网下载。
// 如果要跨平台打包（比如在 Mac 上出 Windows 包），加 --target <三元组> 从
// nodejs.org 下载对应平台的 Node 可执行文件。

const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');

const BIN_DIR = path.join(__dirname, '..', 'src-tauri', 'binaries');

const TARGET_MAP = {
  'win32-x64': { triple: 'x86_64-pc-windows-msvc', ext: '.exe', dist: 'win-x64', archive: 'zip' },
  'win32-arm64': { triple: 'aarch64-pc-windows-msvc', ext: '.exe', dist: 'win-arm64', archive: 'zip' },
  'darwin-x64': { triple: 'x86_64-apple-darwin', ext: '', dist: 'darwin-x64', archive: 'tar' },
  'darwin-arm64': { triple: 'aarch64-apple-darwin', ext: '', dist: 'darwin-arm64', archive: 'tar' },
  'linux-x64': { triple: 'x86_64-unknown-linux-gnu', ext: '', dist: 'linux-x64', archive: 'tar' }
};

function currentTarget() {
  const key = `${process.platform}-${process.arch}`;
  const t = TARGET_MAP[key];
  if (!t) throw new Error(`不认识的平台/架构组合：${key}，请手动放置 sidecar 可执行文件`);
  return t;
}

function copyLocalNode() {
  const t = currentTarget();
  fs.mkdirSync(BIN_DIR, { recursive: true });
  const dest = path.join(BIN_DIR, `node-${t.triple}${t.ext}`);
  fs.copyFileSync(process.execPath, dest);
  fs.chmodSync(dest, 0o755);
  console.log(`已复制本机 Node（${process.execPath}） → ${dest}`);
}

function download(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          resolve(download(res.headers.location));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`下载失败：${url} → HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

async function downloadNodeFor(triple) {
  const entry = Object.values(TARGET_MAP).find((t) => t.triple === triple);
  if (!entry) throw new Error(`不认识的目标三元组：${triple}`);
  const version = process.version; // 例如 v22.22.2，跟本机版本保持一致
  fs.mkdirSync(BIN_DIR, { recursive: true });
  const dest = path.join(BIN_DIR, `node-${entry.triple}${entry.ext}`);

  if (entry.archive === 'zip') {
    const url = `https://nodejs.org/dist/${version}/node-${version}-${entry.dist}.zip`;
    console.log(`下载 ${url} …`);
    const buf = await download(url);
    const tmpZip = path.join(BIN_DIR, '_node.zip');
    fs.writeFileSync(tmpZip, buf);
    // 依赖系统自带的 unzip，避免额外引入 npm 依赖
    require('child_process').execFileSync('unzip', ['-o', '-j', tmpZip, `node-${version}-${entry.dist}/node.exe`, '-d', BIN_DIR]);
    fs.renameSync(path.join(BIN_DIR, 'node.exe'), dest);
    fs.rmSync(tmpZip, { force: true });
  } else {
    const url = `https://nodejs.org/dist/${version}/node-${version}-${entry.dist}.tar.gz`;
    console.log(`下载 ${url} …`);
    const buf = await download(url);
    const tmpTar = path.join(BIN_DIR, '_node.tar.gz');
    fs.writeFileSync(tmpTar, buf);
    require('child_process').execFileSync('tar', [
      '-xzf',
      tmpTar,
      '-C',
      BIN_DIR,
      `node-${version}-${entry.dist}/bin/node`,
      '--strip-components=2'
    ]);
    fs.renameSync(path.join(BIN_DIR, 'node'), dest);
    fs.rmSync(tmpTar, { force: true });
  }
  fs.chmodSync(dest, 0o755);
  console.log(`已下载 ${triple} 的 Node → ${dest}`);
}

async function main() {
  const targetArg = process.argv.indexOf('--target');
  if (targetArg !== -1 && process.argv[targetArg + 1]) {
    await downloadNodeFor(process.argv[targetArg + 1]);
  } else {
    copyLocalNode();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
