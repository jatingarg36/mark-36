import { describe, expect, it } from "vitest";
import { getMark36TabTitle } from "../src/utils/tabTitle";

describe("getMark36TabTitle", () => {
  it("labels the Chrome extension", () => {
    expect(
      getMark36TabTitle({
        dev: false,
        protocol: "chrome-extension:",
        hostname: "abcdefghijklmnop"
      })
    ).toBe("Mark-36 · extension");
  });

  it("labels Vite dev server", () => {
    expect(
      getMark36TabTitle({
        dev: true,
        protocol: "http:",
        hostname: "localhost"
      })
    ).toBe("Mark-36 · dev");
  });

  it("labels production build on localhost (preview)", () => {
    expect(
      getMark36TabTitle({
        dev: false,
        protocol: "http:",
        hostname: "localhost"
      })
    ).toBe("Mark-36 · preview");
  });

  it("labels deployed production", () => {
    expect(
      getMark36TabTitle({
        dev: false,
        protocol: "https:",
        hostname: "mark-36.vercel.app"
      })
    ).toBe("Mark-36 · live");
  });
});
