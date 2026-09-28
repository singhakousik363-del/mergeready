import { readFileSync } from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { checkIssueAssigned } from "./issueAssigned";
import type { IssueData } from "../github/fetchIssue";
import type { PullRequestData } from "../github/fetchPullRequest";
import type { Rule } from "../rules/types";

// Real data, see __fixtures__/SOURCES.md
function fixture<T>(name: string): T {
    return JSON.parse(readFileSync(path.join(import.meta.dirname, "__fixtures__", name), "utf8"));
}
const REAL_PR = fixture<PullRequestData>("stdlib-pr-15585.json");
// The issue PR #15585 fixes. It is assigned to someone else (anandkaranubc).
const LINKED_ISSUE = fixture<IssueData>("stdlib-issue-15456.json");

// Real rule found by try-rules
const P5_ASSIGN_RULE: Rule = {
    type: "issue-assigned",
    details: null,
    confidence: "prose",
    sourceQuote: "Get Assigned Before Working on an Issue",
    sourceUrl: "https://github.com/processing/p5.js/blob/main/CONTRIBUTING.md?plain=1#L15",
    strict: false,
};

describe("checkIssueAssigned", () => {
    it("real PR #15585 + real issue #15456: assigned to someone else is yellow under a prose rule", () => {
        const check = checkIssueAssigned([P5_ASSIGN_RULE], REAL_PR, LINKED_ISSUE);
        expect(check).toMatchObject({
            id: "issue-assigned",
            stage: "issue",
            status: "warn",
            message: "Issue #15456 is assigned to @anandkaranubc, not to you (@AdeshDeshmukh).",
        });
        expect(check.evidence.observed).toEqual(["Issue #15456 assignees: anandkaranubc"]);
    });

    it("skips stdlib: no rule asks for assignment", () => {
        expect(checkIssueAssigned([], REAL_PR, LINKED_ISSUE).status).toBe("skip");
    });

    it("passes when the PR author is assigned (any letter case)", () => {
        const mine = { ...LINKED_ISSUE, assignees: ["adeshdeshmukh"] };
        expect(checkIssueAssigned([P5_ASSIGN_RULE], REAL_PR, mine).status).toBe("pass");
    });

    it("unassigned issue: ask to be assigned", () => {
        const check = checkIssueAssigned([P5_ASSIGN_RULE], REAL_PR, { ...LINKED_ISSUE, assignees: [] });
        expect(check.message).toBe("Issue #15456 isn't assigned to anyone. This repo asks you to be assigned first.");
    });

    it("skip without a linked issue, manual when the issue couldn't be loaded", () => {
        expect(checkIssueAssigned([P5_ASSIGN_RULE], { ...REAL_PR, linkedIssues: [] }, null).status).toBe("skip");
        expect(checkIssueAssigned([P5_ASSIGN_RULE], REAL_PR, null).status).toBe("manual");
    });
});
