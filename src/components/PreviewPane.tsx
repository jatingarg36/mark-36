import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject, UIEventHandler } from "react";
import { Check, Copy, List } from "lucide-react";

type PreviewPaneProps = {
  html: string;
  canCopy: boolean;
  previewContentRef: RefObject<HTMLDivElement | null>;
  onPreviewScroll: UIEventHandler<HTMLDivElement>;
  fontSize: number;
  noteSearchQuery?: string;
  noteSearchMatchIndex?: number;
};

function walkAndHighlight(node: Node, query: string): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    const lower = text.toLowerCase();
    if (!lower.includes(query)) return;
    const parent = node.parentNode;
    if (!parent || parent.nodeName === "MARK") return;
    const frag = document.createDocumentFragment();
    let last = 0;
    let i: number;
    while ((i = lower.indexOf(query, last)) !== -1) {
      if (i > last) frag.appendChild(document.createTextNode(text.slice(last, i)));
      const mark = document.createElement("mark");
      mark.className = "search-highlight";
      mark.textContent = text.slice(i, i + query.length);
      frag.appendChild(mark);
      last = i + query.length;
    }
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    parent.replaceChild(frag, node);
    return;
  }
  if (["SCRIPT", "STYLE", "MARK", "CODE", "PRE"].includes(node.nodeName)) {
    // still highlight inside code blocks
    if (node.nodeName === "CODE" || node.nodeName === "PRE") {
      for (const child of Array.from(node.childNodes)) walkAndHighlight(child, query);
    }
    return;
  }
  for (const child of Array.from(node.childNodes)) walkAndHighlight(child, query);
}

function buildHighlightedHtml(html: string, query: string): string {
  if (!query.trim()) return html;
  const div = document.createElement("div");
  div.innerHTML = html;
  walkAndHighlight(div, query.toLowerCase());
  return div.innerHTML;
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function getTextWithLineBreaks(element: Element): string {
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll("br").forEach((br) => {
    br.replaceWith("\n");
  });
  return clone.textContent ?? "";
}

function extractListLines(
  list: HTMLOListElement | HTMLUListElement,
  depth: number,
  output: string[]
): void {
  const isOrdered = list.tagName.toLowerCase() === "ol";
  const startAttr = Number(list.getAttribute("start"));
  const start = Number.isFinite(startAttr) && startAttr > 0 ? startAttr : 1;
  let orderedIndex = start;

  const items = Array.from(list.children).filter(
    (child): child is HTMLLIElement => child.tagName.toLowerCase() === "li"
  );

  items.forEach((item) => {
    const nestedLists = Array.from(item.children).filter((child) => {
      const tag = child.tagName.toLowerCase();
      return tag === "ul" || tag === "ol";
    }) as Array<HTMLOListElement | HTMLUListElement>;

    const lineClone = item.cloneNode(true) as HTMLLIElement;
    lineClone.querySelectorAll("ul, ol").forEach((childList) => childList.remove());
    const baseText = normalizeSpaces(getTextWithLineBreaks(lineClone));
    const marker = isOrdered ? `${orderedIndex}.` : "-";
    const indent = "  ".repeat(depth);

    if (baseText) {
      output.push(`${indent}${marker} ${baseText}`);
    } else {
      output.push(`${indent}${marker}`);
    }

    orderedIndex += 1;
    nestedLists.forEach((nestedList) => extractListLines(nestedList, depth + 1, output));
  });
}

function extractPreviewText(root: HTMLElement): string {
  const lines: string[] = [];

  const children = Array.from(root.children);
  children.forEach((child) => {
    const tag = child.tagName.toLowerCase();

    if (tag === "ul" || tag === "ol") {
      extractListLines(child as HTMLOListElement | HTMLUListElement, 0, lines);
      lines.push("");
      return;
    }

    const text = normalizeSpaces(getTextWithLineBreaks(child));
    if (text) {
      lines.push(text);
      lines.push("");
    }
  });

  return lines.join("\n").trim();
}

export function PreviewPane({ html, canCopy, previewContentRef, onPreviewScroll, fontSize, noteSearchQuery = "", noteSearchMatchIndex = 0 }: PreviewPaneProps) {
  const [copied, setCopied] = useState(false);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const tocRef = useRef<HTMLDivElement | null>(null);

  const highlightedHtml = useMemo(
    () => buildHighlightedHtml(html, noteSearchQuery),
    [html, noteSearchQuery]
  );

  // Mark the active search match and scroll it into view
  useEffect(() => {
    const el = previewContentRef.current;
    if (!el) return;
    const marks = el.querySelectorAll<HTMLElement>(".search-highlight");
    marks.forEach((m, i) => {
      m.classList.toggle("search-highlight--active", i === noteSearchMatchIndex);
    });
    marks[noteSearchMatchIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightedHtml, noteSearchMatchIndex]);

  useEffect(() => {
    if (!isTocOpen) return;
    const handleOutside = (e: Event) => {
      if (tocRef.current && !tocRef.current.contains(e.target as Node)) {
        setIsTocOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isTocOpen]);

  const headings = useMemo(() => {
    const div = document.createElement("div");
    div.innerHTML = html;
    return Array.from(div.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((h) => ({
      level: parseInt(h.tagName[1]),
      text: h.textContent ?? "",
      id: h.id,
    }));
  }, [html]);

  const handleTocItemClick = (id: string, text: string) => {
    const el = previewContentRef.current;
    if (!el) return;
    const target = id
      ? el.querySelector(`#${CSS.escape(id)}`)
      : Array.from(el.querySelectorAll("h1,h2,h3,h4,h5,h6")).find(
          (h) => h.textContent === text
        );
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    setIsTocOpen(false);
  };

  const handleCopyPreviewText = async () => {
    const previewElement = previewContentRef.current;
    const previewText = previewElement ? extractPreviewText(previewElement) : "";
    if (!previewText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(previewText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Copy failed", error);
    }
  };

  return (
    <section className="preview-pane">
      {canCopy ? (
        <div className="preview-actions">
          {headings.length > 0 && (
            <div ref={tocRef} className="preview-toc-container">
              <button
                className="button topbar-icon-btn"
                onClick={() => setIsTocOpen((v) => !v)}
                title="Table of contents"
                aria-label="Table of contents"
                aria-expanded={isTocOpen}
              >
                <List aria-hidden="true" size={20} strokeWidth={2} />
              </button>
              {isTocOpen && (
                <div className="toc-panel" role="navigation" aria-label="Table of contents">
                  <div className="toc-panel-header">Contents</div>
                  {headings.map((h, i) => (
                    <button
                      key={i}
                      className="toc-item"
                      style={{ paddingLeft: `${(h.level - 1) * 12 + 10}px` }}
                      onClick={() => handleTocItemClick(h.id, h.text)}
                      title={h.text}
                    >
                      {h.text}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            className="button topbar-icon-btn"
            onClick={handleCopyPreviewText}
            title={copied ? "Copied" : "Copy preview text"}
            aria-label={copied ? "Preview text copied" : "Copy preview text"}
          >
            {copied ? (
              <Check aria-hidden="true" size={20} strokeWidth={2} />
            ) : (
              <Copy aria-hidden="true" size={20} strokeWidth={2} />
            )}
          </button>
        </div>
      ) : null}
      <div
        ref={previewContentRef}
        className="preview-content"
        onScroll={onPreviewScroll}
        style={{ fontSize: `${fontSize}px` }}
        dangerouslySetInnerHTML={{ __html: highlightedHtml }}
      />
    </section>
  );
}
