import MarkdownIt from "markdown-it";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import go from "highlight.js/lib/languages/go";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdownLang from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";

import taskLists from "markdown-it-task-lists";
import mk from "markdown-it-texmath";
import katex from "katex";
import { Experiments, isEnabled } from "../config/experiments";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("css", css);
hljs.registerLanguage("go", go);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("markdown", markdownLang);
hljs.registerLanguage("md", markdownLang);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);

// Base parser configuration
import type MarkdownItType from "markdown-it";

const parser: MarkdownItType = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight(code: string, language: string): string {
    if (isEnabled(Experiments.EXTENDED_MARKDOWN) && language === "mermaid") {
      const escaped = parser.utils.escapeHtml(code);
      return `<pre class="mermaid" data-code="${escaped}">${escaped}</pre>`;
    }
    if (language && hljs.getLanguage(language)) {
      return `<pre><code class="hljs language-${language}">${hljs.highlight(code, {
        language
      }).value}</code></pre>`;
    }
    return `<pre><code class="hljs">${hljs.highlightAuto(code).value}</code></pre>`;
  }
});

if (isEnabled(Experiments.EXTENDED_MARKDOWN)) {
  parser.use(taskLists, { enabled: true });
  parser.use(mk, {
    engine: katex,
    delimiters: 'dollars'
  });
}

// Support exact active-line mapping by injecting data-line attrs into block tokens
import type { PluginSimple } from "markdown-it";

if (isEnabled(Experiments.SCROLL_SYNC_POLISH)) {
  const injectLineNumbers: PluginSimple = (md: MarkdownItType) => {
    md.core.ruler.push('inject_line_numbers', (state: any) => {
      state.tokens.forEach((token: any) => {
        if (token.map && token.level === 0) {
          token.attrJoin('class', 'line');
          token.attrSet('data-line', String(token.map[0] + 1));
        }
      });
    });
  };
  parser.use(injectLineNumbers);
}

export function renderMarkdown(source: string): string {
  return parser.render(source);
}
