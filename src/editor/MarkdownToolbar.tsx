import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, RefObject } from "react";

type MarkdownToolbarProps = {
  content: string;
  textAreaRef: RefObject<HTMLTextAreaElement | null>;
};

type Action = { key: string; label: string; title: string; onClick: () => void };

export function MarkdownToolbar({ content, textAreaRef }: MarkdownToolbarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [isCollapsing, setIsCollapsing] = useState(false);
  const [blockStyle, setBlockStyle] = useState("paragraph");
  const [isBlockOpen, setIsBlockOpen] = useState(false);
  const [visibleActionCount, setVisibleActionCount] = useState(0);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const blockMenuRef = useRef<HTMLDivElement | null>(null);
  const blockBtnMeasureRef = useRef<HTMLButtonElement | null>(null);
  const moreContainerRef = useRef<HTMLDivElement | null>(null);
  const moreBtnMeasureRef = useRef<HTMLButtonElement | null>(null);
  const measureButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [toolbarWidth, setToolbarWidth] = useState(0);

  // Use setRangeText so the browser records a native undo entry.
  // After mutating the DOM we dispatch an 'input' event so React's onChange
  // picks up the new value. React then sees textarea.value already matches
  // the new state and skips the DOM write, leaving the undo stack intact.
  const applyChange = (
    start: number,
    end: number,
    replacement: string,
    newSelectionStart: number,
    newSelectionEnd: number
  ) => {
    const textarea = textAreaRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setRangeText(replacement, start, end, "preserve");
    textarea.setSelectionRange(newSelectionStart, newSelectionEnd);
    textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
  };

  const withSelection = (
    transform: (selected: string) => { text: string; selectionStart: number; selectionEnd: number }
  ) => {
    const textarea = textAreaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end);
    const result = transform(selected);
    applyChange(start, end, result.text, start + result.selectionStart, start + result.selectionEnd);
  };

  const wrapSelection = (prefix: string, suffix: string, fallback: string) => {
    withSelection((selected) => {
      // Toggle: unwrap if selection is already wrapped with these markers
      if (
        selected.length > prefix.length + suffix.length &&
        selected.startsWith(prefix) &&
        selected.endsWith(suffix)
      ) {
        const unwrapped = selected.slice(prefix.length, selected.length - suffix.length);
        return { text: unwrapped, selectionStart: 0, selectionEnd: unwrapped.length };
      }
      const base = selected || fallback;
      const wrapped = `${prefix}${base}${suffix}`;
      return {
        text: wrapped,
        selectionStart: selected ? 0 : prefix.length,
        selectionEnd: selected ? wrapped.length : prefix.length + fallback.length,
      };
    });
  };

  const insertBlock = (snippet: string, placeCursorAtEnd = true) => {
    withSelection((selected) => {
      const text = selected ? `${selected}\n${snippet}` : snippet;
      const cursor = placeCursorAtEnd ? text.length : 0;
      return { text, selectionStart: cursor, selectionEnd: cursor };
    });
  };

  const prefixLines = (prefix: string, fallbackLine: string) => {
    withSelection((selected) => {
      const base = selected || fallbackLine;
      const lines = base.split("\n");
      const next = lines.map((line) => `${prefix}${line}`).join("\n");
      return { text: next, selectionStart: next.length, selectionEnd: next.length };
    });
  };

  const orderedList = () => {
    withSelection((selected) => {
      const base = selected || "First item\nSecond item\nThird item";
      const next = base
        .split("\n")
        .map((line, i) => `${i + 1}. ${line}`)
        .join("\n");
      return { text: next, selectionStart: next.length, selectionEnd: next.length };
    });
  };

  const isValidJson = useMemo(() => {
    const trimmed = content.trim();
    if (!trimmed) return false;
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  }, [content]);

  const formatJson = () => {
    const textarea = textAreaRef.current;
    if (!textarea) return;
    try {
      const parsed = JSON.parse(textarea.value.trim());
      const formatted = JSON.stringify(parsed, null, 2);
      applyChange(0, textarea.value.length, formatted, 0, formatted.length);
    } catch {
      // not valid JSON
    }
  };

  // Format JSON appears at the end of primary actions only when content is valid JSON.
  // This way it participates in the overflow system naturally instead of sitting orphaned
  // outside the actions container.
  const primaryActions: Action[] = [
    { key: "bold", label: "B", title: "Bold", onClick: () => wrapSelection("**", "**", "bold text") },
    { key: "italic", label: "I", title: "Italic", onClick: () => wrapSelection("*", "*", "italicized text") },
    { key: "strike", label: "S", title: "Strikethrough", onClick: () => wrapSelection("~~", "~~", "strikethrough text") },
    { key: "quote", label: ">", title: "Blockquote", onClick: () => prefixLines("> ", "blockquote") },
    { key: "ordered-list", label: "1.", title: "Ordered list", onClick: orderedList },
    { key: "unordered-list", label: "-", title: "Unordered list", onClick: () => prefixLines("- ", "List item") },
    { key: "task-list", label: "[ ]", title: "Task list", onClick: () => prefixLines("- [ ] ", "Task item") },
    { key: "inline-code", label: "`c`", title: "Inline code", onClick: () => wrapSelection("`", "`", "code") },
    { key: "link", label: "Link", title: "Link", onClick: () => wrapSelection("[", "](https://www.example.com)", "title") },
    {
      key: "table",
      label: "Table",
      title: "Table",
      onClick: () =>
        insertBlock("| Syntax | Description |\n| ----------- | ----------- |\n| Header | Title |\n| Paragraph | Text |"),
    },
    ...(isValidJson
      ? [{ key: "format-json", label: "{ }", title: "Format JSON", onClick: formatJson }]
      : []),
  ];

  const extraActions: Array<{ key: string; label: string; onClick: () => void }> = [
    { key: "rule", label: "Horizontal rule", onClick: () => insertBlock("---") },
    { key: "code-block", label: "Fenced code block", onClick: () => insertBlock("```\n{\n  \"key\": \"value\"\n}\n```") },
    { key: "image", label: "Image", onClick: () => insertBlock("![alt text](image.jpg)") },
    {
      key: "footnote",
      label: "Footnote",
      onClick: () => insertBlock("Here's a sentence with a footnote. [^1]\n\n[^1]: This is the footnote."),
    },
    { key: "heading-id", label: "Heading with ID", onClick: () => insertBlock("### My Great Heading {#custom-id}") },
    { key: "definition", label: "Definition list", onClick: () => insertBlock("term\n: definition") },
    { key: "emoji", label: "Emoji shortcode", onClick: () => insertBlock(":joy:") },
    { key: "highlight", label: "Highlight", onClick: () => wrapSelection("==", "==", "very important words") },
    { key: "subscript", label: "Subscript", onClick: () => insertBlock("H~2~O") },
    { key: "superscript", label: "Superscript", onClick: () => insertBlock("X^2^") },
  ];

  const hiddenPrimaryActions = primaryActions.slice(visibleActionCount);

  // Recompute when either the number of visible items or JSON status changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const combinedMoreActions = useMemo(
    () => [
      ...hiddenPrimaryActions.map((a) => ({ key: `primary-${a.key}`, label: a.title, onClick: a.onClick })),
      ...extraActions.map((a) => ({ key: `extra-${a.key}`, label: a.label, onClick: a.onClick })),
    ],
    [visibleActionCount, isValidJson]
  );

  // Close block dropdown on click outside
  useEffect(() => {
    if (!isBlockOpen) return;
    const handleOutside = (e: Event) => {
      if (blockMenuRef.current && !blockMenuRef.current.contains(e.target as Node)) {
        setIsBlockOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isBlockOpen]);

  useEffect(() => {
    if (!isBlockOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsBlockOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isBlockOpen]);

  // Observe the editor pane (parent) width so the toolbar reacts to pane resizes.
  // The toolbar is absolutely positioned so its own width won't shrink until items overflow;
  // watching the parent gives us the true available space immediately.
  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    const pane = toolbar.parentElement;
    if (!pane) return;
    const ro = new ResizeObserver((entries) => {
      // Subtract the toolbar's left+right margin (16px each side = 32px)
      const paneWidth = entries[0]?.contentRect.width ?? 0;
      setToolbarWidth(Math.max(0, paneWidth - 32));
    });
    ro.observe(pane);
    return () => ro.disconnect();
  }, []);

  // Recalculate how many primary action buttons fit in the available space.
  // Runs whenever the toolbar resizes or the action set changes (JSON toggle).
  useEffect(() => {
    const blockWidth = blockBtnMeasureRef.current?.offsetWidth ?? 52;
    const moreWidth = moreBtnMeasureRef.current?.offsetWidth ?? 50;
    // gap: 8px between top-level toolbar flex children
    const toolbarGap = 8;
    // gap: 4px between buttons inside the actions container
    const actionGap = 4;
    // padding: 4px 6px → 12px horizontal + one gap after block select
    const overhead = 12 + toolbarGap;

    const actionWidths = primaryActions.map(
      (action) => measureButtonRefs.current[action.key]?.offsetWidth ?? 50
    );

    const fitCount = (available: number) => {
      if (available <= 0) return 0;
      let consumed = 0;
      let count = 0;
      for (const w of actionWidths) {
        const next = count === 0 ? w : consumed + actionGap + w;
        if (next > available) break;
        consumed = next;
        count++;
      }
      return count;
    };

    const fitWithoutMore = fitCount(toolbarWidth - blockWidth - overhead);
    const nextVisibleCount =
      fitWithoutMore < primaryActions.length
        ? fitCount(toolbarWidth - blockWidth - moreWidth - overhead - toolbarGap)
        : fitWithoutMore;

    setVisibleActionCount(Math.max(0, Math.min(primaryActions.length, nextVisibleCount)));
  }, [toolbarWidth, isValidJson]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!isMoreOpen) return;
    const handleOutside = (e: Event) => {
      if (moreContainerRef.current && !moreContainerRef.current.contains(e.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isMoreOpen]);

  // Close dropdown on Escape
  useEffect(() => {
    if (!isMoreOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMoreOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isMoreOpen]);

  const handleToolbarMouseDown = (event: MouseEvent<HTMLButtonElement>, action: () => void) => {
    event.preventDefault();
    action();
  };

  const applyBlockStyle = (value: string) => {
    if (value === "h1") prefixLines("# ", "Heading");
    else if (value === "h2") prefixLines("## ", "Heading");
    else if (value === "h3") prefixLines("### ", "Heading");
    window.requestAnimationFrame(() => setBlockStyle("paragraph"));
    setIsBlockOpen(false);
  };

  const blockLabel = blockStyle === "paragraph" ? "Aa" : blockStyle.toUpperCase();

  const hasMoreItems = combinedMoreActions.length > 0;
  const overflowedPrimaryCount = hiddenPrimaryActions.length;

  if (collapsed) {
    return (
      <button
        type="button"
        className="button markdown-toolbar-expand-btn"
        title="Show toolbar"
        aria-label="Show formatting toolbar"
        onClick={() => setCollapsed(false)}
      >
        ✦
      </button>
    );
  }

  return (
    <div ref={toolbarRef} className={`markdown-toolbar${isCollapsing ? " markdown-toolbar--collapsing" : ""}`} role="toolbar" aria-label="Markdown formatting toolbar">
      {/* Block style button */}
      <div ref={blockMenuRef} className="markdown-toolbar-block-container">
        <button
          type="button"
          className="button markdown-toolbar-button markdown-toolbar-block-btn"
          aria-label="Block style"
          aria-expanded={isBlockOpen}
          aria-haspopup="menu"
          onMouseDown={(e) => {
            e.preventDefault();
            setIsBlockOpen((v) => !v);
          }}
        >
          {blockLabel}
        </button>
        {isBlockOpen && (
          <div className="markdown-toolbar-block-dropdown" role="menu">
            {[
              { value: "paragraph", label: "Paragraph" },
              { value: "h1", label: "Heading 1" },
              { value: "h2", label: "Heading 2" },
              { value: "h3", label: "Heading 3" },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="menuitem"
                className="markdown-toolbar-dropdown-item"
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyBlockStyle(opt.value);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="markdown-toolbar-actions">
        {primaryActions.slice(0, visibleActionCount).map((action) => (
          <button
            key={action.key}
            type="button"
            className="button markdown-toolbar-button"
            title={action.title}
            aria-label={action.title}
            onMouseDown={(e) => handleToolbarMouseDown(e, action.onClick)}
          >
            {action.key === "italic" ? <em>I</em> : action.label}
          </button>
        ))}
      </div>

      {hasMoreItems ? (
        <div ref={moreContainerRef} className="markdown-toolbar-more-container">
          <button
            type="button"
            className="button markdown-toolbar-button markdown-toolbar-more-btn"
            aria-label="More formatting options"
            aria-expanded={isMoreOpen}
            aria-haspopup="menu"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsMoreOpen((v) => !v);
            }}
          >
            ···
          </button>
          {isMoreOpen && (
            <div className="markdown-toolbar-dropdown" role="menu">
              {overflowedPrimaryCount > 0 && (
                <div className="markdown-toolbar-dropdown-section">
                  {hiddenPrimaryActions.map((action) => (
                    <button
                      key={`primary-${action.key}`}
                      type="button"
                      role="menuitem"
                      className="markdown-toolbar-dropdown-item"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        action.onClick();
                        setIsMoreOpen(false);
                      }}
                    >
                      {action.title}
                    </button>
                  ))}
                </div>
              )}
              {overflowedPrimaryCount > 0 && <div className="markdown-toolbar-dropdown-divider" />}
              <div className="markdown-toolbar-dropdown-section">
                {extraActions.map((action) => (
                  <button
                    key={`extra-${action.key}`}
                    type="button"
                    role="menuitem"
                    className="markdown-toolbar-dropdown-item"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      action.onClick();
                      setIsMoreOpen(false);
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Collapse button */}
      <div className="markdown-toolbar-collapse-divider" aria-hidden="true" />
      <button
        type="button"
        className="button markdown-toolbar-button markdown-toolbar-collapse-btn"
        title="Hide toolbar"
        aria-label="Hide formatting toolbar"
        onMouseDown={(e) => {
          e.preventDefault();
          setIsCollapsing(true);
          window.setTimeout(() => {
            setCollapsed(true);
            setIsCollapsing(false);
          }, 180);
        }}
      >
        ↓
      </button>

      {/* Hidden measurement layer */}
      <div className="markdown-toolbar-measure" aria-hidden="true">
        <button ref={blockBtnMeasureRef} type="button" className="button markdown-toolbar-button markdown-toolbar-block-btn">
          Aa
        </button>
        {[
          ...primaryActions.filter((a) => a.key !== "format-json"),
          { key: "format-json", label: "{ }", title: "Format JSON", onClick: () => {} },
        ].map((action) => (
          <button
            key={`measure-${action.key}`}
            ref={(el) => { measureButtonRefs.current[action.key] = el; }}
            type="button"
            className="button markdown-toolbar-button"
          >
            {action.label}
          </button>
        ))}
        <button ref={moreBtnMeasureRef} type="button" className="button markdown-toolbar-button">
          ···
        </button>
      </div>
    </div>
  );
}
