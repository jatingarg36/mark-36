const BASE = "Mark-36";

export type TabTitleContext = {
  dev: boolean;
  protocol: string;
  hostname: string;
};

export function getMark36TabTitle(ctx: TabTitleContext): string {
  if (ctx.protocol === "chrome-extension:") {
    return `${BASE} · extension`;
  }
  if (ctx.dev) {
    return `${BASE} · dev`;
  }
  if (ctx.hostname === "localhost" || ctx.hostname === "127.0.0.1") {
    return `${BASE} · preview`;
  }
  return `${BASE} · live`;
}

export function applyMark36TabTitle(): void {
  if (typeof document === "undefined") return;
  document.title = getMark36TabTitle({
    dev: import.meta.env.DEV,
    protocol: window.location.protocol,
    hostname: window.location.hostname
  });
}
