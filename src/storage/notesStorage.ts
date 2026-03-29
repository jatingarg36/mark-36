import type { Note, Theme, WorkspaceState } from "../types";
import { triggerBrowserFileDownload } from "../utils/browserDownload";

const LEGACY_NOTES_KEY = "notes";
const NOTES_PRIMARY_KEY = "notes_primary_v2";
const NOTES_BACKUP_KEY = "notes_backup_v2";
const THEME_KEY = "theme";
const WORKSPACE_STATE_KEY = "workspace_state_v1";
const STORAGE_SCHEMA_VERSION = 2;
const DISK_BACKUP_FILENAME = "MarkdownNotesWorkspace/notes-backup.json";
const BACKUP_PATH_KEY = "notes_backup_path";
const WEB_STORAGE_PREFIX = "mark36:";

type NotesPayload = {
  schemaVersion: number;
  savedAt: string;
  notes: Note[];
  checksum: string;
};

/** Promise-based subset of chrome.storage.local used by this module. */
type StorageAreaLike = {
  get(keys: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
};

/**
 * Persists the same JSON values as chrome.storage.local using localStorage (normal web browsers).
 */
function createLocalStorageArea(): StorageAreaLike {
  return {
    get(keys) {
      return new Promise((resolve) => {
        const result: Record<string, unknown> = {};
        const keyList: string[] =
          keys === null
            ? []
            : typeof keys === "string"
              ? [keys]
              : Array.isArray(keys)
                ? keys
                : Object.keys(keys as Record<string, unknown>);
        for (const key of keyList) {
          const raw = localStorage.getItem(WEB_STORAGE_PREFIX + key);
          if (raw !== null) {
            try {
              result[key] = JSON.parse(raw);
            } catch {
              result[key] = raw;
            }
          }
        }
        if (keys && typeof keys === "object" && !Array.isArray(keys) && keys !== null) {
          const defaults = keys as Record<string, unknown>;
          for (const k of Object.keys(defaults)) {
            if (!(k in result)) {
              result[k] = defaults[k];
            }
          }
        }
        resolve(result);
      });
    },
    set(items) {
      return new Promise((resolve, reject) => {
        try {
          for (const [key, value] of Object.entries(items)) {
            localStorage.setItem(WEB_STORAGE_PREFIX + key, JSON.stringify(value));
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    }
  };
}

function getStorageArea(): StorageAreaLike {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    return chrome.storage.local as unknown as StorageAreaLike;
  }
  if (typeof localStorage !== "undefined") {
    return createLocalStorageArea();
  }
  throw new Error("No storage backend available (chrome.storage.local or localStorage).");
}

async function sha256Hex(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeNotes(input: unknown): Note[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.filter(
    (item): item is Note =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as Note).id === "string" &&
      typeof (item as Note).title === "string" &&
      typeof (item as Note).content === "string"
  );
}

function isViewMode(value: unknown): value is WorkspaceState["viewMode"] {
  return value === "editor" || value === "split" || value === "preview";
}

function clampSplitRatio(value: number): number {
  return Math.min(0.8, Math.max(0.2, value));
}

function normalizeWorkspaceState(input: unknown): WorkspaceState | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const candidate = input as Partial<WorkspaceState>;
  if (!isViewMode(candidate.viewMode)) {
    return null;
  }

  const rawFontSize = typeof candidate.fontSize === "number" ? candidate.fontSize : 14;
  return {
    activeNoteId: typeof candidate.activeNoteId === "string" ? candidate.activeNoteId : null,
    viewMode: candidate.viewMode,
    isSidebarCollapsed: Boolean(candidate.isSidebarCollapsed),
    syncScrollEnabled: Boolean(candidate.syncScrollEnabled),
    splitRatio:
      typeof candidate.splitRatio === "number" ? clampSplitRatio(candidate.splitRatio) : 0.5,
    searchTerm: typeof candidate.searchTerm === "string" ? candidate.searchTerm : "",
    fontSize: Math.min(20, Math.max(12, rawFontSize))
  };
}

async function createPayload(notes: Note[]): Promise<NotesPayload> {
  const serializedNotes = JSON.stringify(notes);
  const checksum = await sha256Hex(serializedNotes);
  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    notes,
    checksum
  };
}

async function readValidPayload(raw: unknown): Promise<NotesPayload | null> {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const payload = raw as Partial<NotesPayload>;
  if (
    payload.schemaVersion !== STORAGE_SCHEMA_VERSION ||
    typeof payload.savedAt !== "string" ||
    typeof payload.checksum !== "string"
  ) {
    return null;
  }

  const notes = normalizeNotes(payload.notes);
  const expectedChecksum = await sha256Hex(JSON.stringify(notes));
  if (expectedChecksum !== payload.checksum) {
    return null;
  }

  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    savedAt: payload.savedAt,
    notes,
    checksum: payload.checksum
  };
}

async function writeDiskBackup(payload: NotesPayload, backupPath: string): Promise<void> {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);

  try {
    if (typeof chrome !== "undefined" && chrome.downloads?.download) {
      await chrome.downloads.download({
        url,
        filename: backupPath,
        saveAs: false,
        conflictAction: "overwrite"
      });
    } else {
      const filename =
        backupPath.split("/").pop()?.trim() || DISK_BACKUP_FILENAME.split("/").pop() || "notes-backup.json";
      triggerBrowserFileDownload(blob, filename);
    }
  } catch (error) {
    // Backup failures should not block core storage writes.
    console.error("Disk backup failed", error);
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 8_000);
  }
}

