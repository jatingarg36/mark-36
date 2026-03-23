import { useEffect } from "react";
import type { RefObject, UIEventHandler } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { Experiments, isEnabled } from "../config/experiments";
import { MarkdownToolbar } from "./MarkdownToolbar";

type EditorPaneProps = {
  title: string;
  content: string;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  isSaving: boolean;
  updatedAt?: string;
  textAreaRef: RefObject<HTMLTextAreaElement | null>;
  onEditorScroll: UIEventHandler<HTMLTextAreaElement>;
  fontSize: number;
  noteSearchQuery?: string;
  noteSearchMatchIndex?: number;
};

export function EditorPane({
  title,
  content,
  onTitleChange,
  onContentChange,
  isSaving,
  updatedAt,
  textAreaRef,
  onEditorScroll,
  fontSize,
  noteSearchQuery = "",
  noteSearchMatchIndex = 0,
}: EditorPaneProps) {
  useEffect(() => {
    const textarea = textAreaRef.current;
    if (!textarea || !noteSearchQuery.trim()) return;
    const lower = content.toLowerCase();
    const q = noteSearchQuery.toLowerCase();
    let count = 0;
    let idx = lower.indexOf(q);
    while (idx !== -1) {
      if (count === noteSearchMatchIndex) {
        textarea.setSelectionRange(idx, idx + q.length);
        // Scroll the match into the visible area of the textarea
        const linesBefore = content.slice(0, idx).split("\n").length - 1;
        const lineHeight = fontSize * 1.6;
        textarea.scrollTop = Math.max(0, linesBefore * lineHeight - textarea.clientHeight / 2);
        return;
      }
      count++;
      idx = lower.indexOf(q, idx + 1);
    }
  }, [noteSearchQuery, noteSearchMatchIndex, content, fontSize]);

  const lastUpdatedLabel = updatedAt
    ? new Date(updatedAt).toLocaleString()
    : "Not saved yet";

  return (
    <section className="editor-pane">
      <div className="editor-header">
        <input
          className="title-input"
          value={title}
          placeholder="Untitled note"
          onChange={(event) => onTitleChange(event.target.value)}
        />
        <span className="editor-meta">
          {isSaving ? "Saving…" : lastUpdatedLabel}
        </span>
      </div>
      <MarkdownToolbar
        content={content}
        textAreaRef={textAreaRef}
      />
      {isEnabled(Experiments.EDITOR_UPGRADE) ? (
        <div 
          className="markdown-input codemirror-wrapper" 
          style={{ fontSize: `${fontSize}px`, overflow: "auto" }}
          onScroll={onEditorScroll as any}
        >
          <CodeMirror
            value={content}
            height="100%"
            extensions={[markdown({ base: markdownLanguage })]}
            onChange={(val) => onContentChange(val)}
          />
        </div>
      ) : (
        <textarea
          ref={textAreaRef}
          className="markdown-input"
          value={content}
          placeholder="Write your markdown..."
          onChange={(event) => onContentChange(event.target.value)}
          onScroll={onEditorScroll}
          style={{ fontSize: `${fontSize}px` }}
        />
      )}
    </section>
  );
}
