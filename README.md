# X Archive Capture

An Edge/Chrome extension that saves X posts, threads, and long-form articles as readable Markdown in a local archive. It is adapted from [lifez/thread-to-paper](https://github.com/lifez/thread-to-paper) and remains under the MIT license.

## What it does

- Detects X long-form articles separately from ordinary posts and threads.
- Preserves article paragraphs and Q&A structure.
- Captures title, author, handle, source URL, publication date, capture date, and available image descriptions.
- Produces filenames in `YYYY-MM-DD-handle-short-title.md` format.
- Connects to a local archive folder through Chromium's directory picker.
- Checks `index.md` and the target file for duplicate source URLs.
- Writes the Markdown file to `articles/` and appends its row to `index.md`.
- Shows capture warnings instead of silently presenting incomplete content as complete.
- Offers a normal Markdown download when direct folder access is not desired.

Everything stays local. The extension does not post, like, reply, follow, transmit captured text, or use a server.

## Build

```bash
npm ci
npm run build
npx tsc --noEmit
```

The loadable extension is produced in `dist/`.

## Install in Microsoft Edge

1. Open `edge://extensions/`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this project's `dist/` folder.

## First use

1. Open an X post, thread, or article.
2. Click **X Archive Capture** and then **Capture current page**.
3. In the preview, choose **Connect archive folder**.
4. Select the folder that contains `index.md` and `articles/`.
5. Choose **Save to archive**.

The browser may ask you to renew folder permission after a restart. The extension never stores credentials or browser session data.

## Capture behavior

For long-form articles, the extension reads X's rendered article blocks directly. For threads, it scrolls through the conversation and de-duplicates loaded posts. The maximum automatic scroll count can be changed in the extension popup.

X can change its page structure without notice. If required article elements are unavailable, the generated Markdown includes a `PARTIAL CAPTURE` warning for review.

## Project structure

```text
src/content-script.ts  X article/post/thread extraction
src/markdown.ts        Filename, Markdown, and index-row generation
src/archive.ts         Folder permission, duplicate checks, and local writes
src/popup.*            Capture launcher
src/preview.*          Review and save interface
public/manifest.json   Manifest V3 configuration
```

## License

MIT. The original copyright notice is preserved in `LICENSE`.
