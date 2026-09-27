import { describe, it, expect } from "vitest";
import { parseLinkedIssues } from "./linkedIssues";

const STDLIB = { owner: "stdlib-js", repo: "stdlib" };

// Source: https://github.com/stdlib-js/stdlib/pull/15585 (first lines of the real PR body)
const STDLIB_PR_BODY = `Resolves #15456.

## Description

This pull request:

-   Fixes the Rayleigh MGF, which misplaced a parenthesis so that \`mgf(0, sigma)\` returned \`sqrt(pi/2)\` instead of \`1\`.

## Related Issues

This pull request has the following related issues:

-   #15456
`;

// Source: https://github.com/stdlib-js/stdlib/blob/develop/.github/PULL_REQUEST_TEMPLATE.md (unfilled)
const STDLIB_PR_TEMPLATE = `Resolves #{{TODO: add issue number}}.

## Related Issues

-   #{{TODO: add related issue number}}
`;

describe("parseLinkedIssues", () => {
    it("finds the issue in a real stdlib PR body", () => {
        expect(parseLinkedIssues(STDLIB_PR_BODY, STDLIB)).toEqual([15456]);
    });

    it("finds nothing in an unfilled PR template", () => {
        expect(parseLinkedIssues(STDLIB_PR_TEMPLATE, STDLIB)).toEqual([]);
    });

    it("understands every GitHub keyword, any case, with or without a colon", () => {
        const body = "close #1\ncloses #2\nClosed #3\nfix #4\nFIXES #5\nfixed #6\nresolve #7\nresolves: #8\nResolved #9";
        expect(parseLinkedIssues(body, STDLIB)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it("accepts owner/repo#N and full issue URLs for the same repo only", () => {
        const body = [
            "Fixes stdlib-js/stdlib#10",
            "Fixes Stdlib-JS/STDLIB#11",
            "Closes https://github.com/stdlib-js/stdlib/issues/12",
            "Fixes other/repo#13",
            "Closes https://github.com/other/repo/issues/14",
        ].join("\n");
        expect(parseLinkedIssues(body, STDLIB)).toEqual([10, 11, 12]);
    });

    it("ignores references hidden in HTML comments and code", () => {
        const body = [
            "<!-- Example: Fixes #1 -->",
            "Use `fixes #2` in your PR.",
            "```",
            "fixes #3",
            "```",
            "Fixes #4",
        ].join("\n");
        expect(parseLinkedIssues(body, STDLIB)).toEqual([4]);
    });

    it("treats an unclosed HTML comment as hiding the rest", () => {
        expect(parseLinkedIssues("Fixes #1\n<!-- oops\nFixes #2", STDLIB)).toEqual([1]);
    });

    it("ignores mentions without a keyword, and words that only contain one", () => {
        expect(parseLinkedIssues("Related to #5. Prefixes #6. Unfixed #7. See #8", STDLIB)).toEqual([]);
    });

    it("does not count '#12abc' or a number glued to a word", () => {
        expect(parseLinkedIssues("Fixes #12abc and fixes #13-draft", STDLIB)).toEqual([]);
    });

    it("keeps each issue once, in order", () => {
        expect(parseLinkedIssues("Fixes #3, fixes #1, closes #3", STDLIB)).toEqual([3, 1]);
    });

    it("only links the first number after a keyword, like GitHub", () => {
        expect(parseLinkedIssues("Fixes #1, #2", STDLIB)).toEqual([1]);
    });

    it("returns [] for an empty body", () => {
        expect(parseLinkedIssues("", STDLIB)).toEqual([]);
    });
});
