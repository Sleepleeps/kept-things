# Kept Things

A personal, local-only learning dashboard: pin your web links, PDF/EPUB books, and daily to-dos onto modules styled like yellow paper cards tacked to a wall. No login, no cloud, no server but the one running on your own machine.

## Screenshots

<!-- TODO: add screenshots, e.g. -->
<!-- ![Board view](docs/screenshot-board.png) -->
<!-- ![EPUB reader](docs/screenshot-reader.png) -->

## Quick start

```bash
git clone https://github.com/Yuanyuan-cyber2026/kept-things.git
cd kept-things
npm install
npm start
```

Open the address printed in the terminal (defaults to `http://localhost`, falls back to `http://localhost:3000` if port 80 isn't available).

## Your data stays local

Everything you add — links, notes, uploaded PDFs/EPUBs, backups — is written to the `data/` folder inside the project. That folder is git-ignored by design: it's never committed, never pushed, and never leaves your machine. This is a personal single-user tool with no accounts and no sync; `data/` is yours alone.

## Features

- **Modules**: create/rename/delete card-style modules; a one-click "+ Today" button makes a dated to-do module
- **Add resources three ways**: paste links (single or batch, optionally as `Title | URL`), drag-and-drop links from the browser, or drag-and-drop local PDF/EPUB files
- **Auto title fetching** for pasted links, with manual override
- **Plain-text to-dos** mixed into the same input — anything without a URL becomes a note-style item
- **Built-in EPUB reader** with page navigation, table of contents, font-size control, and resume-where-you-left-off
- **Picture-in-picture mini window** for a floating to-do checklist (Chrome/Edge 116+)
- **Export / import** your whole board as JSON, plus automatic rolling backups on every startup
- **Chrome extension** for one-click bookmarking from any page
- **Optional Windows autostart** so the server runs quietly in the background on login

## Chinese documentation

The detailed walkthrough below (first-time setup, autostart, day-to-day usage, troubleshooting) is in Chinese, written for the original personal use case.

---

# 中文说明

一个只在你自己电脑上运行的学习资料管理看板。黄纸背景、墨水蓝、别针插图的视觉风格来自项目里的原型 `mon-tableau-d-etudes-v3.html`。

---

## 第一次使用：怎么启动

1. 克隆或下载项目后，打开命令行工具（PowerShell），进入项目文件夹：
   ```
   cd kept-things
   ```
2. 第一次使用需要先安装依赖（只需要做一次）：
   ```
   npm install
   ```
3. 启动服务：
   ```
   npm start
   ```
4. 看到下面这行字，就说明启动成功了（命令行里印出来的地址为准）：
   ```
   Kept things 已启动 → http://localhost
   ```
5. 打开浏览器（推荐 Chrome 或 Edge），访问 `http://localhost`。

以后每次使用，只需要重复第 3、4、5 步（`npm install` 只有第一次或以后升级依赖时才需要）。

**怎么关闭**：回到运行 `npm start` 的那个命令行窗口，按 `Ctrl + C`，或者直接关掉这个窗口。

---

## 开机自动启动（Windows，从此不用手动 npm start）

装好依赖（`npm install`）之后，运行一次：
```
npm run autostart:install
```
这会在 Windows 的「启动」文件夹里放一个快捷方式：以后每次你登录这台电脑，kept-things 就会在后台悄悄启动——**没有命令行窗口，看不见任何界面**，直接打开浏览器访问 `http://localhost` 就能用。装好后它会立刻帮你启动一次，不用重新登录就能马上试。

它是怎么做到"自动重启"的：后台其实是一个不断守护的小循环，如果 node 进程意外崩溃退出，几秒钟内会自动重新拉起来，不需要你管。

**日志在哪**：`data/logs/` 文件夹里，按天分文件（如 `server-2026-07-10.log`），出问题时可以直接打开看报错信息。日志只保留最近 14 天，旧的会自动清理，不用手动删。

**怎么临时停止（这次登录先不跑，下次登录还会自动启动）**：
```
npm run autostart:stop
```

**怎么彻底关掉开机自启（以后要用就得手动 npm start）**：
```
npm run autostart:uninstall
```

**怎么看现在是不是在跑、开机自启有没有装好**：
```
npm run autostart:status
```

想改回手动模式，运行一次 `npm run autostart:uninstall` 就行，之后照第一次使用那几步 `npm start` 启动即可，两者不冲突。

---

## 日常使用

### 模块（卡片）
- **新建**：点击看板最后那张虚线的「+ épingler un module」卡片
- **改名**：点击卡片标题文字，输入新名字，回车或点别处确认
- **删除**：点卡片右上角的 ✕，会弹出确认框（连同里面收藏的条目和本地文件一起删除）

### 加资源，三种方式
1. **粘贴链接**：在卡片底部输入框粘贴一个或多个链接（一行一个），回车或直接粘贴多行文本即可批量添加。也可以写成「标题 | 链接」的格式自己指定标题。
2. **拖拽**：把浏览器里的链接（比如地址栏图标、页面里的超链接文字）直接拖进卡片。
3. **拖拽本地文件**：把电脑里的 PDF 或 EPUB 文件直接拖进卡片，文件会被复制一份到 `data/library/` 文件夹，由这个小程序自己管理。
4. **Chrome 扩展**（见下面「安装 Chrome 扩展」）：浏览网页时一键收藏当前页。

粘贴网页链接后，几秒钟内标题会自动替换成网页的真实标题（去掉了网站名尾巴，比如「XXX - 知乎」这种）。如果抓取失败，会保留一个根据网址推测的名字，你可以点条目右边的 ✎ 手动改。**手动改过的标题不会再被自动覆盖。**

**备忘/待办**：在同一个输入框里，直接打一行没有链接的文字（不含 `http(s)://`），回车后会变成一条 `NOTE` 标签的文本条目，而不是链接。多行粘贴时一行一条，链接和纯文字混在一起也没关系，各自变成对应的条目。文本条目会集中排在这张卡片资源列表的下面（用一条虚线隔开），保持你添加时的先后顺序（不会按字母排序），勾选完成后会沉到这组的最底下。点工具栏「+ Today」可以直接新建一个以今天日期命名的待办模块（如「To-do · mercredi 9 juillet」），方便当天随手记。

### 条目操作
- 点击条目文字：打开链接（新标签页）、打开 PDF（浏览器直接显示）、或进入内嵌 EPUB 阅读器
- 圆点按钮（○ / ●）：标记已完成 / 未完成，完成后文字会变灰划线
- ✎：手动改标题
- ✕：删除（如果是本地上传的文件，本地文件也会一起删除）

条目会自动排序：视频 → PDF → EPUB → 网页链接，同类型再按字母排序。

### EPUB 阅读器
点击书架里的 EPUB 条目会打开一个独立的阅读页面：
- 「‹ 上一页 / 下一页 ›」翻页，也可以用键盘左右方向键
- 「☰ 目录」打开/关闭章节目录
- 「A- / A+」调整字号
- 关闭页面下次再打开，会自动回到你上次读到的位置和字号

### Mini 迷你窗口
点工具栏「📌 Mini」会弹出一个置顶的小清单窗口，方便你一边工作一边照着清单打勾。这个功能需要 **Chrome 或 Edge 116 及以上版本**才支持；如果浏览器不支持，会有提示文字。

### 备份 / 导出 / 导入
- 「↧ Export」：把当前所有数据下载成一个 JSON 文件（可以存到网盘、U 盘等地方长期保存）
- 「↥ Import」：选一个之前导出的 JSON 文件，整个恢复（恢复前会自动先备份一次当前数据，不会丢东西）
- **每次运行 `npm start` 启动服务时，都会自动把当前数据存一份到 `data/backups/` 文件夹**，只保留最近 10 份，不用你操心

---

## 数据都存在哪里

都在项目文件夹下的 `data/` 里，这个文件夹已经加入 `.gitignore`，不会被提交到代码仓库：

| 位置 | 内容 |
|---|---|
| `data/kept-things.json` | 所有模块、链接、条目、阅读进度 |
| `data/library/` | 拖进来的 PDF / EPUB 原文件 |
| `data/backups/` | 每次启动自动生成的历史备份（最近 10 份） |

**换电脑 / 重装系统时怎么迁移**：把整个 `data` 文件夹复制到新电脑的项目目录下就行，或者用「Export」导出 JSON 之后在新环境「Import」回来（后者不包含 PDF/EPUB 原文件，仅恢复链接和记录）。

---

## 安装 Chrome 扩展（一键收藏当前网页）

1. 先确保 Kept Things 已经用 `npm start` 启动着
2. 打开 Chrome，地址栏输入 `chrome://extensions`，回车
3. 打开右上角的「开发者模式」开关
4. 点「加载已解压的扩展程序」
5. 选择你克隆的项目目录下的 `extension` 文件夹
6. 浏览器工具栏会出现一个新图标，浏览网页时点一下，选择要收藏进哪个模块，点「收藏当前页」

如果点击后提示"无法连接本地服务"，说明 Kept Things 服务器没有在运行，先 `npm start` 一下。

---

## 常见问题

**1. 启动时提示端口被占用**

默认用 80 端口，网址不用带端口号。如果 80 端口被别的程序占用或者没权限用，会自动改用 3000 端口，这时地址会变成 `http://localhost:3000`（命令行会明确告诉你实际用的是哪个）。如果自动换到的端口也被占用，命令行会打印具体的解决办法，最简单的是自己指定一个端口。在 PowerShell 里运行：
```
$env:PORT=3001; npm start
```
然后浏览器打开 `http://localhost:3001`（手动指定 `PORT` 时不会再自动切换端口）。

**2. 想查是谁占用了某个端口**
```
netstat -ano | findstr :80
```
把 `:80` 换成你想查的端口号，最后一列数字是进程 ID，可以在「任务管理器 → 详细信息」里找到并结束它。

**3. 抓不到网页标题怎么办**

有些网站会屏蔽自动抓取，或者网络暂时不通。抓取失败时会保留一个根据网址猜的名字，点 ✎ 手动改成你想要的标题即可，以后也不会再被覆盖。

**4. Mini 迷你窗口点了没反应**

这个功能依赖较新的浏览器 API，目前只有 Chrome / Edge 116 及以上版本支持，Firefox / Safari 暂不支持。

**5. 关于依赖包的安全提示（npm audit）**

`npm install` 时会看到 2 条关于 `xmldom` 的高危警告，这来自 EPUB 阅读器依赖的 `epubjs` 库，它内部一直没有升级这个组件。这个漏洞只影响"解析你自己拖进来的 EPUB 文件内部的 XML"，不涉及联网风险，对个人本地使用来说影响很小。如果以后 `epubjs` 更新修复了，可以运行 `npm update` 尝试升级。

**6. 电脑重启后数据还在吗**

在。所有数据都是普通文件存在 `data/` 文件夹里，跟电脑开关机没关系，只要没有手动删除这个文件夹，数据一直都在。

---

## 目录说明（给好奇的你）

```
kept-things/
  server/          后端代码（Node.js + Express）
  public/          前端页面（看板 + EPUB 阅读器）
  extension/       Chrome 一键收藏扩展
  data/            你的所有数据（不会被提交到代码仓库）
```

---

## License

MIT — see [LICENSE](LICENSE).

## Acknowledgements

Visual design inspired by Zara Zhang's "Pin & Paper" concept: https://github.com/zarazhangrui/beautiful-html-templates
