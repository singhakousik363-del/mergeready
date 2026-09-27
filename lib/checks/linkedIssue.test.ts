import { readFileSync } from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { checkLinkedIssue } from "./linkedIssue";
import type { PullRequestData } from "../github/fetchPullRequest";
import type { Rule } from "../rules/types";

// Real data, see __fixtures__/SOURCES.md
function fixture<T>(name: string): T {
    return JSON.parse(readFileSync(path.join(import.meta.dirname, "__fixtures__", name), "utf8"));
}
const REAL_PR = fixture<PullRequestData>("stdlib-pr-15585.json");

// Real rule found by try-rules
const STDLIB_ISSUE_FIELD: Rule = {
    type: "linked-issue",
    details: null,
    confidence: "template",
    sourceQuote: "Resolves #{{TODO: add issue number}}.",
    sourceUrl: "https://github.com/stdlib-js/stdlib/blob/develop/.github/PULL_REQUEST_TEMPLATE.md?plain=1#L1",
};

describe("checkLinkedIssue", () => {
    it("real PR #15585: 'Resolves #15456.' links the issue, on the default branch", () => {
        expect(checkLinkedIssue([STDLIB_ISSUE_FIELD], REAL_PR)).toEqual([
            {
                id: "linked-issue",
                ruleType: "linked-issue",
                stage: "pr",
                status: "pass",
                message: "This PR says it fixes #15456.",
                howToFix: [],
                evidence: {
                    rules: [{ sourceQuote: STDLIB_ISSUE_FIELD.sourceQuote, sourceUrl: STDLIB_ISSUE_FIELD.sourceUrl, confidence: "template" }],
                    observed: ["Closing keyword found for #15456"],
                },
            },
        ]);
    });

    it("red when a template rule asks for it and the PR links nothing", () => {
        const [check] = checkLinkedIssue([STDLIB_ISSUE_FIELD], { ...REAL_PR, linkedIssues: [] });
        expect(check.status).toBe("fail");
        expect(check.message).toBe('This PR doesn\'t link an issue. If it fixes one, add a line like "Fixes #123".');
    });

    it("warns that 'Fixes #' won't work on a non-default branch, even without a rule", () => {
        const checks = checkLinkedIssue([], { ...REAL_PR, baseBranch: "release-1.x", targetsDefaultBranch: false });
        expect(checks.map((c) => [c.id, c.status])).toEqual([
            ["linked-issue", "skip"],
            ["linked-issue:target-branch", "warn"],
        ]);
        expect(checks[1].message).toBe(
            'This PR targets "release-1.x", not the default branch, so GitHub won\'t close #15456 automatically when it\'s merged.'
        );
    });
});
