# Thread to Paper

A Chrome extension that converts X (formerly Twitter) threads into a compact, printable PDF view so you can read them on paper.

## Features

- Extract visible tweets from an X thread page
- Open a clean, compact preview formatted for A4 paper
- Print or save as PDF using your browser's print dialog
- No editing, no accounts, no servers — everything stays local

## Install (Developer Mode)

1. Build the extension:
   ```bash
   npm install
   npm run build
   ```
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top right).
4. Click **Load unpacked**.
5. Select the `dist/` folder inside this project.

## Usage

1. Open an X thread in your browser.
2. If the thread is long, scroll down to load all tweets you want to capture.
3. Click the **Thread to Paper** extension icon.
4. Click **Create PDF View**.
5. A new tab opens with the compact preview.
6. Click **Print / Save as PDF** and use your browser print dialog to save.

## Notes

- Only tweets already loaded in the page DOM are captured. Scroll to load more before extracting.
- Duplicate tweets are automatically removed.
- The layout is optimized for compact printing (small font, narrow margins, minimal spacing).

## Project Structure

```
thread-to-paper/
├── public/
│   └── manifest.json          # Chrome Extension Manifest V3
├── src/
│   ├── popup.html / popup.ts  # Extension popup UI
│   ├── content-script.ts      # Extracts tweets from X pages
│   ├── preview.html / preview.ts  # Printable preview page
│   └── styles.css             # Compact print layout
├── dist/                      # Build output (load this in Chrome)
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Build

```bash
npm run build
```

To watch for changes during development:

```bash
npm run dev
```

## License

MIT
