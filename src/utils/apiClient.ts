/**
 * Authenticated API client with automatic token refresh.
 *
 * All calls to the mark-36 backend that require authentication should go
 * through `apiFetch()`.  It:
 *   1. Attaches the stored access token as a Bearer header.
 *   2. Before each request, checks whether the JWT `exp` claim is within
 *      60 seconds of expiry — if so, proactively refreshes.
 *   3. On a 401 response, attempts a refresh and retries the original request
 *      exactly once.
 *   4. If refresh fails (expired / invalid refresh token), clears all stored
 *      tokens and fires a `authSignOut` CustomEvent on `window` so the app can
 *      revert to the signed-out state.
 *
 * Only imported/used when experiments.ENABLE_AUTH is true.
 */

import { getRuntimeConfig } from "../config/runtimeConfig";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./storage";

/** Base URL for all backend calls. Resolves via runtime config (Docker) or build-time env (Vite). */
const API_BASE: string = getRuntimeConfig("VITE_API_BASE_URL", "/api");

// ---------------------------------------------------------------------------
// JWT exp helpers
// ---------------------------------------------------------------------------

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split(".")[1];
    if (!base64) return null;
    // Base64url → Base64 → JSON
    const json = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Returns true if the token is expired or will expire within 60 seconds. */
function isTokenExpiredOrNearExpiry(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return true;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp - nowSeconds < 60;
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

let refreshPromise: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  try {
    const resp = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!resp.ok) return null;

    const data = (await resp.json()) as { access_token: string; refresh_token: string };
    await setTokens(data.access_token, data.refresh_token);
    return data.access_token;
  } catch {
    return null;
  }
}

/** Ensures concurrent calls coalesce into a single refresh request. */
async function refreshOnce(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// ---------------------------------------------------------------------------
// Sign-out broadcaster
// ---------------------------------------------------------------------------

function broadcastSignOut(): void {
  window.dispatchEvent(new CustomEvent("authSignOut"));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

type FetchInit = Parameters<typeof fetch>[1];

/**
 * Drop-in replacement for `fetch` that attaches auth tokens and handles
 * transparent token refresh.  Pass a backend path (e.g. "/users/me") —
 * the base URL is resolved automatically.
 */
export async function apiFetch(path: string, init: FetchInit = {}): Promise<Response> {
  // 1. Resolve current access token (may be null if not signed in)
  let accessToken = await getAccessToken();

  // 2. Proactively refresh if near-expiry
  if (accessToken && isTokenExpiredOrNearExpiry(accessToken)) {
    const newToken = await refreshOnce();
    if (!newToken) {
      await clearTokens();
      broadcastSignOut();
      throw new Error("Session expired. Please sign in again.");
    }
    accessToken = newToken;
  }

  const headers = new Headers((init.headers as HeadersInit | undefined) ?? {});
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });

  // 3. Reactive refresh on 401
  if (response.status === 401 && accessToken) {
    const newToken = await refreshOnce();
    if (!newToken) {
      await clearTokens();
      broadcastSignOut();
      return response; // return original 401 — caller can handle if needed
    }

    headers.set("Authorization", `Bearer ${newToken}`);
    return fetch(`${API_BASE}${path}`, { ...init, headers });
  }

  return response;
}
