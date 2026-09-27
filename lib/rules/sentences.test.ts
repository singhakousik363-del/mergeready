import { describe, it, expect } from "vitest";
import { parseMarkdownBlocks, splitSentences, toPlainText, type Block } from "./sentences";

// Real excerpt from https://github.com/nodejs/node/blob/main/doc/contributing/pull-requests.md
// (lines 150-156 and 196-205 of the file, with "..." lines removed)
const NODE_COMMIT_GUIDELINES = `\`\`\`bash
git add my/changed/files
git commit -s
\`\`\`

#### Commit message guidelines

6. Your commit must contain the \`Signed-off-by\` line with your name and email
   address as an acknowledgement that you agree to the [Developer Certificate of Origin][].
   Bot generated commits are exempt from this requirement. If a commit has
   multiple authors, the \`Signed-off-by\` line should be added for each author;
   and at least one should match the author information in the commit metadata.
`;

// Real excerpt from https://github.com/stdlib-js/stdlib/blob/develop/.github/PULL_REQUEST_TEMPLATE.md
const STDLIB_TEMPLATE = `Resolves #{{TODO: add issue number}}.

## Checklist

> Please ensure the following tasks are completed before submitting this pull request.

-   [ ] Read, understood, and followed the [contributing guidelines][contributing].

* * *

@stdlib-js/reviewers

[contributing]: https://github.com/stdlib-js/stdlib/blob/develop/CONTRIBUTING.md
`;

// Real excerpt from https://github.com/conventional-changelog/commitlint/blob/master/.github/PULL_REQUEST_TEMPLATE.md
const COMMITLINT_TEMPLATE = `<!--- Provide a general summary of your changes in the Title above -->

## Usage examples

\`\`\`js
// commitlint.config.js
module.exports = {};
\`\`\`

## Types of changes

<!--- What types of changes does your code introduce? Put an \`x\` in all the boxes that apply: -->

- [ ] Bug fix (non-breaking change which fixes an issue)
- [x] New feature (non-breaking change which adds functionality)
`;

// Real excerpt from https://github.com/nodejs/node/blob/main/.github/PULL_REQUEST_TEMPLATE.md
// (the whole template is one HTML comment)
const NODE_TEMPLATE = `<!--
For code changes:
1. Include tests for any bug fixes or new features.

Developer's Certificate of Origin 1.1
-->
`;

// Real excerpt from https://github.com/nodejs/node/blob/main/CONTRIBUTING.md
const NODE_CONTRIBUTING = `# Contributing to Node.js

> \\[!TIP]
> Contributing for the first time? Please read our
> [Guide for First-Time Contributors](./doc/contributing/first-contributions.md) for tips

## [Pull Requests](./doc/contributing/pull-requests.md)
`;

function texts(blocks: Block[]): string[] {
    return blocks.map((b) => b.parts.map((p) => p.raw).join(" "));
}

