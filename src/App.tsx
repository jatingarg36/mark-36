import { useEffect, useMemo, useRef, useState } from "react";
import type { UIEventHandler } from "react";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { PreviewPane } from "./components/PreviewPane";
import { ShortcutsModal } from "./components/ShortcutsModal";
import { EditorPane } from "./editor/EditorPane";
import { renderMarkdown } from "./preview/markdownRenderer";
import {
  backupNotesToDisk,
  getAllNotes,
  getBackupPath,
  getTheme,
  getWorkspaceState,
  saveAllNotes,
  saveBackupPath,
  saveTheme,
  saveWorkspaceState
} from "./storage/notesStorage";
import type { Note, Theme, ViewMode } from "./types";
import { debounce } from "./utils/debounce";

const AUTOSAVE_DELAY_MS = 450;
const DEFAULT_NOTE_TITLE = "Untitled note";
const DEFAULT_DISK_BACKUP_PATH = "MarkdownNotesWorkspace/notes-backup.json";
const MD_PATH_QUERY_KEYS = ["mdPath", "md", "filePath"] as const;

function createEmptyNote(): Note {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  return {
    id,
    title: DEFAULT_NOTE_TITLE,
    content: "",
    createdAt: now,
    updatedAt: now,
    viewMode: "split"
  };
}

function isBlankNewNote(note: Note | undefined): boolean {
  if (!note) {
    return false;
  }
  return note.title === DEFAULT_NOTE_TITLE && note.content.trim().length === 0;
}

function hasNoteContent(note: Note | undefined): boolean {
  return Boolean(note && note.content.trim().length > 0);
}

function isPersistableNote(note: Note): boolean {
  const hasContent = note.content.trim().length > 0;
  const normalizedTitle = note.title.trim();
  const hasMeaningfulTitle = normalizedTitle.length > 0 && normalizedTitle !== DEFAULT_NOTE_TITLE;
  return hasContent || hasMeaningfulTitle;
}

function getPersistableNotes(notes: Note[]): Note[] {
  return notes.filter(isPersistableNote);
}

function clampSplitRatio(value: number): number {
  return Math.min(0.8, Math.max(0.2, value));
}

function resolveNoteViewMode(note: Note | undefined): ViewMode {
  if (note?.viewMode === "editor" || note?.viewMode === "split" || note?.viewMode === "preview") {
    return note.viewMode;
  }
  return hasNoteContent(note) ? "preview" : "editor";
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || target.isContentEditable;
}

function getMdPathFromQuery(): string | null {
  const searchParams = new URLSearchParams(window.location.search);
  for (const key of MD_PATH_QUERY_KEYS) {
    const value = searchParams.get(key)?.trim();
    if (value) {
      return value;
    }
  }
  return null;
}

function normalizeToFileUrl(pathOrUrl: string): string | null {
  if (pathOrUrl.startsWith("file://")) {
    return pathOrUrl;
  }
  if (pathOrUrl.startsWith("/")) {
    return `file://${encodeURI(pathOrUrl)}`;
  }
  return null;
}

