import { useEffect, useRef } from "react";
import { X, ChevronUp, ChevronDown } from "lucide-react";

type NoteSearchProps = {
  query: string;
  onQueryChange: (q: string) => void;
  matchIndex: number;
  matchCount: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
};

export function NoteSearch({
  query,
  onQueryChange,
  matchIndex,
  matchCount,
  onPrev,
  onNext,
  onClose,
}: NoteSearchProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div className="note-search" role="search">
      <input
        ref={inputRef}
        className="note-search-input"
        placeholder="Search in note…"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          else if (e.key === "Enter") e.shiftKey ? onPrev() : onNext();
        }}
        aria-label="Search in note"
      />
      <span className={`note-search-count ${query && matchCount === 0 ? "note-search-count--none" : ""}`}>
        {query
          ? matchCount === 0
            ? "No results"
            : `${matchIndex + 1} / ${matchCount}`
          : ""}
      </span>
      <div className="note-search-nav">
        <button
          className="button note-search-btn"
          onClick={onPrev}
          disabled={matchCount === 0}
          title="Previous match (Shift+Enter)"
          aria-label="Previous match"
        >
          <ChevronUp size={14} strokeWidth={2.5} />
        </button>
        <button
          className="button note-search-btn"
          onClick={onNext}
          disabled={matchCount === 0}
          title="Next match (Enter)"
          aria-label="Next match"
        >
          <ChevronDown size={14} strokeWidth={2.5} />
        </button>
      </div>
      <button
        className="button note-search-btn note-search-close"
        onClick={onClose}
        title="Close (Esc)"
        aria-label="Close search"
      >
        <X size={14} strokeWidth={2.5} />
      </button>
    </div>
  );
}