describe("parseMarkdownBlocks", () => {
    it("skips code blocks and joins a list item's lines (nodejs/node)", () => {
        const blocks = parseMarkdownBlocks(NODE_COMMIT_GUIDELINES);

        expect(blocks.map((b) => b.kind)).toEqual(["heading", "list-item"]);
        expect(texts(blocks).join(" ")).not.toContain("git commit -s");
        expect(blocks[0]).toMatchObject({ kind: "heading", level: 4, text: "Commit message guidelines" });

        const item = blocks[1];
        expect(item.parts).toHaveLength(5);
        expect(item.parts[0]).toEqual({
            raw: "Your commit must contain the `Signed-off-by` line with your name and email",
            line: 8,
        });
        expect(item.parts[4].line).toBe(12);
    });

    it("reads blockquotes, checkboxes, and skips rules and link targets (stdlib)", () => {
        const blocks = parseMarkdownBlocks(STDLIB_TEMPLATE);

        expect(texts(blocks)).toEqual([
            "Resolves #{{TODO: add issue number}}.",
            "Checklist",
            "Please ensure the following tasks are completed before submitting this pull request.",
            "Read, understood, and followed the [contributing guidelines][contributing].",
            "@stdlib-js/reviewers",
        ]);
        expect(blocks[3]).toMatchObject({ kind: "list-item", checkbox: "unchecked", indent: 0 });
        expect(blocks[3].parts[0].line).toBe(7);
    });

    it("keeps HTML comments as their own blocks (commitlint)", () => {
        const blocks = parseMarkdownBlocks(COMMITLINT_TEMPLATE);

        expect(blocks.map((b) => b.kind)).toEqual([
            "comment",
            "heading",
            "heading",
            "comment",
            "list-item",
            "list-item",
        ]);
        // "<!---" has an extra dash, which is not part of the text
        expect(texts(blocks)[0]).toBe("Provide a general summary of your changes in the Title above");
        expect(texts(blocks)[3]).toBe(
            "What types of changes does your code introduce? Put an `x` in all the boxes that apply:"
        );
        expect(blocks[5]).toMatchObject({ checkbox: "checked" });
        expect(texts(blocks).join(" ")).not.toContain("module.exports");
    });

    it("reads a template that is one big comment as one comment block (nodejs/node)", () => {
        const blocks = parseMarkdownBlocks(NODE_TEMPLATE);

        expect(blocks).toHaveLength(1);
        expect(blocks[0].kind).toBe("comment");
        expect(blocks[0].parts.map((p) => p.line)).toEqual([2, 3, 5]);
    });

    it("drops GitHub alert labels and link markup from headings (nodejs/node)", () => {
        const blocks = parseMarkdownBlocks(NODE_CONTRIBUTING);

        expect(blocks.map((b) => b.kind)).toEqual(["heading", "paragraph", "heading"]);
        expect(texts(blocks)[1]).toBe(
            "Contributing for the first time? Please read our " +
                "[Guide for First-Time Contributors](./doc/contributing/first-contributions.md) for tips"
        );
        expect(blocks[2]).toMatchObject({ text: "Pull Requests", level: 2 });
    });

    it("handles a comment in the middle of a line", () => {
        const blocks = parseMarkdownBlocks("Before <!-- note --> after");
        expect(texts(blocks)).toEqual(["Before", "note", "after"]);
    });

    it("skips front matter but keeps real line numbers", () => {
        const blocks = parseMarkdownBlocks("---\ntitle: Contributing\n---\n\n# Hello");
        expect(blocks).toEqual([{ kind: "heading", level: 1, text: "Hello", parts: [{ raw: "Hello", line: 5 }] }]);
    });

    it("handles Windows line endings", () => {
        const blocks = parseMarkdownBlocks("## Title\r\n\r\nText\r\n");
        expect(texts(blocks)).toEqual(["Title", "Text"]);
    });

    it("never crashes on broken markdown", () => {
        expect(parseMarkdownBlocks("")).toEqual([]);
        // A code block that never closes hides the rest of the file
        expect(texts(parseMarkdownBlocks("Text\n```\ncode"))).toEqual(["Text"]);
        // A comment that never closes is kept
        expect(texts(parseMarkdownBlocks("<!-- open\nstill open"))).toEqual(["open still open"]);
        // Empty heading and empty checkbox
        expect(parseMarkdownBlocks("##\n- [ ]")).toEqual([
            { kind: "list-item", indent: 0, checkbox: "unchecked", parts: [] },
        ]);
    });
});

describe("splitSentences", () => {
    it("splits a real list item and keeps each sentence's line (nodejs/node)", () => {
        const item = parseMarkdownBlocks(NODE_COMMIT_GUIDELINES)[1];
        const sentences = splitSentences(item.parts);

        expect(sentences).toHaveLength(3);
        expect(sentences[0]).toEqual({
            raw:
                "Your commit must contain the `Signed-off-by` line with your name and email " +
                "address as an acknowledgement that you agree to the [Developer Certificate of Origin][].",
            text:
                "Your commit must contain the Signed-off-by line with your name and email " +
                "address as an acknowledgement that you agree to the Developer Certificate of Origin.",
            line: 8,
        });
        expect(sentences[1]).toMatchObject({ raw: "Bot generated commits are exempt from this requirement.", line: 10 });
        expect(sentences[2].raw).toMatch(/^If a commit has multiple authors/);
        expect(sentences[2].line).toBe(10);
    });

    it("splits after ? and ! too", () => {
        const sentences = splitSentences([{ raw: "Is it ready? Yes! Ship it.", line: 1 }]);
        expect(sentences.map((s) => s.raw)).toEqual(["Is it ready?", "Yes!", "Ship it."]);
    });

    it("does not split after e.g. or inside file names", () => {
        const sentences = splitSentences([{ raw: "Use a tool, e.g. Prettier, on index.js files.", line: 3 }]);
        expect(sentences).toHaveLength(1);
    });

    it("returns nothing for no parts", () => {
        expect(splitSentences([])).toEqual([]);
    });
});

describe("toPlainText", () => {
    it("removes markdown but keeps the words", () => {
        expect(toPlainText("Use the `Fixes:` prefix, see [the guide](./x.md) and **[DCO][dco]**")).toBe(
            "Use the Fixes: prefix, see the guide and DCO"
        );
        expect(toPlainText("Keep snake_case and *.md <br> <https://example.com>")).toBe(
            "Keep snake_case and *.md https://example.com"
        );
    });
});
