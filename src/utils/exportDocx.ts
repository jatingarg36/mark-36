import MarkdownIt from "markdown-it";
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  TextRun,
  convertInchesToTwip,
} from "docx";

const parser = new MarkdownIt({ html: false, linkify: true, typographer: true });

// Mirrors the markdown-it Token shape we need without importing their module path
interface MdToken {
  type: string;
  tag: string;
  content: string;
  children: MdToken[] | null;
  attrGet(name: string): string | null;
  level: number;
}

type ParagraphChild = TextRun | ExternalHyperlink;

function makeTextRun(text: string, bold: boolean, italic: boolean): TextRun {
  return new TextRun({
    text,
    ...(bold && { bold: true }),
    ...(italic && { italics: true }),
  });
}

function convertInlineTokens(tokens: MdToken[]): ParagraphChild[] {
  const result: ParagraphChild[] = [];
  let bold = false;
  let italic = false;
  let inLink = false;
  let linkHref = "";
  const linkBuffer: TextRun[] = [];

  const pushRun = (run: TextRun) => {
    if (inLink) linkBuffer.push(run);
    else result.push(run);
  };

  for (const token of tokens) {
    switch (token.type) {
      case "text":
      case "html_inline":
        pushRun(makeTextRun(token.content, bold, italic));
        break;

      case "softbreak":
        pushRun(new TextRun({ text: " " }));
        break;

      case "hardbreak":
        // Hard breaks inside a link are rare; push to whichever buffer is active
        pushRun(new TextRun({ break: 1 }));
        break;

      case "code_inline":
        pushRun(
          new TextRun({
            text: token.content,
            font: "Courier New",
            size: 18,
            shading: { type: ShadingType.CLEAR, fill: "EEEEEE" },
          })
        );
        break;

      case "strong_open":  bold = true;  break;
      case "strong_close": bold = false; break;
      case "em_open":      italic = true;  break;
      case "em_close":     italic = false; break;
      case "s_open":
      case "s_close":
        // strikethrough has no direct docx mapping, skip
        break;

      case "link_open":
        inLink = true;
        linkHref = token.attrGet("href") ?? "";
        linkBuffer.length = 0;
        break;

      case "link_close": {
        // Guard: only emit if the link has a href and visible text children
        if (linkHref && linkBuffer.length > 0) {
          result.push(
            new ExternalHyperlink({ link: linkHref, children: [...linkBuffer] })
          );
        } else if (linkBuffer.length > 0) {
          // href was empty — fall back to plain text
          result.push(...linkBuffer);
        }
        inLink = false;
        linkHref = "";
        linkBuffer.length = 0;
        break;
      }

      // images and other tokens are skipped
    }
  }

  return result;
}

function toHeadingLevel(tag: string) {
  switch (tag) {
    case "h1": return HeadingLevel.HEADING_1;
    case "h2": return HeadingLevel.HEADING_2;
    case "h3": return HeadingLevel.HEADING_3;
    case "h4": return HeadingLevel.HEADING_4;
    case "h5": return HeadingLevel.HEADING_5;
    default:   return HeadingLevel.HEADING_6;
  }
}

