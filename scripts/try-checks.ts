// Manual check of all checks against real GitHub (uses your real GITHUB_TOKEN).
// Run: node --env-file=.env.local --import tsx scripts/try-checks.ts [--user NAME] [issue or PR URL ...]
// Prints the journey map, every check with its evidence, and (for issues) the PR description.
import { runChecks, type CheckResults } from "../lib/checks/runChecks";
import { buildPrDescription } from "../lib/checks/prDescription";
import { fetchConfigFiles } from "../lib/github/fetchConfigFiles";
import { fetchGuidelines } from "../lib/github/fetchGuidelines";
import { fetchIssue, type IssueData } from "../lib/github/fetchIssue";
import { fetchPullRequest } from "../lib/github/fetchPullRequest";
import { fetchRecentCommits } from "../lib/github/fetchRecentCommits";
import { GitHubError } from "../lib/github/errors";
import { parseGithubUrl } from "../lib/github/parseUrl";
import { extractRules } from "../lib/rules/extractRules";

const DEFAULT_TARGETS = [
    // A first-time contributor's PR
    "https://github.com/stdlib-js/stdlib/pull/15585",
    // Good first issue with two competing PRs
    "https://github.com/stdlib-js/stdlib/issues/12959",
];

const ICON: Record<string, string> = { pass: "PASS", fail: "FAIL", warn: "WARN", manual: "MANUAL", pending: "PENDING", skip: "skip" };

function print(result: CheckResults): void {
    console.log("  JOURNEY: " + result.journey.map((s) => `${s.stage}=${ICON[s.status]} (${s.summary})`).join("  ->  "));
    for (const check of result.checks) {
        console.log(`  [${ICON[check.status]}] ${check.stage} / ${check.id}: ${check.message}`);
        if (check.status === "skip" || check.status === "pass") continue;
        for (const seen of check.evidence.observed) console.log(`      seen: ${seen}`);
        for (const rule of check.evidence.rules.slice(0, 2)) console.log(`      rule [${rule.confidence}]: "${rule.sourceQuote}" ${rule.sourceUrl}`);
        for (const step of check.howToFix) console.log(`      fix: ${step.text}${step.command ? `  $ ${step.command}` : ""}`);
    }
    for (const warning of result.warnings) console.log(`  WARNING: ${warning}`);
}

async function run(url: string, username: string | null): Promise<void> {
    const parsed = parseGithubUrl(url);
    if (!parsed.ok) {
        console.log(`  ERROR ${parsed.error}`);
        return;
    }
    const { owner, repo, number } = parsed;

    // Everything about the repo's rules, fetched at the same time
    const [guidelines, configFiles, history] = await Promise.all([
        fetchGuidelines(owner, repo),
        fetchConfigFiles(owner, repo),
        fetchRecentCommits(owner, repo),
    ]);
    const { rules } = extractRules(guidelines, configFiles, history, `https://github.com/${owner}/${repo}`);
    console.log(`  (${rules.length} rules found)`);

    if (parsed.type === "issue") {
        const issue = await fetchIssue(owner, repo, number);
        print(runChecks({ mode: "issue", rules, issue, username, now: new Date() }));
        console.log("  PR DESCRIPTION TO COPY:");
        const description = buildPrDescription({ template: guidelines.prTemplate, issueNumber: number });
        for (const line of description.split("\n")) console.log(`    | ${line}`);
        return;
    }

    const pr = await fetchPullRequest(owner, repo, number);
    // The first issue the PR fixes, for the "assigned to you?" check
    let linkedIssue: IssueData | null = null;
    if (pr.linkedIssues.length > 0) {
        try {
            linkedIssue = await fetchIssue(owner, repo, pr.linkedIssues[0]);
        } catch {
            console.log(`  (couldn't load issue #${pr.linkedIssues[0]})`);
        }
    }
    print(runChecks({ mode: "pr", rules, pr, linkedIssue }));
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const userIndex = args.indexOf("--user");
    const username = userIndex >= 0 ? (args[userIndex + 1] ?? null) : null;
    const urls = args.filter((_, i) => userIndex < 0 || (i !== userIndex && i !== userIndex + 1));

    for (const url of urls.length > 0 ? urls : DEFAULT_TARGETS) {
        console.log(`\n${url}`);
        try {
            await run(url, username);
        } catch (err) {
            // Only print our friendly message, never the raw error (could contain request details)
            const message = err instanceof GitHubError ? `${err.code}: ${err.message}` : "Unexpected error";
            console.log(`  ERROR ${message}`);
        }
    }
}

void main();
