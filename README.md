# mark-36

Turn every new tab into your Markdown scratchpad.

This repo contains:
- A **Chrome extension** — replaces your new tab with a Markdown editor
- A **CLI helper** (`mark-36`) — opens local `.md` files directly in the extension

---

## 1) Install the Chrome Extension

### Option A — Load from npm (recommended)
```bash
npm install -g mark-36
```

Then in Chrome:

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the folder printed by running:
```bash
   mark-36 --ext-path
```
5. Open a new tab ✓

### Option B — Download from GitHub Releases

1. Go to [Releases](https://github.com/jatingarg36/mark-36/releases) and download the latest `dist.zip`
2. Unzip it
3. Open `chrome://extensions/`
4. Enable **Developer mode**
5. Click **Load unpacked** → select the unzipped folder
6. Open a new tab ✓

---

## 2) Install and use the CLI (`mark-36`)

The CLI lets you open a local `.md` file directly in the extension from your terminal.

**Prerequisites:** Enable **Allow access to file URLs** in the extension details page (`chrome://extensions/` → mark-36 → Details).

**Install:**
```bash
curl -sSL https://raw.githubusercontent.com/jatingarg36/mark-36/main/scripts/install-mark-36.sh | sudo sh
```

**Use:**
```bash
mark-36 /absolute/path/to/file.md
```

---

## 3) Contributing / Local Development
```bash
git clone https://github.com/jatingarg36/mark-36.git
cd mark-36
npm install
npm run build
```

Then load the `dist/` folder as an unpacked extension (see Option B above).

1. Fork this repo
2. Create a feature branch
3. Make your changes
4. Open a pull request with a clear description

---

## Screenshot

![New tab workspace](https://raw.githubusercontent.com/jatingarg36/mark-36/main/docs/screenshots/image.png)

---

## License

MIT