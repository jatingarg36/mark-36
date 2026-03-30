/**
 * Dual-context token storage for the auth layer.
 *
 * Uses `chrome.storage.local` when running as a browser extension,
 * falls back to `localStorage` when running as a web page.
 * All keys are prefixed with "mark36:auth:" so they never collide with the
 * notes storage keys (which use "mark36:").
 *
 * Only imported/used when experiments.ENABLE_AUTH is true.
 */

const AUTH_PREFIX = "mark36:auth:";

type StorageAreaLike = {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
};

function createLocalStorageArea(): StorageAreaLike {
  return {
    get(keys: string[]) {
      return new Promise((resolve) => {
        const result: Record<string, unknown> = {};
        for (const key of keys) {
          const raw = localStorage.getItem(AUTH_PREFIX + key);
          if (raw !== null) {
            try {
              result[key] = JSON.parse(raw);
            } catch {
              result[key] = raw;
            }
          }
        }
        resolve(result);
      });
    },
    set(items: Record<string, unknown>) {
      return new Promise((resolve, reject) => {
        try {
          for (const [key, value] of Object.entries(items)) {
            localStorage.setItem(AUTH_PREFIX + key, JSON.stringify(value));
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    },
    remove(keys: string[]) {
      return new Promise((resolve) => {
        for (const key of keys) {
          localStorage.removeItem(AUTH_PREFIX + key);
        }
        resolve();
      });
    },
  };
}

function createChromeStorageArea(): StorageAreaLike {
  const local = chrome.storage.local;
  return {
    get(keys: string[]) {
      // Prefix keys for chrome.storage.local to namespace them
      const prefixedKeys = keys.map((k) => AUTH_PREFIX + k);
      return new Promise((resolve, reject) => {
        local.get(prefixedKeys, (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          // Strip prefix from result keys
          const out: Record<string, unknown> = {};
          for (const key of keys) {
            const prefixed = AUTH_PREFIX + key;
            if (prefixed in result) out[key] = result[prefixed];
          }
          resolve(out);
        });
      });
    },
    set(items: Record<string, unknown>) {
      const prefixed: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(items)) {
        prefixed[AUTH_PREFIX + k] = v;
      }
      return new Promise((resolve, reject) => {
        local.set(prefixed, () => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve();
        });
      });
    },
    remove(keys: string[]) {
      const prefixedKeys = keys.map((k) => AUTH_PREFIX + k);
      return new Promise((resolve, reject) => {
        local.remove(prefixedKeys, () => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve();
        });
      });
    },
  };
}

function getAuthStorageArea(): StorageAreaLike {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    return createChromeStorageArea();
  }
  if (typeof localStorage !== "undefined") {
    return createLocalStorageArea();
  }
  throw new Error("No storage backend available.");
}

const KEYS = {
  ACCESS_TOKEN: "access_token",
  REFRESH_TOKEN: "refresh_token",
} as const;

export async function getAccessToken(): Promise<string | null> {
  const area = getAuthStorageArea();
  const data = await area.get([KEYS.ACCESS_TOKEN]);
  const val = data[KEYS.ACCESS_TOKEN];
  return typeof val === "string" ? val : null;
}

export async function getRefreshToken(): Promise<string | null> {
  const area = getAuthStorageArea();
  const data = await area.get([KEYS.REFRESH_TOKEN]);
  const val = data[KEYS.REFRESH_TOKEN];
  return typeof val === "string" ? val : null;
}

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  const area = getAuthStorageArea();
  await area.set({
    [KEYS.ACCESS_TOKEN]: accessToken,
    [KEYS.REFRESH_TOKEN]: refreshToken,
  });
}

export async function clearTokens(): Promise<void> {
  const area = getAuthStorageArea();
  await area.remove([KEYS.ACCESS_TOKEN, KEYS.REFRESH_TOKEN]);
}