function buildParagraphs(tokens: MdToken[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  // stack entries: "bullet" | "ordered"
  const listStack: Array<"bullet" | "ordered"> = [];
  let blockquoteDepth = 0;
  let i = 0;

  const makeListParagraph = (children: ParagraphChild[]) => {
    const depth = listStack.length - 1;
    const ref = listStack[listStack.length - 1] === "bullet" ? "bullet-list" : "ordered-list";
    return new Paragraph({ numbering: { reference: ref, level: depth }, children });
  };

  while (i < tokens.length) {
    const token = tokens[i];

    // Headings
    if (token.type === "heading_open") {
      const inline = tokens[i + 1];
      const children = inline?.children ? convertInlineTokens(inline.children as MdToken[]) : [];
      paragraphs.push(new Paragraph({ heading: toHeadingLevel(token.tag), children }));
      i += 3;
      continue;
    }

    // Paragraphs
    if (token.type === "paragraph_open") {
      const inline = tokens[i + 1];
      const children = inline?.children ? convertInlineTokens(inline.children as MdToken[]) : [];

      if (listStack.length > 0) {
        paragraphs.push(makeListParagraph(children));
      } else if (blockquoteDepth > 0) {
        paragraphs.push(
          new Paragraph({
            children,
            indent: { left: convertInchesToTwip(0.5) },
            border: {
              left: { style: BorderStyle.SINGLE, size: 15, color: "AAAAAA", space: 10 },
            },
            spacing: { after: 100 },
          })
        );
      } else {
        paragraphs.push(new Paragraph({ children, spacing: { after: 120 } }));
      }
      i += 3;
      continue;
    }

    // Inline tokens at block level (tight list items skip paragraph_open/close)
    if (token.type === "inline") {
      const children = token.children ? convertInlineTokens(token.children as MdToken[]) : [];
      if (listStack.length > 0) {
        paragraphs.push(makeListParagraph(children));
      } else {
        paragraphs.push(new Paragraph({ children }));
      }
      i++;
      continue;
    }

    // List containers
    if (token.type === "bullet_list_open")  { listStack.push("bullet");  i++; continue; }
    if (token.type === "bullet_list_close") { listStack.pop();           i++; continue; }
    if (token.type === "ordered_list_open") { listStack.push("ordered"); i++; continue; }
    if (token.type === "ordered_list_close"){ listStack.pop();           i++; continue; }
    if (token.type === "list_item_open" || token.type === "list_item_close") { i++; continue; }

    // Blockquote
    if (token.type === "blockquote_open")  { blockquoteDepth++; i++; continue; }
    if (token.type === "blockquote_close") { blockquoteDepth--; i++; continue; }

    // Fenced / indented code block
    if (token.type === "fence" || token.type === "code_block") {
      const lines = token.content.trimEnd().split("\n");
      const children = lines.map((line, idx) =>
        new TextRun({
          text: line === "" ? "\u00A0" : line,
          font: "Courier New",
          size: 18,
          ...(idx > 0 && { break: 1 }),
        })
      );
      paragraphs.push(
        new Paragraph({
          children,
          shading: { type: ShadingType.CLEAR, fill: "F5F5F5" },
          spacing: { before: 120, after: 120 },
          indent: { left: convertInchesToTwip(0.2), right: convertInchesToTwip(0.2) },
        })
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (token.type === "hr") {
      paragraphs.push(new Paragraph({ thematicBreak: true, children: [] }));
      i++;
      continue;
    }

    // HTML block — skip
    i++;
  }

  return paragraphs;
}

export async function exportToDocx(title: string, content: string): Promise<Blob> {
  const tokens = parser.parse(content, {}) as unknown as MdToken[];
  const bodyParagraphs = buildParagraphs(tokens);

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "bullet-list",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "\u2022",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) } } },
            },
            {
              level: 1,
              format: LevelFormat.BULLET,
              text: "\u25E6",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: convertInchesToTwip(1.0), hanging: convertInchesToTwip(0.25) } } },
            },
            {
              level: 2,
              format: LevelFormat.BULLET,
              text: "\u25AA",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: convertInchesToTwip(1.5), hanging: convertInchesToTwip(0.25) } } },
            },
          ],
        },
        {
          reference: "ordered-list",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) } } },
            },
            {
              level: 1,
              format: LevelFormat.LOWER_LETTER,
              text: "%2.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: convertInchesToTwip(1.0), hanging: convertInchesToTwip(0.25) } } },
            },
            {
              level: 2,
              format: LevelFormat.LOWER_ROMAN,
              text: "%3.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: convertInchesToTwip(1.5), hanging: convertInchesToTwip(0.25) } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: title, bold: true })],
          }),
          new Paragraph({ children: [] }),
          ...bodyParagraphs,
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}
