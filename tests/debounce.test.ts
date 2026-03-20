import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { debounce } from "../src/utils/debounce";

describe("debounce", () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    vi.useFakeTimers();
    (globalThis as any).window = {
      setTimeout,
      clearTimeout
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    (globalThis as any).window = originalWindow;
  });

  it("only calls with the latest args after delay", () => {
    const cb = vi.fn();
    const debounced = debounce(cb, 100);

    debounced("a");
    debounced("b");

    vi.advanceTimersByTime(99);
    expect(cb).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith("b");
  });
});

