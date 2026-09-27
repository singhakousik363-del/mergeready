// Manual check of rule extraction against real GitHub (uses your real GITHUB_TOKEN).
// Run: node --env-file=.env.local --import tsx scripts/try-rules.ts [owner/repo ...]
// Prints every rule with its quote and link, so you can check them by hand.
import { fetchConfigFiles } from "../lib/github/fetchConfigFiles";
import { fetchGuidelines } from "../lib/github/fetchGuidelines";
import { GitHubError } from "../lib/github/errors";
import { extractRules } from "../lib/rules/extractRules";
import type { Rule } from "../lib/rules/types";

const DEFAULT_TARGETS = ["stdlib-js/stdlib", "nodejs/node", "conventional-changelog/commitlint"];

function describeDetails(rule: Rule): string {
    switch (rule.type) {
        case "conventional-commits": {
            const types = rule.details.allowedTypes?.join(", ") ?? "any (not listed)";
            return `applies to ${rule.details.appliesTo}; types: ${types}`;
        }
        case "pr-template":
            return rule.details.kind === "section"
                ? `section${rule.details.optional ? " (optional)" : ""}`
                : `checkbox, group ${rule.details.groupId}: ${rule.details.requirement}`;
        default:
            return "";
    }
}

async function showRules(owner: string, repo: string): Promise<void> {
    const started = Date.now();
    // Independent requests: run them at the same time
    const [guidelines, configFiles] = await Promise.all([fetchGuidelines(owner, repo), fetchConfigFiles(owner, repo)]);
    const result = extractRules(guidelines, configFiles);
    console.log(`  (fetched in ${Date.now() - started}ms; ${configFiles.files.length} config/workflow files read)`);

    console.log(`  RULES: ${result.rules.length}`);
    for (const rule of result.rules) {
        const details = describeDetails(rule);
        console.log(`  - [${rule.confidence}] ${rule.type}${details ? ` (${details})` : ""}`);
        console.log(`      "${rule.sourceQuote}"`);
        console.log(`      ${rule.sourceUrl}`);
    }

    console.log(`  READ THIS YOURSELF: ${result.sections.length} sections`);
    for (const section of result.sections) {
        const size = `${section.text.length} chars${section.truncated ? ", truncated" : ""}`;
        console.log(`  - ${section.heading} (${size})`);
        console.log(`      ${section.sourceUrl}`);
    }

    for (const warning of [...guidelines.warnings, ...result.warnings]) console.log(`  WARNING: ${warning}`);
}

async function main(): Promise<void> {
    const targets = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_TARGETS;

    for (const target of targets) {
        console.log(`\n${target}`);
        try {
            const [owner, repo] = target.split("/");
            await showRules(owner ?? "", repo ?? "");
        } catch (err) {
            // Only print our friendly message, never the raw error (could contain request details)
            const message = err instanceof GitHubError ? `${err.code}: ${err.message}` : "Unexpected error";
            console.log(`  ERROR ${message}`);
        }
    }
}

void main();
