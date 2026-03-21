import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, MouseEvent, RefObject } from "react";

type MarkdownToolbarProps = {
  content: string;
  onContentChange: (value: string) => void;
  textAreaRef: RefObject<HTMLTextAreaElement | null>;
};

export function MarkdownToolbar({ content, onContentChange, textAreaRef }: MarkdownToolbarProps) {
  const [moreAction, setMoreAction] = useState("");
  const [blockStyle, setBlockStyle] = useState("paragraph");
  const [visibleActionCount, setVisibleActionCount] = useState(0);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const blockSelectRef = useRef<HTMLSelectElement | null>(null);
  const moreSelectMeasureRef = useRef<HTMLSelectElement | null>(null);
  const measureButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [toolbarWidth, setToolbarWidth] = useState(0);

  const applyMarkdown = (nextValue: string, selectionStart: number, selectionEnd: number) => {
    onContentChange(nextValue);

    window.requestAnimationFrame(() => {
      const textarea = textAreaRef.current;
      if (!textarea) {
        return;
      }
      textarea.focus();
      textarea.setSelectionRange(selectionStart, selectionEnd);
    });
  };

  const withSelection = (transform: (selected: string) => {
    text: string;
    selectionStart: number;
    selectionEnd: number;
  }) => {
    const textarea = textAreaRef.current;
    const fullValue = content;
    const start = textarea?.selectionStart ?? fullValue.length;
    const end = textarea?.selectionEnd ?? fullValue.length;
    const selected = fullValue.slice(start, end);
    const before = fullValue.slice(0, start);
    const after = fullValue.slice(end);
    const result = transform(selected);
    applyMarkdown(`${before}${result.text}${after}`, start + result.selectionStart, start + result.selectionEnd);
  };

  const wrapSelection = (prefix: string, suffix: string, fallback: string) => {
    withSelection((selected) => {
      const base = selected || fallback;
      const wrapped = `${prefix}${base}${suffix}`;
      const fallbackStart = prefix.length;
      const fallbackEnd = prefix.length + fallback.length;
      return {
        text: wrapped,
        selectionStart: selected ? wrapped.length : fallbackStart,
        selectionEnd: selected ? wrapped.length : fallbackEnd
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
      return {
        text: next,
        selectionStart: next.length,
        selectionEnd: next.length
      };
    });
  };

  const orderedList = () => {
    withSelection((selected) => {
      const base = selected || "First item\nSecond item\nThird item";
      const next = base
        .split("\n")
        .map((line, index) => `${index + 1}. ${line}`)
        .join("\n");
      return { text: next, selectionStart: next.length, selectionEnd: next.length };
    });
  };

  const primaryActions: Array<{ key: string; label: string; title: string; onClick: () => void }> = [
    { key: "bold", label: "B", title: "Bold", onClick: () => wrapSelection("**", "**", "bold text") },
    { key: "italic", label: "I", title: "Italic", onClick: () => wrapSelection("*", "*", "italicized text") },
    { key: "strike", label: "S", title: "Strikethrough", onClick: () => wrapSelection("~~", "~~", "strikethrough text") },
    { key: "quote", label: ">", title: "Blockquote", onClick: () => prefixLines("> ", "blockquote") },
    { key: "ordered-list", label: "1.", title: "Ordered list", onClick: orderedList },
    { key: "unordered-list", label: "- ", title: "Unordered list", onClick: () => prefixLines("- ", "List item") },
    { key: "task-list", label: "[ ]", title: "Task list", onClick: () => prefixLines("- [ ] ", "Task item") },
    { key: "inline-code", label: "`code`", title: "Inline code", onClick: () => wrapSelection("`", "`", "code") },
    { key: "link", label: "Link", title: "Markdown link", onClick: () => wrapSelection("[", "](https://www.example.com)", "title") },
    {
      key: "table",
      label: "Table",
      title: "Markdown table",
      onClick: () =>
        insertBlock("| Syntax | Description |\n| ----------- | ----------- |\n| Header | Title |\n| Paragraph | Text |")
    }
  ];

  const extraActions: Array<{ key: string; label: string; onClick: () => void }> = [
    { key: "rule", label: "Horizontal rule", onClick: () => insertBlock("---") },
    { key: "code-block", label: "Fenced code block", onClick: () => insertBlock("```\n{\n  \"key\": \"value\"\n}\n```") },
    { key: "image", label: "Image", onClick: () => insertBlock("![alt text](image.jpg)") },
    {
      key: "footnote",
      label: "Footnote",
      onClick: () => insertBlock("Here's a sentence with a footnote. [^1]\n\n[^1]: This is the footnote.")
    },
    { key: "heading-id", label: "Heading with ID", onClick: () => insertBlock("### My Great Heading {#custom-id}") },
    { key: "definition", label: "Definition list", onClick: () => insertBlock("term\n: definition") },
    { key: "emoji", label: "Emoji shortcode", onClick: () => insertBlock(":joy:") },
    { key: "highlight", label: "Highlight", onClick: () => wrapSelection("==", "==", "very important words") },
    { key: "subscript", label: "Subscript", onClick: () => insertBlock("H~2~O") },
    { key: "superscript", label: "Superscript", onClick: () => insertBlock("X^2^") }
  ];

  const hiddenPrimaryActions = primaryActions.slice(visibleActionCount);
  const combinedMoreActions = useMemo(
    () => [
      ...hiddenPrimaryActions.map((action) => ({
        key: `primary-${action.key}`,
        label: action.title,
        onClick: action.onClick
      })),
      ...extraActions.map((action) => ({ key: `extra-${action.key}`, label: action.label, onClick: action.onClick }))
    ],
    [hiddenPrimaryActions]
  );

  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) {
      return;
    }
    const resizeObserver = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? 0;
      setToolbarWidth(nextWidth);
    });
    resizeObserver.observe(toolbar);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const blockWidth = blockSelectRef.current?.offsetWidth ?? 130;
    const moreWidth = moreSelectMeasureRef.current?.offsetWidth ?? 90;
    const itemGap = 4;
    const horizontalPadding = 24;

    const actionWidths = primaryActions.map(
      (action) => measureButtonRefs.current[action.key]?.offsetWidth ?? 50
    );

    const fitCount = (available: number) => {
      if (available <= 0) {
        return 0;
      }
      let consumed = 0;
      let count = 0;
      for (const width of actionWidths) {
        const next = count === 0 ? width : consumed + itemGap + width;
        if (next > available) {
          break;
        }
        consumed = next;
        count += 1;
      }
      return count;
    };

    const fitWithoutMore = fitCount(toolbarWidth - blockWidth - horizontalPadding);
    const nextVisibleCount =
      fitWithoutMore < primaryActions.length
        ? fitCount(toolbarWidth - blockWidth - moreWidth - horizontalPadding - itemGap)
        : fitWithoutMore;

    setVisibleActionCount(Math.max(0, Math.min(primaryActions.length, nextVisibleCount)));
  }, [toolbarWidth]);

  const handleToolbarClick = (event: MouseEvent<HTMLButtonElement>, action: () => void) => {
    event.preventDefault();
    action();
  };

  const handleMoreActionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const selectedKey = event.target.value;
    setMoreAction(selectedKey);
    const selectedAction = combinedMoreActions.find((action) => action.key === selectedKey);
    if (selectedAction) {
      selectedAction.onClick();
    }
    window.requestAnimationFrame(() => setMoreAction(""));
  };

  const handleBlockStyleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const selectedStyle = event.target.value;
    setBlockStyle(selectedStyle);
    if (selectedStyle === "h1") {
      prefixLines("# ", "Heading");
      return;
    }
    if (selectedStyle === "h2") {
      prefixLines("## ", "Heading");
      return;
    }
    if (selectedStyle === "h3") {
      prefixLines("### ", "Heading");
    }
  };

  return (
    <div
      ref={toolbarRef}
      className="markdown-toolbar"
      role="toolbar"
      aria-label="Markdown formatting toolbar"
    >
      <select
        ref={blockSelectRef}
        className="markdown-toolbar-select markdown-toolbar-select-block"
        aria-label="Block style"
        value={blockStyle}
        onChange={handleBlockStyleChange}
      >
        <option value="paragraph">Paragraph</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="h3">Heading 3</option>
      </select>
      <div className="markdown-toolbar-actions">
        {primaryActions.slice(0, visibleActionCount).map((action) => (
          <button
            key={action.key}
            type="button"
            className="button markdown-toolbar-button"
            title={action.title}
            aria-label={action.title}
            onMouseDown={(event) => handleToolbarClick(event, action.onClick)}
          >
            {action.label === "I" ? <em>I</em> : action.label}
          </button>
        ))}
      </div>
      {combinedMoreActions.length > 0 ? (
        <select
          className="markdown-toolbar-select"
          aria-label="More markdown actions"
          value={moreAction}
          onChange={handleMoreActionChange}
        >
          <option value="">More</option>
          {combinedMoreActions.map((action) => (
            <option key={action.key} value={action.key}>
              {action.label}
            </option>
          ))}
        </select>
      ) : null}
      <div className="markdown-toolbar-measure" aria-hidden="true">
        {primaryActions.map((action) => (
          <button
            key={`measure-${action.key}`}
            ref={(element) => {
              measureButtonRefs.current[action.key] = element;
            }}
            type="button"
            className="button markdown-toolbar-button"
          >
            {action.label}
          </button>
        ))}
        <select ref={moreSelectMeasureRef} className="markdown-toolbar-select">
          <option>More</option>
        </select>
      </div>
    </div>
  );
}