function titleFromPath(pathOrUrl: string): string {
  const withoutQuery = pathOrUrl.split(/[?#]/)[0];
  const pieces = withoutQuery.split("/");
  const rawName = pieces[pieces.length - 1] ?? "";
  const decoded = rawName ? decodeURIComponent(rawName) : "Imported note";
  return decoded.replace(/\.md$/i, "").trim() || "Imported note";
}

async function loadExternalMarkdownNote(pathOrUrl: string): Promise<Note | null> {
  const fileUrl = normalizeToFileUrl(pathOrUrl);
  if (!fileUrl) {
    return null;
  }

  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to read file: ${response.status}`);
  }
  const text = await response.text();
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    title: titleFromPath(pathOrUrl),
    content: text,
    createdAt: now,
    updatedAt: now,
    viewMode: text.trim().length > 0 ? "preview" : "editor"
  };
}

export default function App() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [theme, setTheme] = useState<Theme>("light");
  const [isSaving, setIsSaving] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [syncScrollEnabled, setSyncScrollEnabled] = useState(false);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [isResizingSplit, setIsResizingSplit] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const hydratedRef = useRef(false);
  const splitLayoutRef = useRef<HTMLDivElement | null>(null);
  const editorScrollRef = useRef<HTMLTextAreaElement | null>(null);
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const syncSourceRef = useRef<"editor" | "preview" | null>(null);

  const getScrollRatio = (element: HTMLElement) => {
    const maxScrollable = element.scrollHeight - element.clientHeight;
    if (maxScrollable <= 0) {
      return 0;
    }
    return element.scrollTop / maxScrollable;
  };

  const applyScrollRatio = (element: HTMLElement, ratio: number) => {
    const maxScrollable = element.scrollHeight - element.clientHeight;
    element.scrollTop = Math.max(0, maxScrollable * ratio);
  };

  const setSyncSource = (source: "editor" | "preview") => {
    syncSourceRef.current = source;
    window.requestAnimationFrame(() => {
      syncSourceRef.current = null;
    });
  };

  const shortcutItems = useMemo(
    () => [
      { combo: "Cmd/Ctrl + N", description: "Create a new note" },
      { combo: "Cmd/Ctrl + B", description: "Toggle notes sidebar" },
      { combo: "Cmd/Ctrl + 1", description: "Switch to Editor view" },
      { combo: "Cmd/Ctrl + 2", description: "Switch to Split view" },
      { combo: "Cmd/Ctrl + 3", description: "Switch to Preview view" },
      { combo: "Cmd/Ctrl + /", description: "Toggle Sync Scroll (Split mode only)" }
    ],
    []
  );

  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const hydrate = async () => {
      const [savedNotes, savedTheme, savedWorkspaceState] = await Promise.all([
        getAllNotes(),
        getTheme(),
        getWorkspaceState()
      ]);
      const baseNotes = (savedNotes.length > 0 ? savedNotes : [createEmptyNote()]).map((note) => ({
        ...note,
        viewMode: resolveNoteViewMode(note)
      }));
      const shouldCreateLandingDraft = !savedWorkspaceState;
      const notesWithLandingDraft = shouldCreateLandingDraft && !isBlankNewNote(baseNotes[0])
        ? [createEmptyNote(), ...baseNotes]
        : baseNotes;

      const startupNotes = notesWithLandingDraft;
      const externalMdPath = getMdPathFromQuery();
      let importedNoteId: string | null = null;
      if (externalMdPath) {
        try {
          const importedNote = await loadExternalMarkdownNote(externalMdPath);
          if (importedNote) {
            startupNotes.unshift(importedNote);
            importedNoteId = importedNote.id;
          }
        } catch (error) {
          console.error("Failed to import markdown from path query:", error);
        }
      }

      const preferredNoteId = importedNoteId ?? savedWorkspaceState?.activeNoteId ?? null;
      const initialActiveNote =
        startupNotes.find((note) => note.id === preferredNoteId) ?? startupNotes[0];

      setNotes(startupNotes);
      setActiveNoteId(initialActiveNote.id);
      setViewMode(savedWorkspaceState?.viewMode ?? resolveNoteViewMode(initialActiveNote));
      setIsSidebarCollapsed(savedWorkspaceState?.isSidebarCollapsed ?? false);
      setSyncScrollEnabled(savedWorkspaceState?.syncScrollEnabled ?? false);
      setSplitRatio(savedWorkspaceState?.splitRatio ?? 0.5);
      setSearchTerm(savedWorkspaceState?.searchTerm ?? "");
      setTheme(savedTheme);
      hydratedRef.current = true;
    };

    void hydrate();
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) {
      return;
    }

    const activeExists = notes.some((note) => note.id === activeNoteId);
    void saveWorkspaceState({
      activeNoteId: activeExists ? activeNoteId : null,
      viewMode,
      isSidebarCollapsed,
      syncScrollEnabled,
      splitRatio: clampSplitRatio(splitRatio),
      searchTerm
    });
  }, [
    notes,
    activeNoteId,
    viewMode,
    isSidebarCollapsed,
    syncScrollEnabled,
    splitRatio,
    searchTerm
  ]);

  const activeNote = useMemo(
    () => notes.find((note) => note.id === activeNoteId) ?? null,
    [notes, activeNoteId]
  );

  const filteredNotes = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();
    if (!normalizedQuery) {
      return [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }

    return notes
      .filter((note) => {
        const haystack = `${note.title}\n${note.content}`.toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [notes, searchTerm]);

  const previewHtml = useMemo(
    () => renderMarkdown(activeNote?.content ?? "_Start writing markdown on the left._"),
    [activeNote?.content]
  );

  const persistDebounced = useMemo(
    () =>
      debounce(async (nextNotes: Note[]) => {
        await saveAllNotes(getPersistableNotes(nextNotes));
        setIsSaving(false);
      }, AUTOSAVE_DELAY_MS),
    []
  );

  useEffect(() => {
    if (!hydratedRef.current) {
      return;
    }
    setIsSaving(true);
    persistDebounced(notes);
  }, [notes, persistDebounced]);

  const updateActiveNote = (changes: Partial<Pick<Note, "title" | "content">>) => {
    if (!activeNoteId) {
      return;
    }

    setNotes((previous) =>
      previous.map((note) => {
        if (note.id !== activeNoteId) {
          return note;
        }

        return {
          ...note,
          title: changes.title !== undefined ? changes.title : note.title,
          content: changes.content ?? note.content,
          updatedAt: new Date().toISOString()
        };
      })
    );
  };

  const handleCreateNote = () => {
    const note = createEmptyNote();
    setNotes((previous) => [note, ...previous]);
    setActiveNoteId(note.id);
    setViewMode("split");
  };

  const handleSelectNote = (noteId: string) => {
    const selectedNote = notes.find((note) => note.id === noteId);
    setActiveNoteId(noteId);
    setViewMode(resolveNoteViewMode(selectedNote));
  };

  const handleDeleteNote = (noteId: string) => {
    const targetNote = notes.find((note) => note.id === noteId);
    const noteTitle = targetNote?.title || "Untitled note";
    const shouldDelete = window.confirm(`Delete "${noteTitle}"? This action cannot be undone.`);
    if (!shouldDelete) {
      return;
    }

    setNotes((previous) => {
      const remaining = previous.filter((note) => note.id !== noteId);
      if (remaining.length === 0) {
        const replacement = createEmptyNote();
        setActiveNoteId(replacement.id);
        setViewMode(resolveNoteViewMode(replacement));
        return [replacement];
      }

      if (activeNoteId === noteId) {
        setActiveNoteId(remaining[0].id);
        setViewMode(resolveNoteViewMode(remaining[0]));
      }

      return remaining;
    });
  };

  const handleExport = () => {
    if (!activeNote) {
      return;
    }

    const blob = new Blob([activeNote.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const safeName = activeNote.title.replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "");
    const filename = `${safeName || "note"}.md`;

    chrome.downloads.download({
      url,
      filename,
      conflictAction: "uniquify",
      saveAs: true
    });

    window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
  };

  const handleImport = async (file: File) => {
    const text = await file.text();
    const now = new Date().toISOString();
    const titleFromFile = file.name.replace(/\.md$/i, "").trim() || "Imported note";
    const note: Note = {
      id: crypto.randomUUID(),
      title: titleFromFile,
      content: text,
      createdAt: now,
      updatedAt: now,
      viewMode: text.trim().length > 0 ? "preview" : "editor"
    };

    setNotes((previous) => [note, ...previous]);
    setActiveNoteId(note.id);
    setViewMode(resolveNoteViewMode(note));
  };

  const handleToggleTheme = () => {
    setTheme((previous) => {
      const nextTheme = previous === "dark" ? "light" : "dark";
      void saveTheme(nextTheme);
      return nextTheme;
    });
  };

  const handleBackupNow = async () => {
    let backupPath = await getBackupPath();
    if (!backupPath) {
      const userInput = window.prompt(
        "Enter backup file path (relative to Downloads):",
        DEFAULT_DISK_BACKUP_PATH
      );

      if (!userInput) {
        return;
      }

      backupPath = userInput.trim();
      if (!backupPath) {
        return;
      }

      await saveBackupPath(backupPath);
    }

    try {
      const persistableNotes = getPersistableNotes(notes);
      await backupNotesToDisk(persistableNotes, backupPath);
      window.alert(`Backup created at Downloads/${backupPath}`);
    } catch (error) {
      console.error(error);
      window.alert("Backup failed. Please check downloads permission and try again.");
    }
  };

  useEffect(() => {
    if (!isResizingSplit) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (viewMode !== "split" || !splitLayoutRef.current) {
        return;
      }

      const rect = splitLayoutRef.current.getBoundingClientRect();
      if (rect.width <= 0) {
        return;
      }

      const nextRatio = (event.clientX - rect.left) / rect.width;
      const clampedRatio = clampSplitRatio(nextRatio);
      setSplitRatio(clampedRatio);
    };

    const handlePointerUp = () => {
      setIsResizingSplit(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizingSplit, viewMode]);

  useEffect(() => {
    if (viewMode !== "split") {
      setIsResizingSplit(false);
    }
  }, [viewMode]);

  useEffect(() => {
    if (!isShortcutsOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsShortcutsOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isShortcutsOpen]);

  const handleEditorScroll: UIEventHandler<HTMLTextAreaElement> = (event) => {
    if (!syncScrollEnabled || viewMode !== "split") {
      return;
    }
    if (syncSourceRef.current === "preview") {
      return;
    }

    const previewElement = previewScrollRef.current;
    if (!previewElement) {
      return;
    }

    const ratio = getScrollRatio(event.currentTarget);
    setSyncSource("editor");
    applyScrollRatio(previewElement, ratio);
  };

  const handlePreviewScroll: UIEventHandler<HTMLDivElement> = (event) => {
    if (!syncScrollEnabled || viewMode !== "split") {
      return;
    }
    if (syncSourceRef.current === "editor") {
      return;
    }

    const editorElement = editorScrollRef.current;
    if (!editorElement) {
      return;
    }

    const ratio = getScrollRatio(event.currentTarget);
    setSyncSource("preview");
    applyScrollRatio(editorElement, ratio);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (!activeNoteId) {
      return;
    }

    setNotes((previous) =>
      previous.map((note) => {
        if (note.id !== activeNoteId) {
          return note;
        }
        return { ...note, viewMode: mode };
      })
    );
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isModifierPressed = event.metaKey || event.ctrlKey;
      if (!isModifierPressed) {
        return;
      }

      const editableTarget = isEditableTarget(event.target);
      const key = event.key.toLowerCase();

      if (key === "n") {
        event.preventDefault();
        handleCreateNote();
        return;
      }

      if (key === "b") {
        event.preventDefault();
        setIsSidebarCollapsed((previous) => !previous);
        return;
      }

      if (key === "1") {
        event.preventDefault();
        handleViewModeChange("editor");
        return;
      }

      if (key === "2") {
        event.preventDefault();
        handleViewModeChange("split");
        return;
      }

      if (key === "3") {
        event.preventDefault();
        handleViewModeChange("preview");
        return;
      }

      // Avoid interfering with browser find/replace shortcuts in text inputs.
      if (editableTarget) {
        return;
      }

      if (key === "/") {
        event.preventDefault();
        if (viewMode === "split") {
          setSyncScrollEnabled((previous) => !previous);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode]);

  return (
    <main className={`app-shell ${isSidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      {!isSidebarCollapsed ? (
        <Sidebar
          notes={filteredNotes}
          activeNoteId={activeNoteId}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onCollapse={() => setIsSidebarCollapsed(true)}
          onCreateNote={handleCreateNote}
          onSelectNote={handleSelectNote}
          onDeleteNote={handleDeleteNote}
        />
      ) : null}
      <section className="workspace">
        <TopBar
          theme={theme}
          onThemeToggle={handleToggleTheme}
          onExport={handleExport}
          onImport={handleImport}
          hasActiveNote={Boolean(activeNote)}
          isSidebarCollapsed={isSidebarCollapsed}
          onSidebarToggle={() => setIsSidebarCollapsed((previous) => !previous)}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          syncScrollEnabled={syncScrollEnabled}
          onSyncScrollToggle={() => setSyncScrollEnabled((previous) => !previous)}
          onShowShortcuts={() => setIsShortcutsOpen(true)}
          onBackupNow={handleBackupNow}
        />
        <div
          ref={splitLayoutRef}
          className={`split-layout mode-${viewMode} ${isResizingSplit ? "resizing" : ""}`}
          style={
            viewMode === "split"
              ? {
                  gridTemplateColumns: `${splitRatio.toFixed(4)}fr 8px ${(1 - splitRatio).toFixed(
                    4
                  )}fr`
                }
              : undefined
          }
        >
          {viewMode !== "preview" ? (
            <EditorPane
              title={activeNote?.title ?? ""}
              content={activeNote?.content ?? ""}
              onTitleChange={(value) => updateActiveNote({ title: value })}
              onContentChange={(value) => updateActiveNote({ content: value })}
              isSaving={isSaving}
              updatedAt={activeNote?.updatedAt}
              textAreaRef={editorScrollRef}
              onEditorScroll={handleEditorScroll}
            />
          ) : null}
          {viewMode === "split" ? (
            <div
              className="pane-resizer"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize editor and preview panes"
              onPointerDown={() => setIsResizingSplit(true)}
            />
          ) : null}
          {viewMode !== "editor" ? (
            <PreviewPane
              html={previewHtml}
              canCopy={hasNoteContent(activeNote ?? undefined)}
              previewContentRef={previewScrollRef}
              onPreviewScroll={handlePreviewScroll}
            />
          ) : null}
        </div>
      </section>
      {isShortcutsOpen ? (
        <ShortcutsModal shortcuts={shortcutItems} onClose={() => setIsShortcutsOpen(false)} />
      ) : null}
    </main>
  );
}
