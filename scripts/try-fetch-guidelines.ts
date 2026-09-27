// Manual check against real GitHub repos (uses your real GITHUB_TOKEN).
// Run: node --env-file=.env.local --import tsx scripts/try-fetch-guidelines.ts [owner/repo ...]
import { fetchGuidelines } from "../lib/github/fetchGuidelines";
import { GitHubError } from "../lib/github/errors";

const DEFAULT_REPOS = ["facebook/react", "nodejs/node", "stdlib-js/stdlib"];

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

async function main(): Promise<void> {
    const repos = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_REPOS;

    for (const fullName of repos) {
        const [owner, repo] = fullName.split("/");
        console.log(`\n${fullName}`);
        try {
            const result = await fetchGuidelines(owner ?? "", repo ?? "");
            describeFile("CONTRIBUTING", result.contributing, result.sources.contributing);
            describeFile("PR template ", result.prTemplate, result.sources.prTemplate);
            console.log(`  Linked docs followed: ${result.extraDocs.length}`);
            for (const doc of result.extraDocs) {
                console.log(`    - "${doc.linkText}" -> ${doc.source} (${Math.round(Buffer.byteLength(doc.text) / 1024)}KB)`);
            }
            for (const warning of result.warnings) console.log(`  WARNING: ${warning}`);
        } catch (err) {
            // Only print our friendly message, never the raw error (could contain request details)
            const message = err instanceof GitHubError ? `${err.code}: ${err.message}` : "Unexpected error";
            console.log(`  ERROR ${message}`);
        }
    }
}

void main();
