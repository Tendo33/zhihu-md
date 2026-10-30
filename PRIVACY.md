# Privacy Policy for Zhihu-md

**Last Updated: October 30, 2026**

Zhihu-md ("we", "us", or "our") is a browser extension for exporting Zhihu content into Markdown files. This policy explains what the extension can access, how data is processed, and what is stored locally.

## 1. What the extension accesses

We do **not** operate a backend service for this extension. The extension reads Zhihu page content, processes it only locally in your browser, and does not upload it to the developer or any third party.

The extension only processes:

- The content in the current Zhihu page
- On a question page, later answers requested from Zhihu's own question feed API in your current login session
- On an answer page, that answer's record from Zhihu's own answer API when the page does not contain it
- Your extension settings stored in browser storage
- Temporary image responses fetched directly by your browser when you enable local image packaging

These Zhihu API requests go only to Zhihu's own domains (`*.zhihu.com`, normally `www.zhihu.com`), carry your existing Zhihu login cookies (the same as the page itself), and fetch answers that are not yet shown on the page. The responses are processed only in your browser and are not sent anywhere else.

## 2. How Data Is Used

The extension uses page data only to:

- Detect the current supported Zhihu page type
- Read the article, answer, question list, feed items, or hot list items needed for the export you start
- Request additional Zhihu answer records from `*.zhihu.com` when the current page does not already contain them
- Convert that HTML into Markdown
- Download the generated Markdown file, or a ZIP package when local image download is enabled
- Copy the generated Markdown to your device clipboard when you choose Copy

All of this processing happens locally in your browser.

## 3. Permissions We Request

The current extension manifest requests only these permissions:

- `activeTab`: Access the currently active Zhihu tab so the extension can read the visible page content you choose to export
- `clipboardWrite`: Write the Markdown you asked to copy onto your device clipboard
- `contextMenus`: Add right-click menu items (export page, copy page, copy selection, open and export a Zhihu link)
- `downloads`: Save generated Markdown files or ZIP packages to your device, and show a saved file in its folder when you ask
- `storage`: Save extension settings such as floating button visibility, answer count limit, image download preference, the floating button position, and the recent exports list

The extension also declares host access for:

- `*://*.zhihu.com/*`: run the content script on Zhihu pages and request Zhihu answer data
- `https://*.zhimg.com/*`: download images from Zhihu's image CDN, only when local image packaging is enabled and you start a download export

All of these permissions are required and granted once when you install or update the extension. The extension declares no optional permissions and never asks for confirmation or additional permissions while you use it. It does not request access to any other site.

## 4. Local Storage

The extension stores the following data through Chrome storage APIs:

- `showFloatingBall` (`chrome.storage.sync`)
- `maxAnswerCount` (`chrome.storage.sync`; values above 1000 are treated as 1000; 0 means up to 1000)
- `downloadImages` (`chrome.storage.sync`)
- `floatingBallPosition` (`chrome.storage.local`)
- `recentExports` (`chrome.storage.local`): the most recent exports shown in the popup, up to 20 entries. Each entry has only the title (at most 200 characters), whether the export succeeded, and the time. No page content or link is stored. When a 21st entry is added the oldest is dropped; exporting the same title again keeps only the newest entry. It stays in your browser until you clear the extension's data or remove the extension, and it never leaves your browser. Because these titles and times record which Zhihu pages you exported, the store listing declares this as web history (stored only locally, latest 20 entries).

Settings in `chrome.storage.sync` are synced with your browser account when browser sync is turned on. That is the browser's own sync feature: it carries these three settings only, never page content, and is not sent to the developer. The other values stay on this device.

These values are used only to preserve your preferences and UI state. We do not transmit them to our own servers.

## 5. Image Download Mode

If you enable "download images to local":

- The browser fetches image resources referenced by the Zhihu page so they can be packaged into a ZIP file
- Those requests are made directly from your browser runtime
- We do not receive, proxy, or store those image files on our own infrastructure

## 6. Data Transmission

We do **not** send exported text, page content, settings, or generated Markdown files to our own servers.

The extension also does **not** include:

- analytics SDKs
- advertising SDKs
- remote logging
- third-party tracking code

## 7. Data Retention

The extension does not maintain cloud-side retention because it does not store your exported content on our servers.

Data remains:

- in your browser storage, if it is a saved setting or the recent exports list, until you clear the extension's data or remove the extension
- on your local device, if it is a downloaded Markdown or ZIP file

## 8. Policy Updates

We may update this policy when permissions, storage behavior, or export behavior changes. When that happens, we will update the "Last Updated" date at the top of this file.

## 9. Contact

If you have questions about this policy, please open an issue in the project repository.
