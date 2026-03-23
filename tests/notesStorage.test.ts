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
  saveBackupPath
} from "../src/storage/notesStorage";

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
});

