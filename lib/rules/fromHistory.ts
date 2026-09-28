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
// "subsystem: message" format (learned separately as "prefix" below).
const CONVENTIONAL_SUBJECT = new RegExp(`^(?:${CONVENTIONAL_TYPES.join("|")})(?:\\([^)]*\\))?!?: \\S`);
// "fs: fix leak", "test,stream: add case": a lowercase prefix (or several,
// joined by commas), a colon and a space. nodejs/node calls it "subsystem: message".
const PREFIX_SUBJECT = /^[a-z0-9_./-]+(?:, ?[a-z0-9_./-]+)*: \S/;
// Signs that a commit was written when the PR was merged, not by the author:
// GitHub's squash merge adds " (#123)" to the title; some repos' landing
// tools add a "PR-URL:" trailer (stdlib, nodejs/node)
const PR_NUMBER_SUFFIX = /\(#\d+\)$/;
const PR_URL_TRAILER = /^PR-URL: *(\S+)/m;

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

    const fromMerges = writtenAtMerge(counted);
    // Messages written at merge time are usually the PR title
    const appliesTo = fromMerges ? "pr-title" : "commits";
    const mergeNote = fromMerges ? "; most were written when the PR was merged, so the PR title matters most" : "";
    // Conventional Commits is the more exact format, so it wins when both fit
    const conventional = counted.filter((c) => CONVENTIONAL_SUBJECT.test(subject(c))).length;
    const prefixed = counted.filter((c) => PREFIX_SUBJECT.test(subject(c))).length;
    if (isHabit(conventional)) {
        rules.push({
            type: "conventional-commits",
            details: { format: "conventional", appliesTo, allowedTypes: null },
            confidence: "history",
            sourceQuote: `${conventional} of the last ${total} commits (not counting merges and bots) follow Conventional Commits${mergeNote}`,
            sourceUrl,
            strict: false,
        });
    } else if (isHabit(prefixed)) {
        rules.push({
            type: "conventional-commits",
            details: { format: "prefix", appliesTo, allowedTypes: null },
            confidence: "history",
            sourceQuote: `${prefixed} of the last ${total} commits (not counting merges and bots) start with a lowercase "prefix: " (like "fs: fix leak")${mergeNote}`,
            sourceUrl,
            strict: false,
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
            strict: false,
        });
    }
    return { rules, warnings: [] };
}

// Were most commit messages written when the PR was merged (so they come from
// the PR title)? A " (#123)" suffix means a squash merge. A "PR-URL:" trailer
// only means a landing tool was used: if two commits share one PR-URL, the
// PR's own commits were kept (nodejs/node), so the commits matter, not the title.
function writtenAtMerge(commits: RecentCommit[]): boolean {
    const prUrls = commits.flatMap((c) => PR_URL_TRAILER.exec(c.message)?.[1] ?? []);
    const commitsKept = new Set(prUrls).size < prUrls.length;
    const mergeTime = commits.filter(
        (c) => PR_NUMBER_SUFFIX.test(subject(c)) || (!commitsKept && PR_URL_TRAILER.test(c.message))
    );
    return mergeTime.length > commits.length / 2;
}

function subject(commit: RecentCommit): string {
    return commit.message.split("\n")[0].trim();
}
