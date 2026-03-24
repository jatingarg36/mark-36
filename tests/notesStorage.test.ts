// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { webcrypto } from "node:crypto";
import type { Note } from "../src/types";
import {
  getAllNotes,
  saveAllNotes,
  getTheme,
  saveTheme,
  getBackupPath,
  saveBackupPath,
  parseBackupFile,
  getWorkspaceState,
  saveWorkspaceState,
} from "../src/storage/notesStorage";
import type { WorkspaceState } from "../src/types";

function createStorageMock(initial: Record<string, unknown> = {}) {
  let store: Record<string, unknown> = { ...initial };

  return {
    async get(keys: string | string[]) {
      if (Array.isArray(keys)) {
        const out: Record<string, unknown> = {};
        for (const key of keys) out[key] = store[key];
        return out;
      }

      return { [keys]: store[keys] };
    },
    async set(items: Record<string, unknown>) {
      store = { ...store, ...items };
    },
    _dump() {
      return store;
    }
  };
}

describe("notesStorage", () => {
  let storage: ReturnType<typeof createStorageMock>;

  beforeEach(() => {
    if (!globalThis.crypto?.subtle) {
      (globalThis as any).crypto = webcrypto;
    }

    storage = createStorageMock();
    (globalThis as any).chrome = {
      storage: {
        local: storage
      },
      // Prevent disk-backup codepaths from running.
      downloads: undefined
    };
  });

  afterEach(() => {
    delete (globalThis as any).chrome;
  });

  // ── existing tests ──────────────────────────────────────────────────────────

  it("returns [] when storage is empty", async () => {
    const notes = await getAllNotes();
    expect(notes).toEqual([]);
  });

  it("saveAllNotes then getAllNotes round-trips (checksum validated)", async () => {
    const notes: Note[] = [
      {
        id: "n1",
        title: "First",
        content: "Hello world",
        createdAt: new Date("2020-01-01").toISOString(),
        updatedAt: new Date("2020-01-02").toISOString()
      }
    ];

    await saveAllNotes(notes);

    const loaded = await getAllNotes();
    expect(loaded).toEqual(notes);

    const primaryPayload = (storage._dump() as any)["notes_primary_v2"];
    expect(primaryPayload.schemaVersion).toBe(2);
    expect(primaryPayload.notes).toEqual(notes);
    expect(primaryPayload.checksum).toEqual(expect.any(String));
  });

  it("migrates legacy notes key when v2 payloads are missing", async () => {
    const legacyNotes: Note[] = [
      {
        id: "legacy-1",
        title: "Legacy",
        content: "Old content",
        createdAt: new Date("2019-01-01").toISOString(),
        updatedAt: new Date("2019-01-02").toISOString()
      }
    ];

    // Replace empty store with one containing legacy key.
    storage = createStorageMock({
      notes: legacyNotes
    });
    (globalThis as any).chrome.storage.local = storage;

    const loaded = await getAllNotes();
    expect(loaded).toEqual(legacyNotes);

    const primaryPayload = (storage._dump() as any)["notes_primary_v2"];
    expect(primaryPayload.notes).toEqual(legacyNotes);
    expect((storage._dump() as any)["notes"]).toEqual(legacyNotes);
  });

  it("themes default to system and can be saved/loaded", async () => {
    expect(await getTheme()).toBe("system");
    await saveTheme("dark");
    expect(await getTheme()).toBe("dark");
  });

  it("backup path can be saved and read (trimmed)", async () => {
    expect(await getBackupPath()).toBe("");
    await saveBackupPath("  ");
    expect(await getBackupPath()).toBe("");

    await saveBackupPath("/tmp/notes-backup.json");
    expect(await getBackupPath()).toBe("/tmp/notes-backup.json");
  });

  // ── backup fallback & repair ────────────────────────────────────────────────

  it("falls back to backup when primary is corrupted and repairs primary", async () => {
    const notes: Note[] = [
      {
        id: "b1",
        title: "Backup note",
        content: "I survive corruption",
        createdAt: new Date("2021-01-01").toISOString(),
        updatedAt: new Date("2021-01-02").toISOString()
      }
    ];

    // First save to get a valid backup payload
    await saveAllNotes(notes);
    const dump = storage._dump() as any;
    const validBackup = dump["notes_backup_v2"];

    // Corrupt primary but keep backup
    storage = createStorageMock({
      notes_primary_v2: { schemaVersion: 2, savedAt: "bad", checksum: "000", notes: [] },
      notes_backup_v2: validBackup,
    });
    (globalThis as any).chrome.storage.local = storage;

    const loaded = await getAllNotes();
    expect(loaded).toEqual(notes);

    // Primary should have been repaired
    const repairedPrimary = (storage._dump() as any)["notes_primary_v2"];
    expect(repairedPrimary.notes).toEqual(notes);
  });

  // ── normalizeNotes – invalid items stripped ────────────────────────────────

  it("strips invalid items when loading from storage", async () => {
    const validNote: Note = {
      id: "v1",
      title: "Valid",
      content: "Good",
      createdAt: new Date("2022-01-01").toISOString(),
      updatedAt: new Date("2022-01-02").toISOString()
    };

    // Save first (through saveAllNotes which normalises before writing)
    await saveAllNotes([validNote]);

    // Now manually inject a corrupted legacy entry with a missing field
    const dump = storage._dump() as any;
    dump["notes"] = [validNote, { id: "bad", title: 123 /* no content */ }];

    // Simulate empty v2 to force legacy migration path
    storage = createStorageMock({ notes: dump["notes"] });
    (globalThis as any).chrome.storage.local = storage;

    const loaded = await getAllNotes();
    // Only the valid note should survive normalisation
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("v1");
  });

  // ── theme validation ────────────────────────────────────────────────────────

  it("rejects an invalid stored theme and defaults to system", async () => {
    // Bypass saveTheme to write an invalid value directly
    await storage.set({ theme: "rainbow" });
    const theme = await getTheme();
    expect(theme).toBe("system");
  });

  it("accepts all valid theme values", async () => {
    for (const theme of ["light", "dark", "system"] as const) {
      await saveTheme(theme);
      expect(await getTheme()).toBe(theme);
    }
  });

  // ── parseBackupFile ─────────────────────────────────────────────────────────

  it("parseBackupFile returns notes array from a valid backup JSON", async () => {
    const notes: Note[] = [
      {
        id: "pb1",
        title: "Parsed",
        content: "From backup",
        createdAt: new Date("2023-01-01").toISOString(),
        updatedAt: new Date("2023-01-02").toISOString()
      }
    ];
    await saveAllNotes(notes);
    const dump = storage._dump() as any;
    const json = JSON.stringify(dump["notes_primary_v2"]);

    const result = await parseBackupFile(json);
    expect(result).toEqual(notes);
  });

  it("parseBackupFile returns null for invalid JSON string", async () => {
    const result = await parseBackupFile("not { valid json");
    expect(result).toBeNull();
  });

  it("parseBackupFile returns null when checksum does not match", async () => {
    const notes: Note[] = [
      {
        id: "pb2",
        title: "Tampered",
        content: "Modified",
        createdAt: new Date("2023-06-01").toISOString(),
        updatedAt: new Date("2023-06-02").toISOString()
      }
    ];
    await saveAllNotes(notes);
    const dump = storage._dump() as any;
    const payload = { ...dump["notes_primary_v2"], checksum: "000badchecksum000" };
    const result = await parseBackupFile(JSON.stringify(payload));
    expect(result).toBeNull();
  });

  it("parseBackupFile returns null for a payload with wrong schema version", async () => {
    const payload = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      notes: [],
      checksum: "abc"
    };
    const result = await parseBackupFile(JSON.stringify(payload));
    expect(result).toBeNull();
  });

  // ── getWorkspaceState / saveWorkspaceState ──────────────────────────────────

  it("getWorkspaceState returns null when storage is empty", async () => {
    const state = await getWorkspaceState();
    expect(state).toBeNull();
  });

  it("saveWorkspaceState then getWorkspaceState round-trips correctly", async () => {
    const state: WorkspaceState = {
      activeNoteId: "note-abc",
      viewMode: "split",
      isSidebarCollapsed: false,
      syncScrollEnabled: true,
      splitRatio: 0.5,
      searchTerm: "hello",
      fontSize: 16
    };

    await saveWorkspaceState(state);
    const loaded = await getWorkspaceState();
    expect(loaded).toEqual(state);
  });

  it("getWorkspaceState clamps splitRatio to [0.2, 0.8]", async () => {
    const state: WorkspaceState = {
      activeNoteId: null,
      viewMode: "editor",
      isSidebarCollapsed: false,
      syncScrollEnabled: false,
      splitRatio: 0.99, // exceeds max
      searchTerm: "",
      fontSize: 14
    };

    await saveWorkspaceState(state);
    const loaded = await getWorkspaceState();
    expect(loaded?.splitRatio).toBe(0.8);
  });

  it("getWorkspaceState clamps splitRatio below minimum", async () => {
    const state: WorkspaceState = {
      activeNoteId: null,
      viewMode: "preview",
      isSidebarCollapsed: true,
      syncScrollEnabled: false,
      splitRatio: 0.05, // below min
      searchTerm: "",
      fontSize: 14
    };

    await saveWorkspaceState(state);
    const loaded = await getWorkspaceState();
    expect(loaded?.splitRatio).toBe(0.2);
  });

  it("getWorkspaceState clamps fontSize to [12, 20]", async () => {
    // Bypass saveWorkspaceState to write an out-of-range value directly
    await storage.set({
      workspace_state_v1: {
        viewMode: "editor",
        activeNoteId: null,
        isSidebarCollapsed: false,
        syncScrollEnabled: false,
        splitRatio: 0.5,
        searchTerm: "",
        fontSize: 99
      }
    });
    const loaded = await getWorkspaceState();
    expect(loaded?.fontSize).toBe(20);
  });

  it("getWorkspaceState returns null for an invalid viewMode", async () => {
    await storage.set({
      workspace_state_v1: {
        viewMode: "invalid_mode",
        activeNoteId: null,
        isSidebarCollapsed: false,
        syncScrollEnabled: false,
        splitRatio: 0.5,
        searchTerm: "",
        fontSize: 14
      }
    });
    const loaded = await getWorkspaceState();
    expect(loaded).toBeNull();
  });
});
