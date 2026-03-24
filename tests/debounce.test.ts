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

  it("resets the timer when called again before delay expires", () => {
    const cb = vi.fn();
    const debounced = debounce(cb, 100);

    debounced("first");
    vi.advanceTimersByTime(80);
    // Re-call before 100 ms — timer should reset
    debounced("second");
    vi.advanceTimersByTime(80); // only 80 ms since second call — should NOT fire
    expect(cb).not.toHaveBeenCalled();

    vi.advanceTimersByTime(20); // now 100 ms since second call — should fire
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith("second");
  });

  it("fires each time when calls are spaced further apart than the delay", () => {
    const cb = vi.fn();
    const debounced = debounce(cb, 50);

    debounced("x");
    vi.advanceTimersByTime(50);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenLastCalledWith("x");

    debounced("y");
    vi.advanceTimersByTime(50);
    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenLastCalledWith("y");
  });

  it("two independent debounced instances do not share state", () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const d1 = debounce(cb1, 100);
    const d2 = debounce(cb2, 100);

    d1("a");
    d2("b");

    vi.advanceTimersByTime(100);

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb1).toHaveBeenCalledWith("a");
    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledWith("b");
  });

  it("works with a zero delay (fires on next tick)", () => {
    const cb = vi.fn();
    const debounced = debounce(cb, 0);

    debounced("z");
    expect(cb).not.toHaveBeenCalled();

    vi.advanceTimersByTime(0);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith("z");
  });
});
