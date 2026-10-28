# Changelog

## [Unreleased]

### Changed

- Default export shortcut is now `Alt+Shift+K` on all platforms (was `Alt+Shift+Z`). On Windows and Linux, Chrome reserves Alt+Shift+Z for tab groups (focus previous tab group), so the old shortcut was never registered. 默认快捷键改为 Alt+Shift+K：Windows/Linux 上 Chrome 已把 Alt+Shift+Z 用于标签组，导致快捷键注册不上。Applies to new installs only: existing users keep the shortcut they already have (e.g. Alt+Shift+Z on macOS); the popup footer shows the one in effect. 仅对新安装生效，已安装用户保留原有快捷键，以弹窗显示为准。
- The popup footer shows「快捷键未设置 · 去设置」when no shortcut is registered; the button opens the browser shortcuts page (Chrome/Brave/Opera `chrome://extensions/shortcuts`, Edge `edge://extensions/shortcuts`; Firefox shows a text hint).

## [1.1.6] - 2026-10-10

### Fixed

- Hot-list export keeps one row per item. The title no longer includes the excerpt, and the heat metric no longer includes the share control.
- Question export loads later answers from the Zhihu question feed API. A partial file sets `truncated: true`. A limit of 0 downloads as many answers as the page declares, up to 1000.
- Answer export uses the answer's own id and author. An empty avatar link is not the author name, and a cited answer is not the item itself.
- Feed cards expand only 阅读全文, 展开, or 显示全部. Titles come from the card heading, and relative times such as 昨天 and 3 小时前 are kept.
- Display math, link-card titles, raw video elements, and lazy images follow the current article markup.

### Changed

- Front matter quotes `title`, `url`, `author`, `created`, and `edited`.
- Question downloads pack images when local image download is enabled. Copy still keeps remote image URLs.
- Question subpaths such as `/question/.../log` are not treated as question pages.

## [1.1.5] - 2026-09-28

### Fixed

- The action popup stays 360px wide. Viewport units made Chrome collapse it into a strip, so the title, status, and buttons wrapped.

## [1.1.4] - 2026-09-28

### Changed

- `npm run build` writes the unpacked extension to `dist/`. `npm run package` writes `build/zhihu-to-markdown-v<version>.zip`.
- A `v*` tag publishes that zip with the same GitHub Release workflow as arXiv to Markdown.
- The docs index follows the same order: usage, architecture, one click, then build and release.

## [1.1.3] - 2026-09-28

### Added

- Copy Markdown from the popup, or by right-clicking the floating button. Clicking the button still downloads.
- Copy keeps working after the button has been dragged, and after a long question or feed export.

### Changed

- Content script, popup, options, and background are bundled. Load `dist/` after `npm run build`. The store zip is `build/zhihu-to-markdown-v<version>.zip`.
- The floating button only watches direct children of `document.body`.

### Fixed

- Page detection rejects lookalike hosts, and answer export targets the answer in the URL.
