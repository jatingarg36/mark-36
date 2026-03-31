/**
 * Runtime Configuration Accessor.
 * 
 * In Docker environments, we inject environment variables starting with VITE_ 
 * into a global window.__MARK36_CONFIG__ object at runtime. This avoids the 
 * need to rebuild the Docker image for every config change.
 */

declare global {
  interface Window {
    __MARK36_CONFIG__?: Record<string, string>;
  }
}

/**
 * Gets a configuration value by key.
 * 
 * Priority:
 * 1. window.__MARK36_CONFIG__ (Injected at runtime in Docker)
 * 2. import.meta.env (Baked at build-time / local dev)
 * 3. Default value
 */
export function getRuntimeConfig(key: string, defaultValue: string = ""): string {
  // 1. Try to get from runtime global config (Docker)
  if (typeof window !== "undefined" && window.__MARK36_CONFIG__ && window.__MARK36_CONFIG__[key]) {
    return window.__MARK36_CONFIG__[key];
  }

  // 2. Fall back to build-time environment variable (Vite default)
  const metaValue = (import.meta.env as any)[key];
  if (metaValue !== undefined && metaValue !== "") {
    return metaValue;
  }

  return defaultValue;
}
