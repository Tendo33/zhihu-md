<div align="center">

<img src="icons/icon128.png" width="96" alt="Zhihu to Markdown icon">

# Zhihu to Markdown

**Convert Zhihu columns and Q&A pages to Markdown and download them.**

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/heeilejdelmogpbnbbhdokgfabmhkenh?style=flat-square&label=Chrome%20Web%20Store&color=0a5fd1)](https://chromewebstore.google.com/detail/zhihu-md/heeilejdelmogpbnbbhdokgfabmhkenh)
[![License: MIT](https://img.shields.io/badge/License-MIT-black?style=flat-square)](./LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)](./manifest.src.json)

[Install](https://chromewebstore.google.com/detail/zhihu-md/heeilejdelmogpbnbbhdokgfabmhkenh) · [中文说明](./README.md) · [Usage (zh)](./docs/usage.md) · [Troubleshooting (zh)](./docs/troubleshooting.md) · [Privacy](./PRIVACY.md) · [Changelog](./CHANGELOG.md)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/hero-dark.png">
  <img src="docs/screenshots/hero-light.png" width="860" alt="Extension popup on a Zhihu column page">
</picture>

</div>

> The UI is in Chinese only. The article in the screenshots is a demo page, not real Zhihu content.

## Features

- **Columns and answers**: one Markdown file with YAML front matter.
- **Question pages in bulk**: keeps fetching answers through Zhihu's answer API; 20 by default, up to 1000 (larger numbers count as 1000). If it stops early, the file gets `truncated: true`.
- **Home feed, Following and Hot list**: exported as item-by-item list documents.
- **Formatting kept**: headings, lists, quotes; math as `$...$` / `$$...$$`; fenced code with language detection; tables; link cards become plain links.
- **Optional image bundling**: with "下载图片到本地" on, downloads of columns, answers and question pages become a ZIP with an `images/` folder.
- **Copy Markdown**: from the popup, the floating ball (right-click) or the context menu; you can also copy just the selection.
- **Floating ball**: draggable, snaps to the edge, remembers its position; can be turned off.
- **Recent exports** in the popup (title, status and time); the file you just saved can be shown in its folder with one click.
- Light and dark themes.

Not a crawler: it only handles the Zhihu page you opened, plus answers not yet shown on the page that it fetches from Zhihu's own API with your current login. It does not bypass login or paywalls, and skips comments.

| Floating ball | Exported Markdown |
| --- | --- |
| <img src="docs/screenshots/floating-ball.png" alt="Floating ball at the bottom right"> | <img src="docs/screenshots/markdown-output.png" alt="Exported Markdown file"> |

### Supported pages

| Page | Example URL | Result |
| --- | --- | --- |
| Column article | `https://zhuanlan.zhihu.com/p/...` | One Markdown file (or ZIP) |
| Single answer | `https://www.zhihu.com/question/.../answer/...` | One Markdown file (or ZIP) |
| Question | `https://www.zhihu.com/question/...` | Many answers, one section each |
| Home feed | `https://www.zhihu.com/` | Feed list |
| Following | `https://www.zhihu.com/follow` | Feed list |
| Hot list | `https://www.zhihu.com/hot` | Rank, title, link, heat |

## Install

**Chrome**: install from the [Chrome Web Store](https://chromewebstore.google.com/detail/zhihu-md/heeilejdelmogpbnbbhdokgfabmhkenh). Requires Chrome 121+.

**Edge / Firefox**: planned, not yet listed.

**From source**:

```bash
git clone https://github.com/Tendo33/zhihu-md.git
cd zhihu-md
npm install
npm run build
```

Open `chrome://extensions`, enable Developer mode, click "Load unpacked" and pick `dist/`.

## Usage

1. Open a supported Zhihu page.
2. Click the floating ball, or the toolbar icon and then 导出 Markdown (Export Markdown).
3. To paste into an editor, use 复制 Markdown (Copy Markdown).

| Entry point | What it does |
| --- | --- |
| Toolbar popup | Page type, title, author; Export / Copy Markdown; recent exports |
| Floating ball | Left-click downloads, right-click copies; preferred for question, feed and hot pages |
| Shortcut | Exports the current page. From 1.1.7, fresh installs default to `Alt+Shift+K` (`Option+Shift+K` on macOS). On upgrade, a shortcut you already had (e.g. `Alt+Shift+Z`) is kept and is not switched to K; if you never had one assigned, Chrome may assign K after the upgrade. The popup footer shows the shortcut actually in effect. To change it, or if another extension or the browser itself has reserved it, go to `chrome://extensions/shortcuts` |
| Context menu | 导出本页为 Markdown (export page), 复制本页 Markdown (copy page), 复制选中内容为 Markdown (copy selection), 打开并导出这个知乎链接 (open and export a Zhihu link) |

<img src="docs/screenshots/popup.png" width="300" alt="Toolbar popup">

Long exports started from the popup (such as a question page) need the popup to stay open until the download starts. The floating ball has no such limit.

## Settings

<img src="docs/screenshots/options.png" width="720" alt="Options page">

| Setting | Description | Default |
| --- | --- | --- |
| 悬浮导出球 (floating button) | Show the floating ball | On |
| 最大下载回答数 (max items) | Limit for question pages and feeds. Max 1000; larger numbers count as 1000. 0 means as many answers as the question page lists, up to 1000, and scroll until no new cards on feeds | 20 |
| 下载图片到本地 (download images) | Bundle images into a ZIP for column, answer and question downloads; copy, feed and hot exports keep remote images | Off |

Settings live in `chrome.storage.sync` (synced with your browser account when browser sync is on); the ball position and recent exports in `chrome.storage.local`.

## Permissions

| Permission | Why |
| --- | --- |
| `activeTab` | Read the Zhihu page you are on |
| `clipboardWrite` | Put Markdown on the clipboard when you choose Copy |
| `contextMenus` | Right-click menu items |
| `downloads` | Save Markdown or ZIP files |
| `storage` | Settings, ball position and recent exports |
| `*.zhihu.com` | Run on Zhihu pages; call Zhihu's answer API for question pages; fetch images when bundling |
| (no permission) `zhimg.com` | Zhihu's image CDN; images are fetched with plain requests when bundling and are not covered by the declared host access |

## Privacy

- No backend, no analytics, no data collection; nothing is sent to the developer or third parties.
- Settings are stored in `chrome.storage.sync` and sync with your browser account when browser sync is on. That is the browser's own sync, carries settings only and no page content.
- Only talks to Zhihu and its image CDN (`zhimg.com`, only when bundling images); all conversion happens in your browser.
- See [PRIVACY.md](./PRIVACY.md).

## FAQ

**Can it export paid, folded or collapsed content?**
Only if the page already shows it. Nothing is bypassed.

**Why are some answers missing on a question page?**
The max-items limit (20 by default). Set 0 for up to 1000; numbers above 1000 count as 1000. If the API fails, only answers already on the page are kept.

**The shortcut does nothing.**
Check `chrome://extensions/shortcuts`.

**Exports broke after a Zhihu redesign.**
Bulk exports depend on page structure. Please open an issue with the page type and URL.

## Development

```bash
npm install
npm run build     # unpacked extension in dist/
npm run lint
npm test
npm run package   # build/zhihu-to-markdown-v<version>.zip
```

Developer docs (Chinese) start at [docs/README.md](./docs/README.md).

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).

## License

[MIT](./LICENSE)
