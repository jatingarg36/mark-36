# Markdown Notes Workspace (Chrome Extension)

A production-ready Manifest V3 Chrome extension that gives you a full-page Markdown workspace in every new tab.

## Features

- Create, edit, delete, and search Markdown notes
- Persistent storage via `chrome.storage.local`
- Split-screen editor and live Markdown preview
- Markdown support for headings, lists, code blocks, links, images, and tables
- Debounced autosave for smooth typing and efficient writes
- Redundant local persistence with checksum validation + auto-recovery fallback
- On-demand disk backup with one-time path setup (relative to `Downloads/`)
- Dark/light theme toggle
- Import `.md` files into notes
- Export current note to `.md`
- Syntax highlighting for code blocks via `highlight.js`

## Tech Stack

- React + TypeScript + Vite
- `markdown-it` for Markdown parsing
- `highlight.js` for code highlighting
- Chrome Extension Manifest V3

## Project Structure

```text
.
├── public/
│   └── manifest.json
├── src/
│   ├── components/
│   │   ├── PreviewPane.tsx
│   │   ├── Sidebar.tsx
│   │   └── TopBar.tsx
│   ├── editor/
│   │   └── EditorPane.tsx
│   ├── preview/
│   │   └── markdownRenderer.ts
│   ├── storage/
│   │   └── notesStorage.ts
│   ├── utils/
│   │   └── debounce.ts
│   ├── App.tsx
│   ├── main.tsx
│   ├── styles.css
│   └── types.ts
├── index.html
├── package.json
└── vite.config.ts
```

## Local Development

1. Install dependencies:
  ```bash
   npm install
  ```
2. Run dev server:
  ```bash
   npm run dev
  ```
3. Build extension bundle:
  ```bash
   npm run build
  ```

Built extension assets are generated in `dist/`.

## Load Unpacked Extension in Chrome

1. Build project with `npm run build`.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked**.
5. Select the `dist/` folder.
6. Open a new tab - the Markdown workspace will load.

## Usage

- **Create note:** click `New`
- **Edit note:** type in title/content editor
- **Autosave:** changes save automatically after short debounce
- **Search:** use the sidebar search box
- **Delete:** click `Delete` on a note
- **Theme:** toggle dark/light mode
- **Import:** click `Import .md`
- **Backup:** click `Backup Now` (first run asks for backup path once)
- **Export:** click `Export .md`

## Open a local `.md` file in the extension

1. Build and load unpacked extension (`dist/`) in Chrome.
  - In `chrome://extensions`, open this extension's details and enable **Allow access to file URLs**.
2. Install command:
  ```bash
   ./scripts/install-mdx-open.sh
  ```
3. Open any markdown file directly in this extension:
  ```bash
   mdx-open /absolute/path/to/file.md
  ```

The command opens `chrome-extension://.../index.html?mdPath=...`, and the app imports that file as a new note on startup.

## Keyboard Shortcuts

- `Cmd/Ctrl + N`: create a new note
- `Cmd/Ctrl + B`: toggle notes sidebar
- `Cmd/Ctrl + 1`: switch to Editor view
- `Cmd/Ctrl + 2`: switch to Split view
- `Cmd/Ctrl + 3`: switch to Preview view
- `Cmd/Ctrl + /`: toggle Sync Scroll (only in Split view)

## Data Model

Each note is stored as:

```ts
{
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}
```

Data is persisted in `chrome.storage.local`.