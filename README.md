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
- **Add resources**: paste links into the input box (single or batch, optionally as `Title | URL`), drag-and-drop local PDF/EPUB files, or use the Chrome extension to bookmark the current page
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

将网址收藏到浏览器，设置开机自启动，以后直接从浏览器打开网址即可。

---

## 开机自动启动（Windows，从此不用手动 npm start）

装好依赖（`npm install`）之后，运行一次：
```
npm run autostart:install
```
这会在 Windows 的「启动」文件夹里放一个快捷方式：以后每次你登录这台电脑，kept-things 就会在后台悄悄启动，直接打开浏览器访问 `http://localhost` 就能用。装好后它会立刻帮你启动一次。

## 日常使用

### 模块（卡片）
- **新建**：点击看板最后那张虚线的「+ épingler un module」卡片
- **改名**：点击卡片标题文字，输入新名字，回车或点别处确认
- **删除**：点卡片右上角的 ✕，会弹出确认框（连同里面收藏的条目和本地文件一起删除）

### 加资源
1. **粘贴链接**：在卡片底部输入框粘贴一个或多个链接（一行一个），回车或直接粘贴多行文本即可批量添加。也可以写成「标题 | 链接」的格式自己指定标题。
2. **拖拽本地文件**：把电脑里的 PDF 或 EPUB 文件直接拖进卡片，文件会被复制一份到 `data/library/` 文件夹，由这个小程序自己管理。
3. **Chrome 扩展**（见下面「安装 Chrome 扩展」）：浏览网页时一键收藏当前页。


**备忘/待办**：点工具栏「+ Today」可以直接新建一个以今天日期命名的待办模块（如「To-do · mercredi 9 juillet」），方便当天随手记。


### Mini 迷你窗口
点工具栏「📌 Mini」会弹出一个置顶的小清单窗口，方便你一边工作一边照着清单打勾。

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
