import { lineUrl, parseMarkdownBlocks } from "./sentences";
import type { ProseDoc } from "./fromProse";

// A part of CONTRIBUTING (or a linked doc) the user should read themselves.
// Pattern matching can miss rules, so we show the original text too: nothing hidden.
export type GuideSection = {
    heading: string;
    // The section's markdown exactly as written (heading line included)
    text: string;
    sourceUrl: string;
    // true when text was cut at MAX_SECTION_CHARS
    truncated: boolean;
};

export const MAX_SECTIONS = 6;
export const MAX_SECTION_CHARS = 4000;

// Headings about what a first PR needs, best first. When there are too many,
// commit rules win over general PR text, which wins over the rest.
// ("commit" as a whole word, so a doc titled "commitlint" doesn't match)
const COMMIT_RULES = /\bcommit(?:s|ting)?\b|sign[- ]?off|\bDCO\b|certificate of origin/i;
const PULL_REQUESTS = /pull requests?|\bPRs?\b/i;
// "first-time contributors" yes, "publishing packages for the first time" (maintainer work) no
const OTHER = /\btest(?:s|ing)?\b|\bissues?\b|first[- ]time contributors?|first contributions?|first[- ]timers?|submit|assign/i;
// Navigation, not content
const SKIP = /^(?:table of )?contents$/i;

type Candidate = GuideSection & { score: number; docIndex: number; line: number };

export function findRelevantSections(docs: ProseDoc[]): GuideSection[] {
    const candidates: Candidate[] = [];

    docs.forEach((doc, docIndex) => {
        const lines = doc.text.split(/\r?\n/);
        const headings = parseMarkdownBlocks(doc.text).flatMap((b) =>
            b.kind === "heading" ? [{ text: b.text, level: b.level, line: b.parts[0].line }] : []
        );

        // Where a chosen section ends: children inside it are not listed again
        let insideUntil = 0;
        headings.forEach((heading, i) => {
            if (heading.line <= insideUntil) return;
            const score = COMMIT_RULES.test(heading.text) ? 3 : PULL_REQUESTS.test(heading.text) ? 2 : OTHER.test(heading.text) ? 1 : 0;
            if (score === 0 || SKIP.test(heading.text)) return;

            // A section runs until the next heading of the same or a higher level
            const next = headings.slice(i + 1).find((h) => h.level <= heading.level);
            const endLine = next ? next.line - 1 : lines.length;
            const text = lines.slice(heading.line - 1, endLine).join("\n").trim();
            // Skip headings with nothing under them
            if (text.split("\n").length < 2) return;

            const truncated = text.length > MAX_SECTION_CHARS;
            // Too long to show whole (e.g. a "# Pull requests" title over a whole
            // doc)? Then look at its smaller sub-sections instead of cutting it.
            const hasSubsections = headings.some((h) => h.line > heading.line && h.line <= endLine);
            if (truncated && hasSubsections) return;

            insideUntil = endLine;
            candidates.push({
                heading: heading.text,
                text: truncated ? text.slice(0, MAX_SECTION_CHARS) : text,
                sourceUrl: lineUrl(doc.fileUrl, heading.line),
                truncated,
                score,
                docIndex,
                line: heading.line,
            });
        });
    });

    // Keep the best MAX_SECTIONS (highest score, then earlier), then show them in reading order
    const chosen = [...candidates]
        .sort((a, b) => b.score - a.score || a.docIndex - b.docIndex || a.line - b.line)
        .slice(0, MAX_SECTIONS)
        .sort((a, b) => a.docIndex - b.docIndex || a.line - b.line);
    return chosen.map(({ heading, text, sourceUrl, truncated }) => ({ heading, text, sourceUrl, truncated }));
}
