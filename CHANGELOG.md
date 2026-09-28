# Changelog

## [Unreleased]

- Local development loads `dist/`. The Chrome Web Store zip is `build/zhihu-to-markdown-v<version>.zip`, same layout as arXiv to Markdown.

## [1.1.3] - 2026-09-28

### Added

- Copy Markdown from the popup, or by right-clicking the floating button. Clicking the button still downloads.
- Copy keeps working after the button has been dragged, and after a long question or feed export.

### Changed

- Content script, popup, options, and background are bundled. Load `dist/` after `npm run build`. The store zip is `build/zhihu-to-markdown-v<version>.zip`.
- The floating button only watches direct children of `document.body`.

### Fixed

- Page detection rejects lookalike hosts, and answer export targets the answer in the URL.