export async function getAllNotes(): Promise<Note[]> {
  const storage = getStorageArea();
  const data = await storage.get([NOTES_PRIMARY_KEY, NOTES_BACKUP_KEY, LEGACY_NOTES_KEY]);

  const primaryPayload = await readValidPayload(data[NOTES_PRIMARY_KEY]);
  if (primaryPayload) {
    return primaryPayload.notes;
  }

  const backupPayload = await readValidPayload(data[NOTES_BACKUP_KEY]);
  if (backupPayload) {
    // Auto-repair corrupted/missing primary using valid backup.
    await storage.set({
      [NOTES_PRIMARY_KEY]: backupPayload,
      [LEGACY_NOTES_KEY]: backupPayload.notes
    });
    return backupPayload.notes;
  }

  const legacyNotes = normalizeNotes(data[LEGACY_NOTES_KEY]);
  if (legacyNotes.length > 0) {
    // Migrate from legacy format and establish redundancy + checksum.
    await saveAllNotes(legacyNotes);
    return legacyNotes;
  }

  return [];
}

export async function saveAllNotes(notes: Note[]): Promise<void> {
  const storage = getStorageArea();
  const normalizedNotes = normalizeNotes(notes);
  const nextPayload = await createPayload(normalizedNotes);

  const existing = await storage.get(NOTES_PRIMARY_KEY);
  const existingPrimary = await readValidPayload(existing[NOTES_PRIMARY_KEY]);

  await storage.set({
    [NOTES_PRIMARY_KEY]: nextPayload,
    // Keep previous valid snapshot as backup; fallback to latest payload.
    [NOTES_BACKUP_KEY]: existingPrimary ?? nextPayload,
    // Keep legacy mirror for compatibility with old versions.
    [LEGACY_NOTES_KEY]: normalizedNotes
  });
}

export async function getBackupPath(): Promise<string> {
  const storage = getStorageArea();
  const data = await storage.get(BACKUP_PATH_KEY);
  const path = data[BACKUP_PATH_KEY];
  return typeof path === "string" && path.trim().length > 0 ? path : "";
}

export async function saveBackupPath(path: string): Promise<void> {
  const storage = getStorageArea();
  await storage.set({ [BACKUP_PATH_KEY]: path });
}

export async function backupNotesToDisk(notes: Note[], backupPath: string): Promise<void> {
  const normalizedNotes = normalizeNotes(notes);
  const payload = await createPayload(normalizedNotes);
  const path = backupPath.trim().length > 0 ? backupPath : DISK_BACKUP_FILENAME;
  await writeDiskBackup(payload, path);
}

export async function getTheme(): Promise<Theme> {
  const storage = getStorageArea();
  const data = await storage.get(THEME_KEY);
  const theme = data[THEME_KEY] as Theme | undefined;
  if (theme === "dark" || theme === "light" || theme === "system") return theme;
  return "system"; // default: follow the browser/OS preference
}

export async function saveTheme(theme: Theme): Promise<void> {
  const storage = getStorageArea();
  await storage.set({ [THEME_KEY]: theme });
}

/**
 * Parses a backup JSON string produced by backupNotesToDisk.
 * Returns the notes array if the file is valid (correct schema + matching checksum),
 * or null if the file is unrecognised or corrupted.
 */
export async function parseBackupFile(json: string): Promise<Note[] | null> {
  try {
    const parsed = JSON.parse(json);
    const payload = await readValidPayload(parsed);
    return payload ? payload.notes : null;
  } catch {
    return null;
  }
}

export async function getWorkspaceState(): Promise<WorkspaceState | null> {
  const storage = getStorageArea();
  const data = await storage.get(WORKSPACE_STATE_KEY);
  return normalizeWorkspaceState(data[WORKSPACE_STATE_KEY]);
}

export async function saveWorkspaceState(state: WorkspaceState): Promise<void> {
  const storage = getStorageArea();
  await storage.set({
    [WORKSPACE_STATE_KEY]: {
      ...state,
      splitRatio: clampSplitRatio(state.splitRatio)
    }
  });
}
