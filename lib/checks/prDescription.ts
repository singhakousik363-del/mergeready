// Builds a ready-to-copy PR description that follows the repo's template.
// Rules: keep the template exactly (headings, instructions, placeholders),
// fill in the issue number, and NEVER tick a checkbox for the user: ticking
// a box is a promise only the author can make.

// "- [x] Tests pass" -> "- [ ] Tests pass" (also "* [X]" and "1. [x]")
const TICKED_BOX = /^(\s*(?:[-*+]|\d{1,9}[.)])\s+)\[[xX]\]/gm;
// A closing word followed by an empty issue field:
// "Resolves #{{TODO: add issue number}}", "fixes #", "Closes #<issue number>", "Fixes #(issue)"
const ISSUE_FIELD = /(\b(?:fix(?:e[sd])?|close[sd]?|resolve[sd]?)\b:?[ \t]*)#(?:\{\{[^}]*\}\}|<[^>\n]*>|\([^)\n]*\)|(?![\w{<(]))/gi;
// HTML comments are instructions: leave them exactly as they are
const COMMENT = /(<!--[\s\S]*?-->)/;

export type PrDescriptionInput = {
    // The repo's PR template, or null when it has none
    template: string | null;
    // The issue this PR fixes, if known
    issueNumber: number | null;
};

export function buildPrDescription({ template, issueNumber }: PrDescriptionInput): string {
    if (template === null) return starter(issueNumber);

    let filledIssue = false;
    // Odd pieces are comments (split keeps them because COMMENT has a group)
    const pieces = template.split(COMMENT).map((piece, i) => {
        if (i % 2 === 1) return piece;
        let text = piece.replace(TICKED_BOX, "$1[ ]");
        if (issueNumber !== null) {
            text = text.replace(ISSUE_FIELD, (_match, keyword: string) => {
                filledIssue = true;
                return `${keyword}#${issueNumber}`;
            });
        }
        return text;
    });

    let description = pieces.join("");
    // The template has no issue field: add one so GitHub links the issue
    if (issueNumber !== null && !filledIssue) {
        description = `${description.trimEnd()}\n\nFixes #${issueNumber}\n`;
    }
    return description;
}

// For repos without a template. Marked as ours, so nobody thinks the repo asked for it.
function starter(issueNumber: number | null): string {
    const issueLine = issueNumber !== null ? `Fixes #${issueNumber}` : "<!-- If this fixes an issue, write: Fixes #123 -->";
    return [
        "<!-- Starter from MergeReady: this repo has no PR template. -->",
        "",
        "## What does this PR change?",
        "",
        "<!-- Describe your change and why it's needed. -->",
        "",
        "## How did you test it?",
        "",
        "<!-- For example: the commands you ran and what you checked. -->",
        "",
        issueLine,
        "",
    ].join("\n");
}
