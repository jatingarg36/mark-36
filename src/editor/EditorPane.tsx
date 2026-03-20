import type { RefObject, UIEventHandler } from "react";

type EditorPaneProps = {
  title: string;
  content: string;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  isSaving: boolean;
  updatedAt?: string;
  textAreaRef: RefObject<HTMLTextAreaElement | null>;
  onEditorScroll: UIEventHandler<HTMLTextAreaElement>;
};

export function EditorPane({
  title,
  content,
  onTitleChange,
  onContentChange,
  isSaving,
  updatedAt,
  textAreaRef,
  onEditorScroll
}: EditorPaneProps) {
  const lastUpdatedLabel = updatedAt
    ? new Date(updatedAt).toLocaleString()
    : "Not saved yet";

  return (
    <section className="editor-pane">
      <div className="editor-meta">
        <span>{isSaving ? "Saving..." : `Last saved: ${lastUpdatedLabel}`}</span>
      </div>
      <input
        className="title-input"
        value={title}
        placeholder="Untitled note"
        onChange={(event) => onTitleChange(event.target.value)}
      />
      <textarea
        ref={textAreaRef}
        className="markdown-input"
        value={content}
        placeholder="Write your markdown..."
        onChange={(event) => onContentChange(event.target.value)}
        onScroll={onEditorScroll}
      />
    </section>
  );
}
