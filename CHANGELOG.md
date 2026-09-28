# Changelog

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
