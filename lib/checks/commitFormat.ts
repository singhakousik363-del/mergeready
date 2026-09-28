import type { PullRequestData } from "../github/fetchPullRequest";
import type { Rule } from "../rules/types";
import { evidenceOf, failStatus, plural, rulesOfType, shortSha, steps, type Check, type FixStep } from "./types";

// "type(scope)!: description" with a lowercase type, e.g. "fix(parser): handle tabs"
const CONVENTIONAL = /^([a-z]+)(?:\([^)]*\))?!?: \S/;
// "fs: fix leak", "test,stream: add case" (same pattern as in fromHistory.ts)
const PREFIX = /^[a-z0-9_./-]+(?:, ?[a-z0-9_./-]+)*: \S/;

type Format = ConventionalRule["details"]["format"];
const FORMAT_NAME: Record<Format, string> = { conventional: "Conventional Commits", prefix: 'the repo\'s "prefix: message" style' };
const FORMAT_SHAPE: Record<Format, string> = { conventional: '"type: description"', prefix: '"prefix: message"' };

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

    // A Conventional Commits rule (config, template, docs) beats a "prefix" habit
    const format: Format = conventional.some((r) => r.details.format === "conventional") ? "conventional" : "prefix";
    const used = conventional.filter((r) => r.details.format === format);
    const forCommits = used.filter((r) => r.details.appliesTo === "commits");
    const forTitle = used.filter((r) => r.details.appliesTo === "pr-title");
    const checks: Check[] = [];
    if (forCommits.length > 0) checks.push(checkCommits(forCommits, pr, format));
    if (forTitle.length > 0) checks.push(checkTitle(forTitle, pr, format));
    return checks;
}

function checkCommits(rules: ConventionalRule[], pr: PullRequestData, format: Format): Check {
    const allowed = allowedTypes(rules);
    // Merge commits ("Merge branch 'main' into ...") are made by git, not written
    const commits = pr.commits.filter((c) => !c.message.startsWith("Merge "));
    const problems = commits.flatMap((c) => {
        const subject = firstLine(c.message);
        const problem = findProblem(subject, allowed, format);
        return problem ? [`Commit ${shortSha(c.sha)} "${subject}": ${problem}`] : [];
    });

    const ok = problems.length === 0;
    return {
        id: "commit-format:commits",
        ruleType: "conventional-commits",
        stage: "commit",
        status: ok ? "pass" : failStatus(rules),
        message: ok
            ? commits.length === 1
                ? `The commit message follows ${FORMAT_NAME[format]}.`
                : `All ${commits.length} commit messages follow ${FORMAT_NAME[format]}.`
            : `${problems.length} of ${plural(commits.length, "commit message")} ${problems.length === 1 ? "doesn't" : "don't"} follow ${FORMAT_NAME[format]} (${FORMAT_SHAPE[format]}).`,
        howToFix: ok ? [] : fixCommitsSteps(problems.length, commits.length, allowed, format),
        evidence: { rules: evidenceOf(rules), observed: ok ? [`${plural(commits.length, "commit message")} checked`] : problems },
    };
}

function checkTitle(rules: ConventionalRule[], pr: PullRequestData, format: Format): Check {
    const allowed = allowedTypes(rules);
    const problem = findProblem(pr.title, allowed, format);
    return {
        id: "commit-format:pr-title",
        ruleType: "conventional-commits",
        stage: "pr",
        status: problem ? failStatus(rules) : "pass",
        message: problem
            ? `The PR title doesn't follow ${FORMAT_NAME[format]} (${FORMAT_SHAPE[format]}).`
            : `The PR title follows ${FORMAT_NAME[format]}.`,
        howToFix: problem
            ? [
                  ...steps(
                      'On the PR page, click "Edit" next to the title.',
                      format === "conventional"
                          ? `Change it to "type: description", e.g. "fix: correct typo in README".`
                          : `Change it to "prefix: message", using the same prefixes as the repo's recent commits (e.g. "doc: fix typo").`
                  ),
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
function findProblem(subject: string, allowed: string[] | null, format: Format): string | null {
    if (format === "prefix") {
        return PREFIX.test(subject) ? null : 'it should start with a lowercase prefix, a colon and a space, like "doc: ..."';
    }
    const match = CONVENTIONAL.exec(subject);
    if (!match) return 'it should start with a lowercase type, a colon and a space, like "fix: ..."';
    if (allowed && !allowed.includes(match[1])) return `type "${match[1]}" is not allowed here`;
    return null;
}

function fixCommitsSteps(badCount: number, total: number, allowed: string[] | null, format: Format): FixStep[] {
    const reword: FixStep[] =
        total === 1
            ? [
                  {
                      text: "Rewrite the message (replace the example with your own words):",
                      command:
                          format === "conventional"
                              ? 'git commit --amend -m "fix: short description"'
                              : 'git commit --amend -m "prefix: short description"',
                  },
              ]
            : [
                  { text: "Open your commits for editing:", command: `git rebase -i HEAD~${total}` },
                  {
                      text: `Change "pick" to "reword" for the ${badCount === 1 ? "commit" : "commits"} listed below, save, and write new messages.`,
                  },
              ];
    return [...reword, ...allowedTypesHint(allowed), { text: "Update the PR:", command: "git push --force-with-lease" }];
}

function allowedTypesHint(allowed: string[] | null): FixStep[] {
    return allowed ? steps(`Allowed types: ${allowed.join(", ")}`) : [];
}

function firstLine(message: string): string {
    return message.split("\n")[0].trim();
}
