import { describe, it, expect } from "vitest";
import { renderMarkdown } from "../src/preview/markdownRenderer";

describe("renderMarkdown", () => {
  // ── existing tests ──────────────────────────────────────────────────────────

  it("renders fenced code blocks with a language class", () => {
    const html = renderMarkdown("```javascript\nconst x = 1;\n```");

    expect(html).toContain('class="hljs language-javascript"');
    expect(html).toContain('class="hljs-keyword">const');
    expect(html).toContain('class="hljs-number">1');
  });

  it("does not render raw HTML (html: false)", () => {
    const html = renderMarkdown("<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("</script>");
  });

  // ── headings ─────────────────────────────────────────────────────────────────

  it("renders h1 through h3 headings", () => {
    expect(renderMarkdown("# Heading 1")).toContain("<h1>");
    expect(renderMarkdown("## Heading 2")).toContain("<h2>");
    expect(renderMarkdown("### Heading 3")).toContain("<h3>");
  });

  // ── emphasis ─────────────────────────────────────────────────────────────────

  it("renders bold text as <strong>", () => {
    const html = renderMarkdown("**bold**");
    expect(html).toContain("<strong>bold</strong>");
  });

  it("renders italic text as <em>", () => {
    const html = renderMarkdown("_italic_");
    expect(html).toContain("<em>italic</em>");
  });

  it("renders bold-italic combined", () => {
    const html = renderMarkdown("**_both_**");
    expect(html).toContain("<strong>");
    expect(html).toContain("<em>");
  });

  // ── inline code ───────────────────────────────────────────────────────────────

  it("renders inline code as <code>", () => {
    const html = renderMarkdown("Use `console.log()` to debug.");
    expect(html).toContain("<code>");
    expect(html).toContain("console.log()");
  });

  // ── links ─────────────────────────────────────────────────────────────────────

  it("renders external links as <a href=…>", () => {
    const html = renderMarkdown("[Example](https://example.com)");
    expect(html).toContain('<a href="https://example.com"');
    expect(html).toContain("Example</a>");
  });

  it("auto-links bare URLs (linkify: true)", () => {
    const html = renderMarkdown("Visit https://example.com today.");
    expect(html).toContain('href="https://example.com"');
  });

  // ── lists ─────────────────────────────────────────────────────────────────────

  it("renders unordered lists as <ul><li>", () => {
    const html = renderMarkdown("- one\n- two\n- three");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>one</li>");
    expect(html).toContain("<li>two</li>");
  });

  it("renders ordered lists as <ol><li>", () => {
    const html = renderMarkdown("1. first\n2. second");
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>first</li>");
    expect(html).toContain("<li>second</li>");
  });

  // ── horizontal rule ───────────────────────────────────────────────────────────

  it("renders horizontal rules as <hr>", () => {
    const html = renderMarkdown("---");
    expect(html).toContain("<hr");
  });

  // ── typographer ───────────────────────────────────────────────────────────────

  it("converts straight double quotes to curly quotes (typographer: true)", () => {
    const html = renderMarkdown('"Hello"');
    // markdown-it typographer replaces "…" with &ldquo;/&rdquo; or the unicode chars
    expect(html).not.toContain('"Hello"');
  });

  // ── task lists (extended markdown) ────────────────────────────────────────────

  it("renders GFM task-list checkboxes", () => {
    const html = renderMarkdown("- [x] Done\n- [ ] Pending");
    // markdown-it-task-lists produces <input type="checkbox"> elements
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("Done");
    expect(html).toContain("Pending");
  });

  // ── blockquote ────────────────────────────────────────────────────────────────

  it("renders blockquotes as <blockquote>", () => {
    const html = renderMarkdown("> This is a quote.");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("This is a quote.");
  });

  // ── unknown language code block falls back to auto-highlight ─────────────────

  it("falls back to auto-highlight for unknown language", () => {
    const html = renderMarkdown('```unknownlang\nhello world\n```');
    expect(html).toContain('class="hljs"');
  });
});
