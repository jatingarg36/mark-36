import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  loadChromeFrameColor,
  subscribeChromeThemeChanges,
  applyChromeThemeColors,
  clearChromeThemeColors,
} from "../src/utils/chromeTheme";

// ── Minimal document.body stub (no DOM / jsdom required) ──────────────────

function makeBodyStub() {
  const props: Record<string, string> = {};
  return {
    style: {
      setProperty(key: string, value: string) { props[key] = value; },
      removeProperty(key: string) { delete props[key]; },
      _dump() { return { ...props }; },
    },
  };
}

// ── loadChromeFrameColor ────────────────────────────────────────────────────

describe("loadChromeFrameColor", () => {
  afterEach(() => {
    delete (globalThis as any).chrome;
  });

  it("returns null when chrome is undefined", async () => {
    delete (globalThis as any).chrome;
    expect(await loadChromeFrameColor()).toBeNull();
  });

  it("returns null when chrome.theme is absent", async () => {
    (globalThis as any).chrome = {};
    expect(await loadChromeFrameColor()).toBeNull();
  });

  it("returns null when getCurrent is absent", async () => {
    (globalThis as any).chrome = { theme: {} };
    expect(await loadChromeFrameColor()).toBeNull();
  });

  it("returns null when frame color is missing from theme", async () => {
    (globalThis as any).chrome = {
      theme: { getCurrent: (cb: (t: unknown) => void) => cb({ colors: {} }) },
    };
    expect(await loadChromeFrameColor()).toBeNull();
  });

  it("returns null when frame array has fewer than 3 elements", async () => {
    (globalThis as any).chrome = {
      theme: {
        getCurrent: (cb: (t: unknown) => void) =>
          cb({ colors: { frame: [255, 0] } }),
      },
    };
    expect(await loadChromeFrameColor()).toBeNull();
  });

  it("resolves [r, g, b] tuple from a valid theme", async () => {
    (globalThis as any).chrome = {
      theme: {
        getCurrent: (cb: (t: unknown) => void) =>
          cb({ colors: { frame: [30, 60, 120] } }),
      },
    };
    expect(await loadChromeFrameColor()).toEqual([30, 60, 120]);
  });
});

// ── subscribeChromeThemeChanges ────────────────────────────────────────────

describe("subscribeChromeThemeChanges", () => {
  afterEach(() => {
    delete (globalThis as any).chrome;
  });

  it("returns a no-op unsubscriber when chrome is absent", () => {
    delete (globalThis as any).chrome;
    const unsub = subscribeChromeThemeChanges(() => {});
    expect(typeof unsub).toBe("function");
    unsub(); // must not throw
  });

  it("returns a no-op unsubscriber when onUpdated is absent", () => {
    (globalThis as any).chrome = { theme: {} };
    const unsub = subscribeChromeThemeChanges(() => {});
    expect(typeof unsub).toBe("function");
    unsub();
  });

  it("adds and removes the listener via onUpdated", () => {
    const addListener = vi.fn();
    const removeListener = vi.fn();
    (globalThis as any).chrome = {
      theme: { onUpdated: { addListener, removeListener } },
    };

    const callback = vi.fn();
    const unsub = subscribeChromeThemeChanges(callback);

    expect(addListener).toHaveBeenCalledWith(callback);
    unsub();
    expect(removeListener).toHaveBeenCalledWith(callback);
  });
});

// ── applyChromeThemeColors ─────────────────────────────────────────────────
// Injects a lightweight document stub into globalThis — no jsdom needed.

describe("applyChromeThemeColors", () => {
  let bodyStub: ReturnType<typeof makeBodyStub>;

  beforeEach(() => {
    bodyStub = makeBodyStub();
    (globalThis as any).document = { body: bodyStub };
  });

  afterEach(() => {
    delete (globalThis as any).document;
  });

  it("applies dark CSS vars when isDark is true", () => {
    applyChromeThemeColors([30, 60, 120], true);
    const props = bodyStub.style._dump();
    expect(props["--primary"]).toMatch(/^hsl\(/);
    expect(props["--bg"]).toMatch(/^hsl\(/);
    expect(props["--text"]).toMatch(/^hsl\(/);
  });

  it("applies light CSS vars when isDark is false", () => {
    applyChromeThemeColors([30, 60, 120], false);
    const props = bodyStub.style._dump();
    expect(props["--primary"]).toMatch(/^hsl\(/);
    expect(props["--surface"]).toBe("#ffffff");
    expect(props["--primary-contrast"]).toBe("#ffffff");
  });

  it("writes all 11 expected CSS custom properties", () => {
    applyChromeThemeColors([100, 100, 100], true);
    const props = bodyStub.style._dump();
    for (const key of [
      "--primary", "--primary-contrast", "--bg", "--surface",
      "--surface-muted", "--text", "--text-muted", "--border",
      "--shadow", "--code-bg", "--code-text",
    ]) {
      expect(props).toHaveProperty(key);
    }
  });

  it("uses a default blue hue (220) for achromatic grey frame colors", () => {
    applyChromeThemeColors([128, 128, 128], false);
    const props = bodyStub.style._dump();
    expect(props["--primary"]).toContain("220.0");
  });
});

// ── clearChromeThemeColors ─────────────────────────────────────────────────

describe("clearChromeThemeColors", () => {
  let bodyStub: ReturnType<typeof makeBodyStub>;

  beforeEach(() => {
    bodyStub = makeBodyStub();
    (globalThis as any).document = { body: bodyStub };
  });

  afterEach(() => {
    delete (globalThis as any).document;
  });

  it("removes all 11 CSS custom properties", () => {
    applyChromeThemeColors([30, 60, 120], true);
    clearChromeThemeColors();
    const props = bodyStub.style._dump();
    for (const key of [
      "--primary", "--primary-contrast", "--bg", "--surface",
      "--surface-muted", "--text", "--text-muted", "--border",
      "--shadow", "--code-bg", "--code-text",
    ]) {
      expect(props).not.toHaveProperty(key);
    }
  });
});
