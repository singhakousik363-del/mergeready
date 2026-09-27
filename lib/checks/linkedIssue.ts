import type { PullRequestData } from "../github/fetchPullRequest";
import type { Rule } from "../rules/types";
import { evidenceOf, failStatus, rulesOfType, type Check } from "./types";

// Does the PR say which issue it fixes ("Fixes #123")? Plus a warning when it
// targets another branch, where GitHub ignores "Fixes #123".
export function checkLinkedIssue(rules: Rule[], pr: PullRequestData): Check[] {
    const issueRules = rulesOfType(rules, "linked-issue");
    const linked = pr.linkedIssues.map((n) => `#${n}`).join(", ");
    const checks: Check[] = [];

    if (issueRules.length === 0) {
        checks.push({
            id: "linked-issue",
            ruleType: "linked-issue",
            stage: "pr",
            status: "skip",
            message: "This repo doesn't seem to ask you to link an issue.",
            howToFix: [],
            evidence: { rules: [], observed: linked ? [`The PR closes ${linked}`] : [] },
        });
    } else if (pr.linkedIssues.length > 0) {
        checks.push({
            id: "linked-issue",
            ruleType: "linked-issue",
            stage: "pr",
            status: "pass",
            message: `This PR says it fixes ${linked}.`,
            howToFix: [],
            evidence: { rules: evidenceOf(issueRules), observed: [`Closing keyword found for ${linked}`] },
        });
    } else {
        checks.push({
            id: "linked-issue",
            ruleType: "linked-issue",
            stage: "pr",
            status: failStatus(issueRules[0].confidence),
            message: "This PR doesn't say which issue it fixes.",
            howToFix: [
                'Edit the PR description and add a line like "Fixes #123" (with your issue number).',
                'Only closing words work: "Fixes", "Closes" or "Resolves". A plain "#123" or "Refs #123" doesn\'t link it.',
            ],
            evidence: {
                rules: evidenceOf(issueRules),
                observed: ['No "Fixes/Closes/Resolves #number" for an issue in this repo'],
            },
        });
    }

    // Only matters when the PR actually tries to close an issue
    if (pr.linkedIssues.length > 0 && !pr.targetsDefaultBranch) {
        checks.push({
            id: "linked-issue:target-branch",
            ruleType: "linked-issue",
            stage: "pr",
            status: "warn",
            message: `This PR targets "${pr.baseBranch}", not the default branch, so GitHub won't close ${linked} automatically when it's merged.`,
            howToFix: [
                "If the repo wants PRs on the default branch, change the base branch (Edit, next to the PR title).",
                "Otherwise, remind maintainers to close the issue by hand after merging.",
            ],
            evidence: { rules: evidenceOf(issueRules), observed: [`Base branch: ${pr.baseBranch}`] },
        });
    }
    return checks;
}
