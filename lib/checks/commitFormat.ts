import type { PullRequestData } from "../github/fetchPullRequest";
import type { Rule } from "../rules/types";
import { evidenceOf, failStatus, plural, rulesOfType, shortSha, type Check } from "./types";

// "type(scope)!: description" with a lowercase type, e.g. "fix(parser): handle tabs"
const CONVENTIONAL = /^([a-z]+)(?:\([^)]*\))?!?: \S/;

type ConventionalRule = Rule & { type: "conventional-commits" };

// One check for commit messages and/or one for the PR title, depending on
// what the repo's rules apply to (commitlint = commits, semantic PR action = title)
export function checkCommitFormat(rules: Rule[], pr: PullRequestData): Check[] {
    const conventional = rulesOfType(rules, "conventional-commits");
    if (conventional.length === 0) {
        return [
            {
                id: "commit-format",
                ruleType: "conventional-commits",
                stage: "commit",
                status: "skip",
                message: "We didn't find a commit message format rule for this repo.",
                howToFix: [],
                evidence: { rules: [], observed: [] },
            },
        ];
    }

    const forCommits = conventional.filter((r) => r.details.appliesTo === "commits");
    const forTitle = conventional.filter((r) => r.details.appliesTo === "pr-title");
    const checks: Check[] = [];
    if (forCommits.length > 0) checks.push(checkCommits(forCommits, pr));
    if (forTitle.length > 0) checks.push(checkTitle(forTitle, pr));
    return checks;
}

function checkCommits(rules: ConventionalRule[], pr: PullRequestData): Check {
    const allowed = allowedTypes(rules);
    // Merge commits ("Merge branch 'main' into ...") are made by git, not written
    const commits = pr.commits.filter((c) => !c.message.startsWith("Merge "));
    const problems = commits.flatMap((c) => {
        const subject = firstLine(c.message);
        const problem = findProblem(subject, allowed);
        return problem ? [`Commit ${shortSha(c.sha)} "${subject}": ${problem}`] : [];
    });

    const ok = problems.length === 0;
    return {
        id: "commit-format:commits",
        ruleType: "conventional-commits",
        stage: "commit",
        status: ok ? "pass" : failStatus(rules[0].confidence),
        message: ok
            ? commits.length === 1
                ? "The commit message follows Conventional Commits."
                : `All ${commits.length} commit messages follow Conventional Commits.`
            : `${problems.length} of ${plural(commits.length, "commit message")} ${problems.length === 1 ? "doesn't" : "don't"} follow Conventional Commits ("type: description").`,
        howToFix: ok ? [] : fixCommitsSteps(problems.length, commits.length, allowed),
        evidence: { rules: evidenceOf(rules), observed: ok ? [`${plural(commits.length, "commit message")} checked`] : problems },
    };
}

function checkTitle(rules: ConventionalRule[], pr: PullRequestData): Check {
    const allowed = allowedTypes(rules);
    const problem = findProblem(pr.title, allowed);
    return {
        id: "commit-format:pr-title",
        ruleType: "conventional-commits",
        stage: "pr",
        status: problem ? failStatus(rules[0].confidence) : "pass",
        message: problem
            ? `The PR title doesn't follow Conventional Commits ("type: description").`
            : "The PR title follows Conventional Commits.",
        howToFix: problem
            ? [
                  'On the PR page, click "Edit" next to the title.',
                  `Change it to "type: description", e.g. "fix: correct typo in README".`,
                  ...allowedTypesHint(allowed),
              ]
            : [],
        evidence: { rules: evidenceOf(rules), observed: [`PR title "${pr.title}"${problem ? `: ${problem}` : ""}`] },
    };
}

// The type list from the strongest rule that has one; null = any lowercase type
function allowedTypes(rules: ConventionalRule[]): string[] | null {
    return rules.find((r) => r.details.allowedTypes !== null)?.details.allowedTypes ?? null;
}

// null when the message is fine, otherwise what's wrong in plain English
function findProblem(subject: string, allowed: string[] | null): string | null {
    const match = CONVENTIONAL.exec(subject);
    if (!match) return 'it should start with a lowercase type, a colon and a space, like "fix: ..."';
    if (allowed && !allowed.includes(match[1])) return `type "${match[1]}" is not allowed here`;
    return null;
}

function fixCommitsSteps(badCount: number, total: number, allowed: string[] | null): string[] {
    const reword =
        total === 1
            ? ['Rewrite the message: git commit --amend -m "fix: short description"']
            : [
                  `Open your commits for editing: git rebase -i HEAD~${total}`,
                  `Change "pick" to "reword" for the ${badCount === 1 ? "commit" : "commits"} listed below, save, and write new messages.`,
              ];
    return [...reword, ...allowedTypesHint(allowed), "Update the PR: git push --force-with-lease"];
}

function allowedTypesHint(allowed: string[] | null): string[] {
    return allowed ? [`Allowed types: ${allowed.join(", ")}`] : [];
}

function firstLine(message: string): string {
    return message.split("\n")[0].trim();
}
