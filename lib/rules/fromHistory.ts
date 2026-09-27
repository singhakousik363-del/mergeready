import { SIGN_OFF_LINE } from "../github/fetchPullRequest";
import type { RecentCommit } from "../github/fetchRecentCommits";
import { CONVENTIONAL_TYPES } from "./fromConfig";
import type { Rule } from "./types";

// Need at least this many human commits (not merges, not bots) to judge
export const MIN_COMMITS = 15;
// Share of those commits that must follow a habit to call it a rule
export const THRESHOLD = 0.9;

// "feat: x", "fix(parser)!: y". Only real Conventional Commits types count:
// nodejs/node writes "test: ..." and "src: ...", which is its own
// "subsystem: message" format, not Conventional Commits.
const CONVENTIONAL_SUBJECT = new RegExp(`^(?:${CONVENTIONAL_TYPES.join("|")})(?:\\([^)]*\\))?!?: \\S`);
// Signs that a commit was written when the PR was merged, not by the author:
// GitHub's squash merge adds " (#123)" to the title; some repos' landing
// tools add a "PR-URL:" trailer (stdlib, nodejs/node)
const PR_NUMBER_SUFFIX = /\(#\d+\)$/;
const PR_URL_TRAILER = /^PR-URL: /m;

export type HistoryRules = { rules: Rule[]; warnings: string[] };

// Learns the repo's habits from its newest commits. These rules only mean
// "this is what the repo usually does", so checks show them as yellow
// ("recommended"), never red.
// repoUrl = "https://github.com/owner/repo"
export function extractHistoryRules(commits: RecentCommit[], repoUrl: string): HistoryRules {
    const counted = commits.filter((c) => !c.isMerge && !c.isBot);
    if (commits.length === 0) return { rules: [], warnings: [] };
    if (counted.length < MIN_COMMITS) {
        return {
            rules: [],
            warnings: [
                `Only ${counted.length} of the last ${commits.length} commits were made by people (not merges or bots), ` +
                    "which is too few to learn the repo's commit habits.",
            ],
        };
    }

    const total = counted.length;
    // The history page starting at the newest commit we read. A fixed commit
    // (not the branch name), so the page still shows these commits later.
    const sourceUrl = `${repoUrl}/commits/${commits[0].sha}`;
    const rules: Rule[] = [];
    const isHabit = (matching: number) => matching / total >= THRESHOLD;

    const conventional = counted.filter((c) => CONVENTIONAL_SUBJECT.test(subject(c))).length;
    if (isHabit(conventional)) {
        const mergeTime = counted.filter((c) => PR_NUMBER_SUFFIX.test(subject(c)) || PR_URL_TRAILER.test(c.message));
        const fromMerges = mergeTime.length > total / 2;
        rules.push({
            type: "conventional-commits",
            // Messages written at merge time are usually the PR title
            details: { appliesTo: fromMerges ? "pr-title" : "commits", allowedTypes: null },
            confidence: "history",
            sourceQuote:
                `${conventional} of the last ${total} commits (not counting merges and bots) follow Conventional Commits` +
                (fromMerges ? "; most were written when the PR was merged, so the PR title matters most" : ""),
            sourceUrl,
        });
    }

    const signedOff = counted.filter((c) => SIGN_OFF_LINE.test(c.message)).length;
    if (isHabit(signedOff)) {
        rules.push({
            type: "dco-signoff",
            details: null,
            confidence: "history",
            sourceQuote: `${signedOff} of the last ${total} commits (not counting merges and bots) have a Signed-off-by line`,
            sourceUrl,
        });
    }
    return { rules, warnings: [] };
}

function subject(commit: RecentCommit): string {
    return commit.message.split("\n")[0].trim();
}
