// Turns a markdown file into small pieces (headings, paragraphs, list items,
// HTML comments) and then into sentences. Every piece remembers its line
// number, so a rule can link to the exact line it came from.
//
// This is NOT a full markdown parser. It only understands what guideline
// files really use. Not supported: setext headings (text underlined with
// === or ---), indented code blocks, and .rst files (read as plain paragraphs).

// One line of the file (trimmed). raw = the text exactly as written.
export type Part = { raw: string; line: number };

export type Block =
    | { kind: "heading"; level: number; text: string; parts: Part[] }
    | { kind: "paragraph"; parts: Part[] }
    | {
          kind: "list-item";
          // Spaces before the "-", so nested items can be told apart
          indent: number;
          checkbox: "checked" | "unchecked" | null;
          // Text after the "-" (and after "[ ]" for checkboxes)
          parts: Part[];
      }
    | { kind: "comment"; parts: Part[] };

// raw = exact text (lines joined with a space), used as the sourceQuote.
// text = same sentence with markdown removed, used for pattern matching.
export type Sentence = { raw: string; text: string; line: number };

type Fence = { char: string; length: number };

const FENCE = /^\s*(`{3,}|~{3,})/;
const HEADING = /^\s{0,3}(#{1,6})(?:\s+(.*?))?(?:\s+#+)?\s*$/;
const LIST_ITEM = /^(\s*)(?:[-*+]|\d{1,9}[.)])\s+(.*)$/;
const CHECKBOX = /^\[([ xX])\]\s*(.*)$/;
// "---", "* * *", "___"
const HORIZONTAL_RULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
// "[contributing]: https://..." (the target of a reference-style link)
const LINK_DEFINITION = /^\s{0,3}\[[^\]]+\]:\s*\S/;
// "| --- | :---: |" (the line under a table header)
const TABLE_DIVIDER = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?\s*$/;
// "> text" (blockquote), possibly nested "> > text"
const QUOTE_MARKER = /^(?:\s*>\s?)+/;
// "[!TIP]", "[!IMPORTANT]" (GitHub alert labels inside a blockquote)
const ALERT_LABEL = /^\\?\[!\w+\]$/;

export function parseMarkdownBlocks(markdown: string): Block[] {
    const lines = markdown.split(/\r?\n/);
    const blocks: Block[] = [];

    // The paragraph or list item we are still adding lines to
    let current: Block | null = null;
    // Inside a ``` code block: which fence closes it
    let fence: Fence | null = null;
    // Inside an HTML comment: the lines collected so far
    let comment: Part[] | null = null;

    function finishCurrent(): void {
        if (current) blocks.push(current);
        current = null;
    }

    function addPart(parts: Part[], raw: string, line: number): void {
        const trimmed = raw.trim();
        if (trimmed !== "") parts.push({ raw: trimmed, line });
    }

    // Handles a line (or the part of a line outside an HTML comment).
    // Returns the fence when the line starts a ``` code block.
    function handleText(text: string, line: number): Fence | null {
        const unquoted = text.replace(QUOTE_MARKER, "");
        const trimmed = unquoted.trim();

        // A blank line ends the paragraph or list item
        if (trimmed === "") {
            finishCurrent();
            return null;
        }
        if (ALERT_LABEL.test(trimmed) || TABLE_DIVIDER.test(unquoted)) return null;

        const fenceMatch = FENCE.exec(unquoted);
        if (fenceMatch) {
            finishCurrent();
            return { char: fenceMatch[1][0], length: fenceMatch[1].length };
        }
        if (HORIZONTAL_RULE.test(unquoted) || LINK_DEFINITION.test(unquoted)) {
            finishCurrent();
            return null;
        }

        const heading = HEADING.exec(unquoted);
        if (heading) {
            finishCurrent();
            const raw = heading[2] ?? "";
            if (raw !== "") {
                blocks.push({ kind: "heading", level: heading[1].length, text: toPlainText(raw), parts: [{ raw, line }] });
            }
            return null;
        }

        const item = LIST_ITEM.exec(unquoted);
        if (item) {
            finishCurrent();
            let content = item[2];
            let checkbox: "checked" | "unchecked" | null = null;
            const box = CHECKBOX.exec(content);
            if (box) {
                checkbox = box[1] === " " ? "unchecked" : "checked";
                content = box[2];
            }
            const parts: Part[] = [];
            addPart(parts, content, line);
            current = { kind: "list-item", indent: item[1].length, checkbox, parts };
            return null;
        }

        // Not a new block: continue the current paragraph or list item
        if (current) {
            addPart(current.parts, trimmed, line);
        } else {
            current = { kind: "paragraph", parts: [{ raw: trimmed, line }] };
        }
        return null;
    }

    const start = frontMatterEnd(lines);
    for (let index = start; index < lines.length; index++) {
        const line = index + 1;
        let rest = lines[index];

        // A line can hold text and a comment, e.g. "text <!-- note --> more"
        while (true) {
            if (comment) {
                const end = rest.indexOf("-->");
                if (end === -1) {
                    addPart(comment, rest, line);
                    break;
                }
                addPart(comment, rest.slice(0, end), line);
                if (comment.length > 0) blocks.push({ kind: "comment", parts: comment });
                comment = null;
                rest = rest.slice(end + 3);
                if (rest.trim() === "") break;
                continue;
            }

            if (fence) {
                const closing = FENCE.exec(rest);
                const isClosing =
                    closing !== null &&
                    closing[1][0] === fence.char &&
                    closing[1].length >= fence.length &&
                    rest.trim() === closing[1];
                if (isClosing) fence = null;
                break;
            }

            const commentStart = rest.indexOf("<!--");
            if (commentStart === -1) {
                fence = handleText(rest, line);
                break;
            }
            // (A fence can't start in front of a comment on the same line)
            const before = rest.slice(0, commentStart);
            if (before.trim() !== "") handleText(before, line);
            finishCurrent();
            comment = [];
            // "<!--- text" has an extra dash: drop it too
            rest = rest.slice(commentStart + 4).replace(/^-+/, "");
        }
    }

    // A comment that is never closed: keep what we have instead of losing it
    if (comment && comment.length > 0) blocks.push({ kind: "comment", parts: comment });
    finishCurrent();
    return blocks;
}

