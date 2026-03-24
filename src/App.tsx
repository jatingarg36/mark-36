import { useEffect, useMemo, useRef, useState } from "react";
import type { UIEventHandler } from "react";
import { Minimize2 } from "lucide-react";
import "katex/dist/katex.min.css";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { PreviewPane } from "./components/PreviewPane";
import { NoteSearch } from "./components/NoteSearch";
import { ShortcutsModal } from "./components/ShortcutsModal";
import { StatusBar } from "./components/StatusBar";
import { EditorPane } from "./editor/EditorPane";
import { renderMarkdown } from "./preview/markdownRenderer";
import {
  backupNotesToDisk,
  getAllNotes,
  getBackupPath,
  getTheme,
  getWorkspaceState,
  parseBackupFile,
  saveAllNotes,
  saveBackupPath,
  saveTheme,
  saveWorkspaceState
} from "./storage/notesStorage";
import type { Note, Theme, ViewMode } from "./types";
import { debounce } from "./utils/debounce";
import { exportToDocx } from "./utils/exportDocx";
import { Experiments, isEnabled } from "./config/experiments";
import {
  applyChromeThemeColors,
  clearChromeThemeColors,
  loadChromeFrameColor,
  subscribeChromeThemeChanges
} from "./utils/chromeTheme";

