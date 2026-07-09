const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('./db');
const { backupRotate } = require('./lib/backupRotate');
const modulesRouter = require('./routes/modules');
const uploadRouter = require('./routes/upload');
const itemsRouter = require('./routes/items');
const backupRouter = require('./routes/backup');

db.load();
backupRotate();

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/library', express.static(db.LIBRARY_DIR));
app.use('/vendor/epubjs', express.static(path.join(__dirname, '..', 'node_modules', 'epubjs', 'dist')));
app.use('/vendor/jszip', express.static(path.join(__dirname, '..', 'node_modules', 'jszip', 'dist')));

app.use('/api/modules', modulesRouter);
app.use('/api/modules', uploadRouter);
app.use('/api/items', itemsRouter);
app.use('/api', backupRouter);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[kept-things] 请求出错：', err.message);
  res.status(400).json({ error: err.message || '请求处理失败' });
});

const DEFAULT_PORT = 80;
const FALLBACK_PORT = 3000;
const explicitPort = process.env.PORT ? Number(process.env.PORT) : null;

// http://kept.local 只是把 127.0.0.1 起了个别名，端口号该写还是得写，
// 所以地址提示里始终把端口号（80 除外，因为它是 http 的默认端口）带上
function addressHint(port) {
  const suffix = port === 80 ? '' : `:${port}`;
  return `http://kept.local${suffix} （或 http://localhost${suffix}）`;
}

function startServer(port, allowFallback) {
  const server = app.listen(port, () => {
    console.log(`\nKept things 已启动 → ${addressHint(port)}\n（关闭这个窗口即可停止服务）\n`);
  });

  server.on('error', (err) => {
    if (allowFallback && (err.code === 'EACCES' || err.code === 'EPERM' || err.code === 'EADDRINUSE')) {
      console.warn(`[kept-things] 端口 ${port} 用不了（${err.code}），自动改用端口 ${FALLBACK_PORT}…`);
      startServer(FALLBACK_PORT, false);
      return;
    }
    if (err.code === 'EADDRINUSE') {
      console.error(
        `\n端口 ${port} 已经被别的程序占用了，没能启动。可以这样解决（任选一种）：\n\n` +
          `  方法一：关掉占用这个端口的程序，然后重新运行 npm start\n\n` +
          `  方法二：换一个端口启动。在 PowerShell 里运行：\n` +
          `      $env:PORT=3001; npm start\n` +
          `    然后浏览器打开 http://localhost:3001\n\n` +
          `  方法三：先查一下是谁占用了端口 ${port}，在 PowerShell 里运行：\n` +
          `      netstat -ano | findstr :${port}\n` +
          `    最后一列数字是进程 ID，可以在「任务管理器 → 详细信息」里找到它并结束\n`
      );
    } else {
      console.error('[kept-things] 启动失败：', err);
    }
    process.exit(1);
  });
}

startServer(explicitPort || DEFAULT_PORT, !explicitPort);
