# Privacy Policy for Zhihu-md

**Last Updated: March 31, 2026**

Zhihu-md ("we", "us", or "our") is a browser extension for exporting currently visible Zhihu content into Markdown files. This policy explains what the extension can access, how data is processed, and what is stored locally.

## 1. What We Collect

We do **not** operate a backend service for this extension, and we do **not** collect or store user content on our own servers.

The extension only processes:

- The content already visible in the current Zhihu page
- Your extension settings stored in browser storage
- Temporary image responses fetched directly by your browser when you enable local image packaging

## 2. How Data Is Used

The extension uses page data only to:

- Detect the current supported Zhihu page type
- Read the visible article, answer, question list, feed items, or hot list items
- Convert visible HTML into Markdown
- Download the generated Markdown file, or a ZIP package when local image download is enabled

All of this processing happens locally in your browser.

## 3. Permissions We Request

The current extension manifest requests only these permissions:

- `activeTab`: Access the currently active Zhihu tab so the extension can read the visible page content you choose to export
- `downloads`: Save generated Markdown files or ZIP packages to your device
- `storage`: Save extension settings such as floating button visibility, answer count limit, image download preference, and floating button position

The extension also declares host access for:

- `*://*.zhihu.com/*`

This limits content-script execution to Zhihu pages.

## 4. Local Storage

The extension stores the following settings locally through Chrome storage APIs:

- `showFloatingBall`
- `maxAnswerCount`
- `downloadImages`
- `floatingBallPosition`

These settings are used only to preserve your preferences and UI state. We do not transmit them to our own servers.

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

- in your browser storage, if it is a saved setting
- on your local device, if it is a downloaded Markdown or ZIP file

## 8. Policy Updates

We may update this policy when permissions, storage behavior, or export behavior changes. When that happens, we will update the "Last Updated" date at the top of this file.

## 9. Contact

If you have questions about this policy, please open an issue in the project repository.
