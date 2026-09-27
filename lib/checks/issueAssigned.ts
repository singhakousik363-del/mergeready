import type { IssueData } from "../github/fetchIssue";
import type { PullRequestData } from "../github/fetchPullRequest";
import type { Rule } from "../rules/types";
import { evidenceOf, failStatus, rulesOfType, steps, type Check, type CheckStatus, type FixStep } from "./types";

// Is the issue this PR fixes assigned to the PR's author?
// linkedIssue = the first linked issue, fetched by the caller (null if none or it failed)
export function checkIssueAssigned(rules: Rule[], pr: PullRequestData, linkedIssue: IssueData | null): Check {
    const assignRules = rulesOfType(rules, "issue-assigned");

    function result(status: CheckStatus, message: string, howToFix: FixStep[], observed: string[]): Check {
        return {
            id: "issue-assigned",
            ruleType: "issue-assigned",
            stage: "issue",
            status,
            message,
            howToFix,
            evidence: { rules: evidenceOf(assignRules), observed },
        };
    }

    if (assignRules.length === 0) {
        return result("skip", "This repo doesn't seem to ask you to be assigned to the issue.", [], []);
    }
    // The linked-issue check already tells the user to link one
    if (pr.linkedIssues.length === 0) {
        return result("skip", "Link an issue first, then we can check who it's assigned to.", [], []);
    }
    if (linkedIssue === null) {
        return result(
            "manual",
            `We couldn't load issue #${pr.linkedIssues[0]}. Check yourself that it's assigned to you.`,
            steps(`Open issue #${pr.linkedIssues[0]} and look at "Assignees" on the right.`),
            []
        );
    }

    const failed = failStatus(assignRules[0].confidence);
    const observed = [`Issue #${linkedIssue.number} assignees: ${linkedIssue.assignees.join(", ") || "none"}`];
    const isAuthor = (login: string) => login.toLowerCase() === pr.author.toLowerCase();

    if (linkedIssue.assignees.some(isAuthor)) {
        return result("pass", `Issue #${linkedIssue.number} is assigned to you (@${pr.author}).`, [], observed);
    }
    if (linkedIssue.assignees.length > 0) {
        const names = linkedIssue.assignees.map((a) => `@${a}`).join(", ");
        return result(
            failed,
            `Issue #${linkedIssue.number} is assigned to ${names}, not to you (@${pr.author}).`,
            steps(
                `Ask in issue #${linkedIssue.number} whether ${names} is still working on it,`,
                "and ask a maintainer to assign it to you before your PR is reviewed.",
            ),
            observed
        );
    }
    return result(
        failed,
        `Issue #${linkedIssue.number} isn't assigned to anyone. This repo asks you to be assigned first.`,
        steps(`Comment in issue #${linkedIssue.number}: "I've opened a PR for this. Could you assign it to me?"`),
        observed
    );
}
