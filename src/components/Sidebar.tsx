import { useState } from "react";
import type { Note } from "../types";
import { ArrowDown, ArrowLeftFromLine, ArrowUp, ChevronRight, FolderOpen, GripVertical, Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { Experiments, isEnabled } from "../config/experiments";

function formatNoteDate(isoString: string): string {
  const date = new Date(isoString);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}


type SidebarProps = {
  notes: Note[];
  activeNoteId: string | null;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onSelectNote: (noteId: string) => void;
  onCreateNote: () => void;
  onDeleteNote: (noteId: string) => void;
  onSidebarToggle: () => void;
  onPinNote?: (noteId: string, pinned: boolean) => void;
  onSetFolder?: (noteId: string, folder: string | undefined) => void;
  onReorderNotes?: (noteIds: string[]) => void;
};

export function Sidebar({
  notes,
  activeNoteId,
  searchTerm,
  onSearchChange,
  onSelectNote,
  onCreateNote,
  onDeleteNote,
  onSidebarToggle,
  onPinNote,
  onSetFolder,
  onReorderNotes,
}: SidebarProps) {
  const showPinning = isEnabled(Experiments.SIDEBAR_PINNING);
  const showFoldersTags = isEnabled(Experiments.SIDEBAR_FOLDERS_TAGS);
  const showDragDrop = isEnabled(Experiments.SIDEBAR_DRAG_DROP);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [folderDragOver, setFolderDragOver] = useState<string | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<"modified" | "created">("modified");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  function toggleFolder(folderName: string) {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderName)) next.delete(folderName);
      else next.add(folderName);
      return next;
    });
  }

  // Drag-and-drop disabled during search (filtered list doesn't represent full order)
  const dragEnabled = showDragDrop && !searchTerm;

  // Sort is hidden and bypassed when drag-drop is handling manual order
  const sortEnabled = !showDragDrop;

  function applySortKey(arr: Note[]): Note[] {
    if (!sortEnabled) return arr;
    return [...arr].sort((a, b) => {
      const va = sortKey === "modified" ? a.updatedAt : a.createdAt;
      const vb = sortKey === "modified" ? b.updatedAt : b.createdAt;
      return sortDir === "desc" ? vb.localeCompare(va) : va.localeCompare(vb);
    });
  }

  // Returns the best sort value across all notes in a folder, used to order folders
  function folderTopValue(folderNotes: Note[]): string {
    return folderNotes.reduce((best, n) => {
      const v = sortKey === "modified" ? n.updatedAt : n.createdAt;
      return sortDir === "desc" ? (v > best ? v : best) : (v < best || !best ? v : best);
    }, "");
  }

  function handleSortKeyClick(key: "modified" | "created") {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const SortIcon = sortDir === "desc" ? ArrowDown : ArrowUp;

  function handleDelete(e: React.MouseEvent | React.KeyboardEvent, noteId: string) {
    e.stopPropagation();
    onDeleteNote(noteId);
  }

  function handlePin(e: React.MouseEvent | React.KeyboardEvent, note: Note) {
    e.stopPropagation();
    onPinNote?.(note.id, !note.pinned);
  }

  function handleFolderSet(e: React.MouseEvent | React.KeyboardEvent, note: Note) {
    e.stopPropagation();
    const input = window.prompt("Folder name (leave empty to remove):", note.folder ?? "");
    if (input === null) return;
    onSetFolder?.(note.id, input.trim() || undefined);
  }

  function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;
    const ids = notes.map((n) => n.id);
    const fromIdx = ids.indexOf(draggedId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...ids];
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, draggedId);
    onReorderNotes?.(next);
    setDraggedId(null);
    setDragOverId(null);
  }

  function handleFolderDrop(e: React.DragEvent, folder: string | undefined) {
    e.preventDefault();
    e.stopPropagation();
    if (draggedId) onSetFolder?.(draggedId, folder);
    setDraggedId(null);
    setFolderDragOver(null);
  }

  // Render a single note item with all active experiment decorations
  function renderNote(note: Note) {
    const isActive = note.id === activeNoteId;
    const isDragTarget = dragEnabled && dragOverId === note.id;
    const isBeingDragged = draggedId === note.id;

    return (
      <button
        key={note.id}
        className={[
          "note-item",
          isActive ? "active" : "",
          isDragTarget ? "drag-over" : "",
          isBeingDragged ? "is-dragging" : "",
        ].filter(Boolean).join(" ")}
        onClick={() => onSelectNote(note.id)}
        draggable={dragEnabled}
        onDragStart={dragEnabled ? (e) => {
          e.dataTransfer.setData("text/plain", note.id);
          e.dataTransfer.effectAllowed = "move";
          setDraggedId(note.id);
        } : undefined}
        onDragOver={dragEnabled ? (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          if (note.id !== draggedId) setDragOverId(note.id);
        } : undefined}
        onDragLeave={dragEnabled ? () => {
          setDragOverId((prev) => (prev === note.id ? null : prev));
        } : undefined}
        onDrop={dragEnabled ? (e) => handleDrop(e, note.id) : undefined}
        onDragEnd={dragEnabled ? () => { setDraggedId(null); setDragOverId(null); } : undefined}
      >
        <div className="note-item-top">
          {dragEnabled && (
            <span className="note-drag-handle" aria-hidden="true">
              <GripVertical size={14} strokeWidth={2} />
            </span>
          )}
          {showPinning && note.pinned && (
            <span className="note-pin-indicator" aria-label="Pinned">
              <Pin aria-hidden="true" size={10} strokeWidth={2.5} />
            </span>
          )}
          <span className="note-title">{note.title || "Untitled note"}</span>
          <div className="note-item-actions">
            {showFoldersTags && (
              <span
                className="note-action-btn"
                role="button"
                tabIndex={0}
                title="Set folder"
                aria-label="Set folder"
                onClick={(e) => handleFolderSet(e, note)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleFolderSet(e, note); }
                }}
              >
                <FolderOpen aria-hidden="true" size={14} strokeWidth={2} />
              </span>
            )}
            {showPinning && (
              <span
                className="note-action-btn"
                role="button"
                tabIndex={0}
                title={note.pinned ? "Unpin" : "Pin to top"}
                aria-label={note.pinned ? "Unpin note" : "Pin note to top"}
                onClick={(e) => handlePin(e, note)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handlePin(e, note); }
                }}
              >
                {note.pinned
                  ? <PinOff aria-hidden="true" size={14} strokeWidth={2} />
                  : <Pin aria-hidden="true" size={14} strokeWidth={2} />
                }
              </span>
            )}
            <span
              className="delete-note-btn"
              role="button"
              tabIndex={0}
              title="Delete note"
              aria-label="Delete note"
              onClick={(e) => handleDelete(e, note.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleDelete(e, note.id); }
              }}
            >
              <Trash2 aria-hidden="true" size={15} strokeWidth={2} />
            </span>
          </div>
        </div>
        <span className="note-date">{formatNoteDate(note.updatedAt)}</span>
      </button>
    );
  }

  // No sidebar experiments active — render flat default list
  if (!showPinning && !showFoldersTags && !showDragDrop) {
    return (
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>Markdown Notes</h1>
          <div className="sidebar-header-actions">
            <button className="button button-primary sidebar-icon-btn sidebar-new-btn" onClick={onCreateNote} title="New note" aria-label="New note">
              <Plus aria-hidden="true" size={20} strokeWidth={2} />
            </button>
            <button className="button sidebar-icon-btn" onClick={onSidebarToggle} title="Hide notes panel" aria-label="Hide notes panel">
              <ArrowLeftFromLine aria-hidden="true" size={26} strokeWidth={2} />
            </button>
          </div>
        </div>
        <input className="search-input" placeholder="Search notes..." value={searchTerm} onChange={(e) => onSearchChange(e.target.value)} />
        {sortEnabled && (
          <div className="sidebar-sort-row">
            <span className="sidebar-sort-label">Sort</span>
            <button className={`sidebar-sort-btn ${sortKey === "modified" ? "sidebar-sort-btn--active" : ""}`} onClick={() => handleSortKeyClick("modified")}>
              Modified{sortKey === "modified" && <SortIcon size={11} strokeWidth={2.5} />}
            </button>
            <button className={`sidebar-sort-btn ${sortKey === "created" ? "sidebar-sort-btn--active" : ""}`} onClick={() => handleSortKeyClick("created")}>
              Created{sortKey === "created" && <SortIcon size={11} strokeWidth={2.5} />}
            </button>
          </div>
        )}
        <div className="note-list">
          {notes.length === 0 ? (
            <p className="empty-text">No matching notes.</p>
          ) : (
            applySortKey(notes).map((note) => (
              <button
                key={note.id}
                className={`note-item ${note.id === activeNoteId ? "active" : ""}`}
                onClick={() => onSelectNote(note.id)}
              >
                <div className="note-item-top">
                  <span className="note-title">{note.title || "Untitled note"}</span>
                  <span
                    className="delete-note-btn"
                    role="button"
                    tabIndex={0}
                    title="Delete note"
                    aria-label="Delete note"
                    onClick={(e) => { e.stopPropagation(); onDeleteNote(note.id); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onDeleteNote(note.id); } }}
                  >
                    <Trash2 aria-hidden="true" size={15} strokeWidth={2} />
                  </span>
                </div>
                <span className="note-date">{formatNoteDate(note.updatedAt)}</span>
              </button>
            ))
          )}
        </div>
      </aside>
    );
  }

  // One or more sidebar experiments active — build composited list

  // Split into pinned / unpinned (only when PINNING is on)
  const pinnedNotes = showPinning ? notes.filter((n) => n.pinned) : [];
  const unpinnedNotes = showPinning ? notes.filter((n) => !n.pinned) : notes;

  // Group unpinned notes by folder (only when FOLDERS_TAGS is on)
  const folderMap = new Map<string, Note[]>();
  const ungrouped: Note[] = [];
  if (showFoldersTags) {
    for (const note of unpinnedNotes) {
      if (note.folder?.trim()) {
        const arr = folderMap.get(note.folder) ?? [];
        arr.push(note);
        folderMap.set(note.folder, arr);
      } else {
        ungrouped.push(note);
      }
    }
  }

  // Merge ungrouped notes and folder groups into a single list, sorted together
  type SidebarItem =
    | { type: "note"; note: Note }
    | { type: "folder"; name: string; notes: Note[] };

  const rawItems: SidebarItem[] = showFoldersTags ? [
    ...ungrouped.map((note): SidebarItem => ({ type: "note", note })),
    ...[...folderMap.entries()].map(([name, notes]): SidebarItem => ({ type: "folder", name, notes })),
  ] : [];

  const sortedItems: SidebarItem[] = !sortEnabled ? rawItems : [...rawItems].sort((a, b) => {
    const va = a.type === "note"
      ? (sortKey === "modified" ? a.note.updatedAt : a.note.createdAt)
      : folderTopValue(a.notes);
    const vb = b.type === "note"
      ? (sortKey === "modified" ? b.note.updatedAt : b.note.createdAt)
      : folderTopValue(b.notes);
    return sortDir === "desc" ? vb.localeCompare(va) : va.localeCompare(vb);
  });

  const totalVisible = notes.length;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>Markdown Notes</h1>
        <div className="sidebar-header-actions">
          <button className="button button-primary sidebar-icon-btn sidebar-new-btn" onClick={onCreateNote} title="New note" aria-label="New note">
            <Plus aria-hidden="true" size={20} strokeWidth={2} />
          </button>
          <button className="button sidebar-icon-btn" onClick={onSidebarToggle} title="Hide notes panel" aria-label="Hide notes panel">
            <ArrowLeftFromLine aria-hidden="true" size={26} strokeWidth={2} />
          </button>
        </div>
      </div>

      <input
        className="search-input"
        placeholder="Search notes..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
      />

      {/* Sort control */}
      {sortEnabled && (
        <div className="sidebar-sort-row">
          <span className="sidebar-sort-label">Sort</span>
          <button
            className={`sidebar-sort-btn ${sortKey === "modified" ? "sidebar-sort-btn--active" : ""}`}
            onClick={() => handleSortKeyClick("modified")}
          >
            Modified{sortKey === "modified" && <SortIcon size={11} strokeWidth={2.5} />}
          </button>
          <button
            className={`sidebar-sort-btn ${sortKey === "created" ? "sidebar-sort-btn--active" : ""}`}
            onClick={() => handleSortKeyClick("created")}
          >
            Created{sortKey === "created" && <SortIcon size={11} strokeWidth={2.5} />}
          </button>
        </div>
      )}

      <div className="note-list">
        {totalVisible === 0 ? (
          <p className="empty-text">No matching notes.</p>
        ) : (
          <>
            {/* Pinned section — SIDEBAR_PINNING */}
            {showPinning && pinnedNotes.length > 0 && (
              <>
                <div className="sidebar-section-header">
                  <Pin aria-hidden="true" size={11} strokeWidth={2.5} />
                  <span>Pinned</span>
                </div>
                {applySortKey(pinnedNotes).map(renderNote)}
                {unpinnedNotes.length > 0 && <div className="sidebar-section-divider" />}
              </>
            )}

            {/* Unpinned notes — flat or grouped by folder, all sorted together */}
            {showFoldersTags ? (
              <>
                {/* Unfiled drop zone — visible only while dragging */}
                {draggedId && (
                  <div
                    className={`sidebar-section-header sidebar-folder-dropzone ${folderDragOver === "" ? "folder-drag-over" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); setFolderDragOver(""); }}
                    onDragLeave={() => setFolderDragOver(null)}
                    onDrop={(e) => handleFolderDrop(e, undefined)}
                  >
                    <FolderOpen aria-hidden="true" size={13} strokeWidth={2} />
                    <span>Unfiled</span>
                  </div>
                )}
                {sortedItems.map((item) => {
                  if (item.type === "note") return renderNote(item.note);
                  const { name: folderName, notes: folderNotes } = item;
                  const isCollapsed = collapsedFolders.has(folderName);
                  return (
                    <div key={folderName} className="sidebar-folder-group">
                      <div
                        className={`sidebar-section-header sidebar-folder-dropzone ${folderDragOver === folderName ? "folder-drag-over" : ""}`}
                        onClick={() => toggleFolder(folderName)}
                        onDragOver={(e) => { e.preventDefault(); setFolderDragOver(folderName); }}
                        onDragLeave={() => setFolderDragOver(null)}
                        onDrop={(e) => handleFolderDrop(e, folderName)}
                      >
                        <ChevronRight
                          aria-hidden="true"
                          size={13}
                          strokeWidth={2.5}
                          className={`folder-chevron ${isCollapsed ? "" : "folder-chevron--open"}`}
                        />
                        <FolderOpen aria-hidden="true" size={13} strokeWidth={2} />
                        <span>{folderName}</span>
                        <span className="folder-note-count">{folderNotes.length}</span>
                      </div>
                      {!isCollapsed && (
                        <div className="folder-notes-container">
                          {applySortKey(folderNotes).map(renderNote)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            ) : (
              applySortKey(unpinnedNotes).map(renderNote)
            )}
          </>
        )}
      </div>
    </aside>
  );
}
