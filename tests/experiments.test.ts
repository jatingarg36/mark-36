import { describe, it, expect } from "vitest";
import { Experiments, isEnabled } from "../src/config/experiments";

describe("experiments", () => {
  // ── isEnabled — default configuration values ──────────────────────────────

  it("EXPORT_DOCX is disabled by default", () => {
    expect(isEnabled(Experiments.EXPORT_DOCX)).toBe(false);
  });

  it("EDITOR_UPGRADE is disabled by default", () => {
    expect(isEnabled(Experiments.EDITOR_UPGRADE)).toBe(false);
  });

  it("ZEN_MODE is enabled by default", () => {
    expect(isEnabled(Experiments.ZEN_MODE)).toBe(true);
  });

  it("EXTENDED_MARKDOWN is enabled by default", () => {
    expect(isEnabled(Experiments.EXTENDED_MARKDOWN)).toBe(true);
  });

  it("SCROLL_SYNC_POLISH is disabled by default", () => {
    expect(isEnabled(Experiments.SCROLL_SYNC_POLISH)).toBe(false);
  });

  it("QOL_FEATURES is enabled by default", () => {
    expect(isEnabled(Experiments.QOL_FEATURES)).toBe(true);
  });

  it("SMOOTH_ANIMATIONS is enabled by default", () => {
    expect(isEnabled(Experiments.SMOOTH_ANIMATIONS)).toBe(true);
  });

  // ── Experiments constant shape ────────────────────────────────────────────

  it("Experiments contains the expected keys", () => {
    const keys = Object.keys(Experiments);
    expect(keys).toContain("EXPORT_DOCX");
    expect(keys).toContain("EDITOR_UPGRADE");
    expect(keys).toContain("ZEN_MODE");
    expect(keys).toContain("EXTENDED_MARKDOWN");
    expect(keys).toContain("SCROLL_SYNC_POLISH");
    expect(keys).toContain("QOL_FEATURES");
    expect(keys).toContain("SMOOTH_ANIMATIONS");
  });

  it("Experiments values are non-empty strings", () => {
    for (const value of Object.values(Experiments)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it("returns false for an unrecognised experiment key (nullish coalescing fallback)", () => {
    // Cast to bypass TypeScript — simulates a future/unknown key reaching isEnabled
    expect(isEnabled("totally_unknown_flag" as any)).toBe(false);
  });
});
