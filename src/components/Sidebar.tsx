import type { Note } from "../types";
import { PanelLeftClose } from "lucide-react";

type SidebarProps = {
  notes: Note[];
  activeNoteId: string | null;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onCollapse: () => void;
  onSelectNote: (noteId: string) => void;
  onCreateNote: () => void;
  onDeleteNote: (noteId: string) => void;
};

export function Sidebar({
  notes,
  activeNoteId,
  searchTerm,
  onSearchChange,
  onCollapse,
  onSelectNote,
  onCreateNote,
  onDeleteNote
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>Markdown Notes</h1>
        <div className="sidebar-actions">
          <button className="button button-primary" onClick={onCreateNote}>
            New
          </button>
          <button className="button" onClick={onCollapse} aria-label="Collapse sidebar">
            <PanelLeftClose aria-hidden="true" size={18} strokeWidth={2} />
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
                  className="delete-note"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteNote(note.id);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onDeleteNote(note.id);
                    }
                  }}
                >
                  Delete
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
