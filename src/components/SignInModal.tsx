/**
 * Sign-in modal.
 *
 * Rendered only when experiments.ENABLE_AUTH is true (gated in App.tsx).
 * Follows the exact same modal pattern as ShortcutsModal:
 *   - modal-backdrop for the overlay + close-on-click
 *   - sign-in-modal section for the content card
 *   - Escape key to dismiss
 * The "Sign in with Google" button uses the existing palette (--primary) and
 * an inline Google SVG logo — no new UI library required.
 */

import { useEffect, useState } from "react";
import { getRuntimeConfig } from "../config/runtimeConfig";

type SignInModalProps = {
  onClose: () => void;
};

/** Inline SVG of the Google "G" logo — no external dependency. */
function GoogleLogo({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

const API_BASE: string = getRuntimeConfig("VITE_API_BASE_URL", "/api");

export function SignInModal({ onClose }: SignInModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dismiss on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleGoogleSignIn() {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${API_BASE}/auth/google/login`);
      if (!resp.ok) throw new Error("Failed to get authorization URL");
      const data = (await resp.json()) as { authorization_url: string };
      window.location.href = data.authorization_url;
    } catch {
      setError("Could not connect to the sign-in service. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} aria-hidden="false">
      <section
        className="sign-in-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Sign in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sign-in-modal-header">
          <h2>Welcome to Mark‑36</h2>
          <button className="button" onClick={onClose} aria-label="Close sign-in dialog">
            ✕
          </button>
        </div>

        <p className="sign-in-modal-subtitle">
          Sign in to sync your notes across devices.
        </p>

        <button
          id="sign-in-google-btn"
          className="sign-in-google-btn"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          aria-label="Sign in with Google"
        >
          <GoogleLogo />
          {isLoading ? "Redirecting…" : "Sign in with Google"}
        </button>

        {error && <p className="sign-in-modal-error" role="alert">{error}</p>}
      </section>
    </div>
  );
}
