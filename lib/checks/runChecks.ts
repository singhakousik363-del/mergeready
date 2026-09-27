import type { IssueData } from "../github/fetchIssue";
import type { PullRequestData } from "../github/fetchPullRequest";
import type { Rule } from "../rules/types";
import { checkCommitFormat } from "./commitFormat";
import { checkDcoSignoff } from "./dcoSignoff";
import { checkIssueAssigned } from "./issueAssigned";
import { buildJourney, type JourneyStep } from "./journey";
import { checkLinkedIssue } from "./linkedIssue";
import { checkPreStart } from "./preStart";
import { checkPrTemplate } from "./prTemplate";
import { checkTestsChanged } from "./testsChanged";
import type { Check } from "./types";

// What the user pasted
export type RunChecksInput =
    // An issue they want to work on: is it free?
    | { mode: "issue"; rules: Rule[]; issue: IssueData; username: string | null; now: Date }
    // Their PR: does it follow the repo's rules? linkedIssue = the first issue it fixes (null if none)
    | { mode: "pr"; rules: Rule[]; pr: PullRequestData; linkedIssue: IssueData | null };

export type CheckResults = {
    checks: Check[];
    journey: JourneyStep[];
    // From the fetched data, e.g. "only the first 250 commits were checked"
    warnings: string[];
};

// Runs every check. Pure: all data comes in, nothing is fetched here.
export function runChecks(input: RunChecksInput): CheckResults {
    if (input.mode === "issue") {
        const checks = checkPreStart(input);
        return { checks, journey: buildJourney(checks, "issue"), warnings: input.issue.warnings };
    }

    const { rules, pr, linkedIssue } = input;
    const checks = [
        checkIssueAssigned(rules, pr, linkedIssue),
        checkTestsChanged(rules, pr),
        ...checkCommitFormat(rules, pr),
        checkDcoSignoff(rules, pr),
        ...checkPrTemplate(rules, pr),
        ...checkLinkedIssue(rules, pr),
    ];
    checks.push(checkMergeState(pr, checks));

    return {
        checks,
        journey: buildJourney(checks, "pr"),
        warnings: [...pr.warnings, ...(linkedIssue?.warnings ?? [])],
    };
}

// The last stage: where the PR is now
function checkMergeState(pr: PullRequestData, otherChecks: Check[]): Check {
    const base = { id: "merge-state", ruleType: null, stage: "merge" as const, evidence: { rules: [], observed: [`PR state: ${pr.draft ? "draft" : pr.state}`] } };

    if (pr.state === "merged") {
        return { ...base, status: "pass", message: "This PR was merged. Well done!", howToFix: [] };
    }
    if (pr.state === "closed") {
        return {
            ...base,
            status: "fail",
            message: "This PR was closed without being merged.",
            howToFix: ["Read the last comments on the PR to see why, then ask if a new PR would be welcome."],
        };
    }
    if (pr.draft) {
        return {
            ...base,
            status: "warn",
            message: 'This PR is a draft. Maintainers usually wait until it\'s marked "Ready for review".',
            howToFix: ['When you\'re done, click "Ready for review" at the bottom of the PR page.'],
        };
    }
    const hasRed = otherChecks.some((c) => c.status === "fail");
    return {
        ...base,
        status: "pending",
        message: hasRed ? "Fix the red items first, then wait for a maintainer to review." : "Waiting for a maintainer to review.",
        howToFix: [],
    };
}