// Some files start with "---" ... "---" metadata for doc websites: skip it.
// Returns the index of the first line after it (0 when there is none).
function frontMatterEnd(lines: string[]): number {
    if (lines[0]?.trim() !== "---") return 0;
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === "---" || lines[i].trim() === "...") return i + 1;
    }
    return 0;
}

// End of a sentence: . ! or ? (plus closing quotes/brackets/markdown), then
// a space and a capital letter or digit. "e.g. The" is checked separately.
const SENTENCE_END = /[.!?]["'”’)\]*_`]*(?=\s+["'“(\[*_`]*[A-Z0-9])/g;
const ABBREVIATION = /\b(?:e\.g|i\.e|vs|cf|etc)\.$/i;

// Splits the lines of one block into sentences.
export function splitSentences(parts: Part[]): Sentence[] {
    // Join the lines with spaces, remembering where each line starts
    let joined = "";
    const lineStarts: { offset: number; line: number }[] = [];
    for (const part of parts) {
        if (joined !== "") joined += " ";
        lineStarts.push({ offset: joined.length, line: part.line });
        joined += part.raw;
    }

    const sentences: Sentence[] = [];
    function add(from: number, to: number): void {
        const piece = joined.slice(from, to);
        const raw = piece.trim();
        if (raw === "") return;
        const offset = from + piece.indexOf(raw);
        // The line where this sentence starts
        let line = lineStarts[0].line;
        for (const start of lineStarts) {
            if (start.offset <= offset) line = start.line;
        }
        sentences.push({ raw, text: toPlainText(raw), line });
    }

    let from = 0;
    for (const match of joined.matchAll(SENTENCE_END)) {
        const to = match.index + match[0].length;
        if (ABBREVIATION.test(joined.slice(from, to))) continue;
        add(from, to);
        from = to;
    }
    add(from, joined.length);
    return sentences;
}

// Removes markdown so patterns can match the words:
// "Use the `Fixes:` prefix, see [guide](./x.md)" -> "Use the Fixes: prefix, see guide"
export function toPlainText(markdown: string): string {
    return (
        markdown
            // Images and links: keep only the visible text
            .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
            .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
            .replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1")
            // <https://example.com> -> https://example.com
            .replace(/<(https?:\/\/[^>\s]+)>/g, "$1")
            // Other HTML tags like <br> or <kbd>
            .replace(/<\/?[a-zA-Z][^>]*>/g, "")
            // Bold, code and escapes. Single _ and * are left alone so
            // names like snake_case or glob patterns like *.md survive.
            .replace(/\*\*|__|`/g, "")
            .replace(/\\([\\`*_{}[\]()#+\-.!>])/g, "$1")
            .replace(/\s+/g, " ")
            .trim()
    );
}
