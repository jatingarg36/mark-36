type RGB = [number, number, number];

function getHue(r: number, g: number, b: number): number {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 220; // default blue hue when achromatic
  const d = max - min;
  let h = 0;
  switch (max) {
    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
    case g: h = (b - r) / d + 2; break;
    case b: h = (r - g) / d + 4; break;
  }
  return h * 60;
}

function hsl(h: number, s: number, l: number): string {
  return `hsl(${h.toFixed(1)}, ${s}%, ${l}%)`;
}

function hsla(h: number, s: number, l: number, a: number): string {
  return `hsla(${h.toFixed(1)}, ${s}%, ${l}%, ${a})`;
}

function applyVars(vars: Record<string, string>): void {
  for (const [key, value] of Object.entries(vars)) {
    document.body.style.setProperty(key, value);
  }
}

export function applyChromeThemeColors(frameColor: RGB, isDark: boolean): void {
  const h = getHue(...frameColor);

  if (isDark) {
    applyVars({
      "--primary":          hsl(h, 65, 70),
      "--primary-contrast": hsl(h, 30, 8),
      "--bg":               hsl(h, 18, 7),
      "--surface":          hsl(h, 16, 10),
      "--surface-muted":    hsl(h, 14, 15),
      "--text":             hsl(h, 20, 92),
      "--text-muted":       hsl(h, 16, 62),
      "--border":           hsl(h, 18, 22),
      "--shadow":           hsla(h, 30, 5, 0.35),
      "--code-bg":          hsl(h, 20, 13),
      "--code-text":        hsl(h, 20, 85),
    });
  } else {
    applyVars({
      "--primary":          hsl(h, 72, 40),
      "--primary-contrast": "#ffffff",
      "--bg":               hsl(h, 25, 96),
      "--surface":          "#ffffff",
      "--surface-muted":    hsl(h, 20, 93),
      "--text":             hsl(h, 20, 11),
      "--text-muted":       hsl(h, 12, 40),
      "--border":           hsl(h, 18, 87),
      "--shadow":           hsla(h, 30, 20, 0.08),
      "--code-bg":          hsl(h, 28, 93),
      "--code-text":        hsl(h, 20, 18),
    });
  }
}

export function clearChromeThemeColors(): void {
  const keys = [
    "--primary", "--primary-contrast",
    "--bg", "--surface", "--surface-muted",
    "--text", "--text-muted", "--border", "--shadow",
    "--code-bg", "--code-text",
  ];
  for (const key of keys) {
    document.body.style.removeProperty(key);
  }
}

export async function loadChromeFrameColor(): Promise<RGB | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const themeApi = (typeof chrome !== "undefined" && (chrome as any).theme) as any;
    if (!themeApi?.getCurrent) return null;

    return new Promise((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      themeApi.getCurrent((theme: any) => {
        const frame = theme?.colors?.frame;
        if (!Array.isArray(frame) || frame.length < 3) {
          resolve(null);
          return;
        }
        resolve([frame[0] as number, frame[1] as number, frame[2] as number]);
      });
    });
  } catch {
    return null;
  }
}

export function subscribeChromeThemeChanges(callback: () => void): () => void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onUpdated = (typeof chrome !== "undefined" && (chrome as any).theme?.onUpdated) as any;
    if (!onUpdated?.addListener) return () => {};
    onUpdated.addListener(callback);
    return () => onUpdated.removeListener(callback);
  } catch {
    return () => {};
  }
}
