import type { Note } from "../types";
import { ArrowLeftFromLine, Plus, Trash2 } from "lucide-react";

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
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>Markdown Notes</h1>
        <div className="sidebar-header-actions">
          <button className="button button-primary sidebar-icon-btn sidebar-new-btn" onClick={onCreateNote} title="New note" aria-label="New note">
            <Plus aria-hidden="true" size={20} strokeWidth={2} />
          </button>
          <button
            className="button sidebar-icon-btn"
            onClick={onSidebarToggle}
            title="Hide notes panel"
            aria-label="Hide notes panel"
          >
            <ArrowLeftFromLine aria-hidden="true" size={26} strokeWidth={2} />
          </button>
        </div>
      </div>
      <input
        className="search-input"
        placeholder="Search notes..."
        value={searchTerm}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <div className="note-list">
        {notes.length === 0 ? (
          <p className="empty-text">No matching notes.</p>
        ) : (
          notes.map((note) => (
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
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteNote(note.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onDeleteNote(note.id);
                    }
                  }}
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
