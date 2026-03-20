import { useState } from "react";
import type { RefObject, UIEventHandler } from "react";
import { Check, Copy } from "lucide-react";

type PreviewPaneProps = {
  html: string;
  canCopy: boolean;
  previewContentRef: RefObject<HTMLDivElement | null>;
  onPreviewScroll: UIEventHandler<HTMLDivElement>;
};

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

export function PreviewPane({ html, canCopy, previewContentRef, onPreviewScroll }: PreviewPaneProps) {
  const [copied, setCopied] = useState(false);

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
        <button
          className="preview-copy-button"
          onClick={handleCopyPreviewText}
          title={copied ? "Copied" : "Copy preview text"}
          aria-label={copied ? "Preview text copied" : "Copy preview text"}
        >
          {copied ? (
            <Check aria-hidden="true" size={18} strokeWidth={2} />
          ) : (
            <Copy aria-hidden="true" size={18} strokeWidth={2} />
          )}
        </button>
      ) : null}
      <div
        ref={previewContentRef}
        className="preview-content"
        onScroll={onPreviewScroll}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  );
}
