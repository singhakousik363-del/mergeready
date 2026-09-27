// Manual check against real GitHub (uses your real GITHUB_TOKEN).
// Run: node --env-file=.env.local --import tsx scripts/try-github.ts [owner/repo | issue URL | PR URL ...]
import { fetchGuidelines } from "../lib/github/fetchGuidelines";
import { fetchIssue } from "../lib/github/fetchIssue";
import { fetchPullRequest } from "../lib/github/fetchPullRequest";
import { parseGithubUrl } from "../lib/github/parseUrl";
import { GitHubError } from "../lib/github/errors";

const DEFAULT_TARGETS = [
    "facebook/react",
    "nodejs/node",
    "stdlib-js/stdlib",
    // Good first issue with two competing PRs from newcomers
    "https://github.com/stdlib-js/stdlib/issues/12959",
    // A first-time contributor's PR (GitHub labels the author "NONE")
    "https://github.com/stdlib-js/stdlib/pull/15585",
];

function describeFile(label: string, text: string | null, source: string | null): void {
    if (text === null) {
        console.log(`  ${label}: not found`);
        return;
    }
    const words = text.split(/\s+/).filter(Boolean).length;
    // Markdown links like [text](./doc/x.md) that point to other docs
    const docLinks = text.match(/\]\([^)]*\.(md|markdown|rst)(#[^)]*)?\)/gi) ?? [];
    const firstLine = text.split("\n").find((line) => line.trim() !== "") ?? "";

    console.log(`  ${label}: ${source}`);
    console.log(`    ${text.length} chars, ${words} words, first line: ${firstLine.trim().slice(0, 70)}`);
    console.log(`    links to other docs: ${docLinks.length}`);
}

async function showGuidelines(owner: string, repo: string): Promise<void> {
    const result = await fetchGuidelines(owner, repo);
    describeFile("CONTRIBUTING", result.contributing, result.sources.contributing);
    describeFile("PR template ", result.prTemplate, result.sources.prTemplate);
    console.log(`  Linked docs followed: ${result.extraDocs.length}`);
    for (const doc of result.extraDocs) {
        console.log(`    - "${doc.linkText}" -> ${doc.source} (${Math.round(Buffer.byteLength(doc.text) / 1024)}KB)`);
    }
    for (const warning of result.warnings) console.log(`  WARNING: ${warning}`);
}

async function showIssue(owner: string, repo: string, number: number): Promise<void> {
    const issue = await fetchIssue(owner, repo, number);
    console.log(`  Issue: "${issue.title}" (${issue.state})`);
    console.log(`  Labels: ${issue.labels.join(", ") || "none"}`);
    console.log(`  Assignees: ${issue.assignees.join(", ") || "nobody"}`);
    console.log(`  Comments: ${issue.comments.length}`);
    for (const c of issue.comments) {
        const firstLine = c.body.split("\n").find((line) => line.trim() !== "") ?? "";
        console.log(`    - ${c.createdAt.slice(0, 10)} ${c.author}: ${firstLine.trim().slice(0, 60)}`);
    }
    console.log(`  Open PRs mentioning it: ${issue.openPullRequests.length}`);
    for (const pr of issue.openPullRequests) {
        console.log(`    - #${pr.number} by ${pr.author}${pr.draft ? " (draft)" : ""}: ${pr.title}`);
    }
    console.log(`  Repo: archived=${issue.repoActivity.archived}, last push ${issue.repoActivity.pushedAt}`);
    for (const warning of issue.warnings) console.log(`  WARNING: ${warning}`);
}

async function showPullRequest(owner: string, repo: string, number: number): Promise<void> {
    const pr = await fetchPullRequest(owner, repo, number);
    console.log(`  PR: "${pr.title}" (${pr.state}${pr.draft ? ", draft" : ""})`);
    console.log(`  Author: ${pr.author}, author_association=${pr.authorAssociation}`);
    console.log(`  Merged PRs in repo before: ${pr.mergedPrCountInRepo ?? "unknown"} -> new contributor: ${pr.isNewContributor}`);
    console.log(`  Base: ${pr.baseBranch} (default branch: ${pr.targetsDefaultBranch})`);
    console.log(`  Linked issues: ${pr.linkedIssues.map((n) => `#${n}`).join(", ") || "none"}`);
    console.log(`  Commits: ${pr.commits.length}`);
    for (const c of pr.commits) {
        console.log(`    - ${c.message.split("\n")[0].slice(0, 60)} | sign-off: ${c.hasSignOff ? "yes" : "no"}`);
    }
    const byStatus = new Map<string, number>();
    for (const f of pr.files) byStatus.set(f.status, (byStatus.get(f.status) ?? 0) + 1);
    console.log(`  Files: ${pr.files.length} (${[...byStatus].map(([s, n]) => `${n} ${s}`).join(", ")})`);
    for (const warning of pr.warnings) console.log(`  WARNING: ${warning}`);
}

async function main(): Promise<void> {
    const targets = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_TARGETS;

    for (const target of targets) {
        console.log(`\n${target}`);
        try {
            if (target.startsWith("http")) {
                const parsed = parseGithubUrl(target);
                if (!parsed.ok) {
                    console.log(`  ERROR ${parsed.error}`);
                    continue;
                }
                const show = parsed.type === "issue" ? showIssue : showPullRequest;
                await show(parsed.owner, parsed.repo, parsed.number);
            } else {
                const [owner, repo] = target.split("/");
                await showGuidelines(owner ?? "", repo ?? "");
            }
        } catch (err) {
            // Only print our friendly message, never the raw error (could contain request details)
            const message = err instanceof GitHubError ? `${err.code}: ${err.message}` : "Unexpected error";
            console.log(`  ERROR ${message}`);
        }
    }
}

void main();
