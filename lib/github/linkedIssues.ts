import type { RepoName } from "./docLinks";

// GitHub's closing keywords: close/closes/closed, fix/fixes/fixed, resolve/resolves/resolved.
// After the keyword (and an optional ":") comes one of:
//   #123   |   owner/repo#123   |   https://github.com/owner/repo/issues/123
// (?![\w-]) stops "#12abc" or ".../issues/12-x" from counting.
const CLOSING_REFERENCE = new RegExp(
    String.raw`\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?):?\s+` +
        String.raw`(?:#(\d+)|([\w.-]+)\/([\w.-]+)#(\d+)|https?:\/\/(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/(\d+))` +
        String.raw`(?![\w-])`,
    "gi"
);

// Returns the numbers of same-repo issues this PR body says it closes, e.g.
// "Fixes #12, closes acme/app#7" in acme/app -> [12, 7]. No duplicates, in order.
export function parseLinkedIssues(body: string, repo: RepoName): number[] {
    const numbers: number[] = [];

    for (const match of removeHiddenText(body).matchAll(CLOSING_REFERENCE)) {
        const [, shortNumber, refOwner, refRepo, refNumber, urlOwner, urlRepo, urlNumber] = match;

        let number: string;
        if (shortNumber !== undefined) {
            number = shortNumber;
        } else if (refNumber !== undefined && isSameRepo(refOwner, refRepo, repo)) {
            number = refNumber;
        } else if (urlNumber !== undefined && isSameRepo(urlOwner, urlRepo, repo)) {
            number = urlNumber;
        } else {
            // An issue in a different repo: it can't be checked here
            continue;
        }

        const value = Number(number);
        if (Number.isSafeInteger(value) && value > 0 && !numbers.includes(value)) numbers.push(value);
    }
    return numbers;
}

// PR templates often show examples like "<!-- Fixes #123 -->" or put them in
// code. GitHub ignores those, so we remove them before searching.
function removeHiddenText(body: string): string {
    return (
        body
            // HTML comments (an unclosed "<!--" hides everything after it)
            .replace(/<!--[\s\S]*?(?:-->|$)/g, " ")
            // Fenced code blocks: ```...``` or ~~~...~~~
            .replace(/^(```|~~~)[\s\S]*?(?:^\1|$(?![\s\S]))/gm, " ")
            // Inline code: `...`
            .replace(/`[^`\n]*`/g, " ")
    );
}

function isSameRepo(owner: string | undefined, repo: string | undefined, target: RepoName): boolean {
    return (
        owner?.toLowerCase() === target.owner.toLowerCase() && repo?.toLowerCase() === target.repo.toLowerCase()
    );
}