const AUTOSAVE_DELAY_MS = 450;
const DEFAULT_NOTE_TITLE = "Untitled note";
const DEFAULT_DISK_BACKUP_PATH = "MarkdownNotesWorkspace/notes-backup.json";
const DEFAULT_SIDEBAR_WIDTH = 300;
const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 480;
const SIDEBAR_COLLAPSE_THRESHOLD = 80;
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
  const [theme, setTheme] = useState<Theme>("system");
  const [chromeFrameColor, setChromeFrameColor] = useState<[number, number, number] | null>(null);
  const [systemIsDark, setSystemIsDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [syncScrollEnabled, setSyncScrollEnabled] = useState(false);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [fontSize, setFontSize] = useState(14);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizingSplit, setIsResizingSplit] = useState(false);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isNoteSearchOpen, setIsNoteSearchOpen] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [noteSearchQuery, setNoteSearchQuery] = useState("");
  const [noteSearchMatchIndex, setNoteSearchMatchIndex] = useState(0);
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

  // Always track OS/browser preference changes
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const resolvedTheme = theme === "system" ? (systemIsDark ? "dark" : "light") : theme;

  useEffect(() => {
    document.body.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  // Load Chrome profile theme color on mount and re-apply when Chrome theme changes
  useEffect(() => {
    const load = async () => {
      const color = await loadChromeFrameColor();
      setChromeFrameColor(color);
    };
    void load();
    const unsubscribe = subscribeChromeThemeChanges(() => void load());
    return unsubscribe;
  }, []);

  // Apply Chrome-derived palette whenever frame color or light/dark mode changes
  useEffect(() => {
    if (chromeFrameColor) {
      applyChromeThemeColors(chromeFrameColor, resolvedTheme === "dark");
    } else {
      clearChromeThemeColors();
    }
  }, [chromeFrameColor, resolvedTheme]);

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
      setFontSize(savedWorkspaceState?.fontSize ?? 14);
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
      searchTerm,
      fontSize
    });
  }, [
    notes,
    activeNoteId,
    viewMode,
    isSidebarCollapsed,
    syncScrollEnabled,
    splitRatio,
    searchTerm,
    fontSize
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

  const previewHtml = useMemo(() => {
    const content = activeNote?.content ?? "_Start writing markdown on the left._";
    const trimmed = content.trim();
    if (trimmed) {
      try {
        const parsed = JSON.parse(trimmed);
        return renderMarkdown("```json\n" + JSON.stringify(parsed, null, 2) + "\n```");
      } catch {
        // not JSON, render as markdown
      }
    }
    return renderMarkdown(content);
  }, [activeNote?.content]);

  useEffect(() => { setNoteSearchMatchIndex(0); }, [noteSearchQuery, activeNoteId]);

  const noteSearchMatchCount = useMemo(() => {
    const content = activeNote?.content ?? "";
    if (!noteSearchQuery.trim() || !content) return 0;
    const q = noteSearchQuery.toLowerCase();
    const lower = content.toLowerCase();
    let count = 0;
    let idx = lower.indexOf(q);
    while (idx !== -1) { count++; idx = lower.indexOf(q, idx + 1); }
    return count;
  }, [activeNote?.content, noteSearchQuery]);

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

    const remaining = notes.filter((note) => note.id !== noteId);
    if (remaining.length === 0) {
      const replacement = createEmptyNote();
      setNotes([replacement]);
      setActiveNoteId(replacement.id);
      setViewMode(resolveNoteViewMode(replacement));
      return;
    }

    setNotes(remaining);
    if (activeNoteId === noteId) {
      setActiveNoteId(remaining[0].id);
      setViewMode(resolveNoteViewMode(remaining[0]));
    }
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

  const handleExportDocx = async () => {
    if (!activeNote) return;

    let url: string | null = null;
    try {
      const blob = await exportToDocx(activeNote.title, activeNote.content);
      url = URL.createObjectURL(blob);
      const safeName = activeNote.title.replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "");
      const filename = `${safeName || "note"}.docx`;

      chrome.downloads.download(
        { url, filename, conflictAction: "uniquify", saveAs: true },
        () => {
          if (chrome.runtime.lastError) {
            console.error("DOCX download failed:", chrome.runtime.lastError.message);
            window.alert("Export failed. Please try again.");
          }
        }
      );

      window.setTimeout(() => {
        if (url) URL.revokeObjectURL(url);
      }, 5_000);
    } catch (error) {
      console.error("Failed to generate DOCX:", error);
      window.alert("Failed to export document. Please try again.");
      if (url) URL.revokeObjectURL(url);
    }
  };

  const handleImport = async (file: File) => {
    const text = await file.text();

    // Backup JSON import
    if (file.name.toLowerCase().endsWith(".json")) {
      const backupNotes = await parseBackupFile(text);
      if (!backupNotes) {
        window.alert("This file isn't a valid Markdown Notes backup. Only .json files exported by the Backup feature are supported.");
        return;
      }
      const existingIds = new Set(notes.map((n) => n.id));
      const incoming = backupNotes
        .filter((n) => !existingIds.has(n.id))
        .map((n) => ({ ...n, viewMode: resolveNoteViewMode(n) }));
      if (incoming.length === 0) {
        window.alert("All notes in this backup already exist — nothing was imported.");
        return;
      }
      setNotes((previous) => [...incoming, ...previous]);
      return;
    }

    // Markdown file import
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
      const nextTheme = previous === "light" ? "dark" : previous === "dark" ? "system" : "light";
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
    if (!isResizingSidebar) return;

    const handlePointerMove = (event: PointerEvent) => {
      const newWidth = event.clientX;
      if (newWidth < SIDEBAR_COLLAPSE_THRESHOLD) {
        setIsResizingSidebar(false);
        setIsSidebarCollapsed(true);
        return;
      }
      setSidebarWidth(Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, newWidth)));
    };

    const handlePointerUp = () => setIsResizingSidebar(false);

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
  }, [isResizingSidebar]);

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
    const editorElement = event.currentTarget;
    if (!previewElement || !editorElement) {
      return;
    }

    setSyncSource("editor");

    if (isEnabled(Experiments.SCROLL_SYNC_POLISH)) {
      const line = Math.floor(editorElement.scrollTop / (fontSize * 1.6)) + 1;
      const lines = Array.from(previewElement.querySelectorAll('.line')) as HTMLElement[];
      let targetEl: HTMLElement | null = null;
      for (const el of lines) {
        if (parseInt(el.getAttribute('data-line') || '0', 10) <= line) {
          targetEl = el;
        } else {
          break;
        }
      }
      if (targetEl) {
        previewElement.scrollTop = targetEl.offsetTop;
      } else {
        applyScrollRatio(previewElement, getScrollRatio(editorElement));
      }
    } else {
      const ratio = getScrollRatio(editorElement);
      applyScrollRatio(previewElement, ratio);
    }
  };

  const handlePreviewScroll: UIEventHandler<HTMLDivElement> = (event) => {
    if (!syncScrollEnabled || viewMode !== "split") {
      return;
    }
    if (syncSourceRef.current === "editor") {
      return;
    }

    const editorElement = editorScrollRef.current;
    const previewElement = event.currentTarget;
    if (!editorElement || !previewElement) {
      return;
    }

    setSyncSource("preview");

    if (isEnabled(Experiments.SCROLL_SYNC_POLISH)) {
      const previewScrollTop = previewElement.scrollTop;
      const lines = Array.from(previewElement.querySelectorAll('.line')) as HTMLElement[];
      let targetLine = 1;
      for (const el of lines) {
        if (el.offsetTop <= previewScrollTop + 10) {
          targetLine = parseInt(el.getAttribute('data-line') || '1', 10);
        } else {
          break;
        }
      }
      editorElement.scrollTop = (targetLine - 1) * (fontSize * 1.6);
    } else {
      const ratio = getScrollRatio(previewElement);
      applyScrollRatio(editorElement, ratio);
    }
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
      if (event.key === "Escape" && isZenMode) {
        setIsZenMode(false);
        return;
      }

      const isModifierPressed = event.metaKey || event.ctrlKey;
      if (!isModifierPressed) {
        return;
      }

      const editableTarget = isEditableTarget(event.target);
      const key = event.key.toLowerCase();

      if (key === "f") {
        event.preventDefault();
        setIsNoteSearchOpen((prev) => {
          if (!prev) setNoteSearchQuery("");
          return !prev;
        });
        return;
      }

      if (key === "n") {
        event.preventDefault();
        handleCreateNote();
        return;
      }

      if (key === "j" && isEnabled(Experiments.ZEN_MODE)) {
        event.preventDefault();
        setIsZenMode((prev) => !prev);
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
  }, [viewMode, activeNoteId, isZenMode]);

  const showSidebar = !isSidebarCollapsed && !isZenMode;
  const showTopBar = !isZenMode;

  return (
    <main
      className={`app-shell ${!showSidebar ? "sidebar-collapsed" : ""} ${isResizingSidebar ? "resizing-sidebar" : ""} ${isZenMode ? "zen-mode" : ""}`}
      style={showSidebar ? { gridTemplateColumns: `${sidebarWidth}px 8px 1fr` } : undefined}
    >
      {showSidebar ? (
        <>
          <Sidebar
            notes={filteredNotes}
            activeNoteId={activeNoteId}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onCreateNote={handleCreateNote}
            onSelectNote={handleSelectNote}
            onDeleteNote={handleDeleteNote}
            onSidebarToggle={() => setIsSidebarCollapsed(true)}
          />
          <div
            className="sidebar-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize notes panel"
            onPointerDown={() => setIsResizingSidebar(true)}
          />
        </>
      ) : null}
      <section className="workspace">
        {isZenMode && (
          <button
            className="zen-mode-exit-btn"
            onClick={() => setIsZenMode(false)}
            aria-label="Exit Zen Mode"
            title="Exit Zen Mode (Esc)"
          >
            <Minimize2 aria-hidden="true" size={20} strokeWidth={2} />
          </button>
        )}
        {isNoteSearchOpen && !isZenMode && (
          <NoteSearch
            query={noteSearchQuery}
            onQueryChange={setNoteSearchQuery}
            matchIndex={noteSearchMatchIndex}
            matchCount={noteSearchMatchCount}
            onPrev={() => setNoteSearchMatchIndex((i) => (i - 1 + noteSearchMatchCount) % Math.max(1, noteSearchMatchCount))}
            onNext={() => setNoteSearchMatchIndex((i) => (i + 1) % Math.max(1, noteSearchMatchCount))}
            onClose={() => { setIsNoteSearchOpen(false); setNoteSearchQuery(""); }}
          />
        )}
        {showTopBar && (
          <TopBar
            theme={theme}
            onThemeToggle={handleToggleTheme}
            onExport={handleExport}
            onExportDocx={isEnabled(Experiments.EXPORT_DOCX) ? handleExportDocx : undefined}
            onImport={handleImport}
            hasActiveNote={Boolean(activeNote)}
            isSidebarCollapsed={isSidebarCollapsed}
            onSidebarToggle={() => {
              setIsSidebarCollapsed((previous) => {
                // When expanding, ensure we restore to at least MIN_SIDEBAR_WIDTH
                if (previous) setSidebarWidth((w) => Math.max(w, MIN_SIDEBAR_WIDTH));
                return !previous;
              });
            }}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            syncScrollEnabled={syncScrollEnabled}
            onSyncScrollToggle={() => setSyncScrollEnabled((previous) => !previous)}
            onShowShortcuts={() => setIsShortcutsOpen(true)}
            onBackupNow={handleBackupNow}
            fontSize={fontSize}
            onFontSizeChange={setFontSize}
            isZenMode={isZenMode}
            onZenModeToggle={() => setIsZenMode(prev => !prev)}
          />
        )}
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
              fontSize={fontSize}
              noteSearchQuery={isNoteSearchOpen ? noteSearchQuery : ""}
              noteSearchMatchIndex={noteSearchMatchIndex}
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
              fontSize={fontSize}
              noteSearchQuery={isNoteSearchOpen ? noteSearchQuery : ""}
              noteSearchMatchIndex={noteSearchMatchIndex}
              theme={resolvedTheme}
            />
          ) : null}
        </div>
        <StatusBar content={activeNote?.content ?? ""} />
      </section>
      {isShortcutsOpen ? (
        <ShortcutsModal shortcuts={shortcutItems} onClose={() => setIsShortcutsOpen(false)} />
      ) : null}
    </main>
  );
}
