import { describe, it, expect } from "vitest";
import { renderMarkdown } from "../src/preview/markdownRenderer";

describe("renderMarkdown", () => {
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
});

