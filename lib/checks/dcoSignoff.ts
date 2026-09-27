import type { PullRequestData } from "../github/fetchPullRequest";
import type { Rule } from "../rules/types";
import { evidenceOf, failStatus, plural, rulesOfType, shortSha, type Check } from "./types";

// Every commit needs a "Signed-off-by: Name <email>" line when the repo uses DCO
export function checkDcoSignoff(rules: Rule[], pr: PullRequestData): Check {
    const dcoRules = rulesOfType(rules, "dco-signoff");
    if (dcoRules.length === 0) {
        return {
            id: "dco-signoff",
            ruleType: "dco-signoff",
            stage: "commit",
            status: "skip",
            message: "This repo doesn't seem to ask for a DCO sign-off.",
            howToFix: [],
            evidence: { rules: [], observed: [] },
        };
    }

    // Merge commits are made by git, not by the author
    const commits = pr.commits.filter((c) => !c.message.startsWith("Merge "));
    const missing = commits.filter((c) => !c.hasSignOff);
    const ok = missing.length === 0;

    return {
        id: "dco-signoff",
        ruleType: "dco-signoff",
        stage: "commit",
        status: ok ? "pass" : failStatus(dcoRules[0].confidence),
        message: ok
            ? commits.length === 1
                ? "The commit is signed off."
                : `All ${commits.length} commits are signed off.`
            : `${missing.length} of ${plural(commits.length, "commit")} ${missing.length === 1 ? "has" : "have"} no "Signed-off-by" line. This repo needs one on every commit.`,
        howToFix: ok ? [] : fixSteps(commits.length),
        evidence: {
            rules: evidenceOf(dcoRules),
            observed: ok
                ? [`${plural(commits.length, "commit")} checked`]
                : missing.map((c) => `Commit ${shortSha(c.sha)} "${c.message.split("\n")[0]}" has no Signed-off-by line`),
        },
    };
}

function fixSteps(total: number): string[] {
    const sign =
        total === 1
            ? "Add the sign-off to your commit: git commit --amend -s --no-edit"
            : `Add the sign-off to all ${total} commits: git rebase --signoff HEAD~${total}`;
    return [
        // The sign-off uses these, so they must be your real name and email
        "Check your name and email: git config user.name && git config user.email",
        sign,
        "Update the PR: git push --force-with-lease",
        "Next time, use git commit -s to sign off as you commit.",
    ];
}
