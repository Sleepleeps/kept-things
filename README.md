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

## 打包成 Windows 桌面应用（不用装 Node，双击就能开）

用 [Tauri](https://tauri.app/) 把 Kept Things 包成一个原生窗口的桌面软件：启动时会自己把 `server/` 拉起来当后台服务，开一个窗口显示看板，关掉窗口服务也会一起退出。装包体积在几十 MB 量级（不需要像 Electron 那样额外带一份 Chromium，Windows 10/11 自带的 WebView2 就够用），比较适合分享给不想自己装 Node、跑命令行的人用。

**第一次打包前需要装好这些（只需要装一次）：**

1. [Rust](https://rustup.rs/)：下载 `rustup-init.exe` 装上，默认选项一路下一步就行
2. Visual Studio 的「使用 C++ 的桌面开发」组件：装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)，安装时勾选「使用 C++ 的桌面开发」这个工作负载（Rust 在 Windows 上编译需要它，这一步文件比较大，视网速可能要等一会）
3. WebView2 运行时：Windows 10 / 11 一般已经自带，如果打包/运行时报找不到 WebView2，去 [微软官网](https://developer.microsoft.com/microsoft-edge/webview2/) 下「Evergreen Bootstrapper」装一下

**打包步骤：**

```powershell
cd kept-things
npm install
npm run tauri:build
```

`npm run tauri:build` 会先跑 `scripts/prepare-tauri-sidecar.js`，把你电脑上正在用的这个 Node.js 复制一份塞进安装包里（这样装到别人电脑上也不需要对方另外装 Node），然后调用 Tauri 编译、打包。第一次编译 Rust 依赖会比较慢（几分钟），之后再打包会快很多。

打包产物在 `src-tauri/target/release/bundle/` 下面，Windows 上通常会同时生成：

| 文件 | 说明 |
|---|---|
| `msi/Kept Things_0.1.0_x64_en-US.msi` | 标准 Windows 安装包 |
| `nsis/Kept Things_0.1.0_x64-setup.exe` | 体积更小的安装程序，双击就能装 |

想不装应用、只是本地调试打包壳的效果，用 `npm run tauri:dev`（同样会先复制 sidecar，再以开发模式打开原生窗口）。

---

## 目录说明（给好奇的你）

```
kept-things/
  server/          后端代码（Node.js + Express）
  public/          前端页面（看板 + EPUB 阅读器）
  extension/       Chrome 一键收藏扩展
  src-tauri/       打包成桌面应用用的 Tauri 外壳（见上一节）
  data/            你的所有数据（不会被提交到代码仓库）
```

---

## License

MIT — see [LICENSE](LICENSE).

## Acknowledgements

Visual design inspired by Zara Zhang's "Pin & Paper" concept: https://github.com/zarazhangrui/beautiful-html-templates
