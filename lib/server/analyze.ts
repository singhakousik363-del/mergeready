import type { Octokit } from "@octokit/rest";
import { buildPrDescription } from "../checks/prDescription";
import { WORST_FIRST, type JourneyStep } from "../checks/journey";
import { runChecks, type CheckResults } from "../checks/runChecks";
import type { Check, CheckStatus } from "../checks/types";
import { createOctokit } from "../github/client";
import { fetchConfigFiles, type ConfigFiles } from "../github/fetchConfigFiles";
import { fetchGuidelines, type Guidelines } from "../github/fetchGuidelines";
import { fetchIssue, type IssueData } from "../github/fetchIssue";
import { fetchPullRequest, type PullRequestData } from "../github/fetchPullRequest";
import { fetchRecentCommits, type RecentCommits } from "../github/fetchRecentCommits";
import { extractRules, type ExtractedRules } from "../rules/extractRules";
import type { GuideSection } from "../rules/sections";
import type { Rule } from "../rules/types";
import { TtlCache } from "./cache";
import { BudgetExceededError } from "./httpErrors";
import type { AnalyzeInput } from "./validateInput";

// The whole analysis must finish within this time (the route's maxDuration is 30s)
export const BUDGET_MS = 25_000;
export const RULES_TTL_MS = 10 * 60_000;
export const TARGET_TTL_MS = 60_000;

// ---------- what the browser gets ----------

export type StageGroup = JourneyStep & { checks: Check[] };

export type AnalyzeResponse = {
    ok: true;
    kind: "issue" | "pr";
    repo: { owner: string; repo: string; url: string };
    target: { number: number; title: string; url: string; state: string; author: string | null };
    journey: JourneyStep[];
    // The same five stages, each with its checks (worst first)
    stages: StageGroup[];
    // Every rule we found, so nothing is hidden
    rules: Rule[];
    sections: GuideSection[];
    // For an issue: a description to start the PR with. For a PR: a suggestion
    // (the PR already has one), so it's labelled differently.
    prDescription: { label: "PR description" | "Suggested description"; text: string };
    warnings: string[];
    meta: { analyzedAt: string; durationMs: number; cached: { rules: boolean; target: boolean } };
};

// ---------- dependencies (real ones by default, fakes in tests) ----------

type WithOctokit = { octokit: Octokit };

export type Fetchers = {
    fetchGuidelines: (owner: string, repo: string, options: WithOctokit) => Promise<Guidelines>;
    fetchConfigFiles: (owner: string, repo: string, options: WithOctokit) => Promise<ConfigFiles>;
    fetchRecentCommits: (owner: string, repo: string, options: WithOctokit) => Promise<RecentCommits>;
    fetchIssue: (owner: string, repo: string, number: number, options: WithOctokit) => Promise<IssueData>;
    fetchPullRequest: (owner: string, repo: string, number: number, options: WithOctokit) => Promise<PullRequestData>;
};

// What we keep per repo: the rules plus the bits of the guidelines the response needs
export type RepoRules = { extracted: ExtractedRules; prTemplate: string | null; guidelineWarnings: string[] };

export type Caches = {
    rules: TtlCache<RepoRules>;
    issues: TtlCache<IssueData>;
    prs: TtlCache<PullRequestData>;
};

export type AnalyzeDeps = {
    fetchers: Fetchers;
    // One GitHub client per analysis; the signal cancels all its requests
    createClient: (signal: AbortSignal) => Octokit;
    caches: Caches;
    now: () => Date;
    budgetMs: number;
};

export function createCaches(): Caches {
    return {
        rules: new TtlCache<RepoRules>(RULES_TTL_MS),
        issues: new TtlCache<IssueData>(TARGET_TTL_MS),
        prs: new TtlCache<PullRequestData>(TARGET_TTL_MS),
    };
}

// Module-level, so they survive between requests while the server instance is warm
const sharedCaches = createCaches();

export const defaultDeps: AnalyzeDeps = {
    fetchers: { fetchGuidelines, fetchConfigFiles, fetchRecentCommits, fetchIssue, fetchPullRequest },
    createClient: (signal) => createOctokit({ signal }),
    caches: sharedCaches,
    now: () => new Date(),
    budgetMs: BUDGET_MS,
};

// ---------- the analysis ----------

// Runs everything for one issue or PR link, within the time budget.
// Called by the API route, and directly by scripts (so they never hit our rate limit).
export async function analyze(input: AnalyzeInput, deps: AnalyzeDeps = defaultDeps): Promise<AnalyzeResponse> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const budget = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
            // Cancel every GitHub request still running, then give up
            controller.abort();
            reject(new BudgetExceededError(Math.round(deps.budgetMs / 1000)));
        }, deps.budgetMs);
    });

    const work = run(input, deps, controller.signal);
    // If the budget wins, `work` fails later (cancelled requests). Nobody waits
    // for it then, so catch it here to avoid an "unhandled rejection".
    work.catch(() => {});

    try {
        return await Promise.race([work, budget]);
    } finally {
        clearTimeout(timer);
    }
}

async function run(input: AnalyzeInput, deps: AnalyzeDeps, signal: AbortSignal): Promise<AnalyzeResponse> {
    const started = deps.now().getTime();
    const { owner, repo, number } = input;
    const octokit = deps.createClient(signal);
    const { fetchers, caches } = deps;
    // GitHub names don't care about letter case, so neither does the cache
    const repoKey = `${owner}/${repo}`.toLowerCase();
    const targetKey = `${repoKey}#${number}`;

    // Rules and the issue/PR don't depend on each other: start both now
    const rules = caches.rules.getOrLoad(repoKey, () => loadRules(owner, repo, octokit, fetchers));

    if (input.kind === "issue") {
        const issue = caches.issues.getOrLoad(targetKey, () => fetchers.fetchIssue(owner, repo, number, { octokit }));
        const [repoRules, issueData] = await Promise.all([rules.value, issue.value]);

        return buildResponse({
            input,
            repoRules,
            results: runChecks({
                mode: "issue",
                rules: repoRules.extracted.rules,
                issue: issueData,
                username: input.username,
                now: deps.now(),
            }),
            target: { number, title: issueData.title, url: issueData.url, state: issueData.state, author: null },
            prDescription: {
                label: "PR description",
                text: buildPrDescription({ template: repoRules.prTemplate, issueNumber: number }),
            },
            extraWarnings: [],
            cached: { rules: rules.hit, target: issue.hit },
            started,
            now: deps.now(),
        });
    }

    const pr = caches.prs.getOrLoad(targetKey, () => fetchers.fetchPullRequest(owner, repo, number, { octokit }));
    const [repoRules, prData] = await Promise.all([rules.value, pr.value]);

    // The first issue the PR fixes, for the "assigned to you?" check.
    // It's a bonus: if it fails, the analysis still works (the check says "manual").
    let linkedIssue: IssueData | null = null;
    let linkedCached = true;
    const extraWarnings: string[] = [];
    const linkedNumber = prData.linkedIssues[0];
    if (linkedNumber !== undefined) {
        const linked = caches.issues.getOrLoad(`${repoKey}#${linkedNumber}`, () =>
            fetchers.fetchIssue(owner, repo, linkedNumber, { octokit })
        );
        linkedCached = linked.hit;
        try {
            linkedIssue = await linked.value;
        } catch {
            extraWarnings.push(`Couldn't load issue #${linkedNumber}, so its assignee wasn't checked.`);
        }
    }

    return buildResponse({
        input,
        repoRules,
        results: runChecks({ mode: "pr", rules: repoRules.extracted.rules, pr: prData, linkedIssue }),
        target: {
            number,
            title: prData.title,
            url: prData.url,
            state: prData.draft ? "draft" : prData.state,
            author: prData.author,
        },
        prDescription: {
            label: "Suggested description",
            text: buildPrDescription({ template: repoRules.prTemplate, issueNumber: linkedNumber ?? null }),
        },
        extraWarnings,
        cached: { rules: rules.hit, target: pr.hit && linkedCached },
        started,
        now: deps.now(),
    });
}

type ResponseParts = {
    input: AnalyzeInput;
    repoRules: RepoRules;
    results: CheckResults;
    target: AnalyzeResponse["target"];
    prDescription: AnalyzeResponse["prDescription"];
    extraWarnings: string[];
    // hit = no GitHub calls were needed for that part
    cached: { rules: boolean; target: boolean };
    started: number;
    now: Date;
};

function buildResponse(parts: ResponseParts): AnalyzeResponse {
    const { input, repoRules, results } = parts;
    return {
        ok: true,
        kind: input.kind,
        repo: { owner: input.owner, repo: input.repo, url: `https://github.com/${input.owner}/${input.repo}` },
        target: parts.target,
        journey: results.journey,
        stages: groupByStage(results.journey, results.checks),
        rules: repoRules.extracted.rules,
        sections: repoRules.extracted.sections,
        prDescription: parts.prDescription,
        // The same warning can come from two places: show it once
        warnings: [
            ...new Set([
                ...repoRules.guidelineWarnings,
                ...repoRules.extracted.warnings,
                ...results.warnings,
                ...parts.extraWarnings,
            ]),
        ],
        meta: {
            analyzedAt: parts.now.toISOString(),
            durationMs: parts.now.getTime() - parts.started,
            cached: parts.cached,
        },
    };
}

// Everything about the repo's rules, fetched at the same time
async function loadRules(owner: string, repo: string, octokit: Octokit, fetchers: Fetchers): Promise<RepoRules> {
    const [guidelines, configFiles, history] = await Promise.all([
        fetchers.fetchGuidelines(owner, repo, { octokit }),
        fetchers.fetchConfigFiles(owner, repo, { octokit }),
        fetchers.fetchRecentCommits(owner, repo, { octokit }),
    ]);
    return {
        extracted: extractRules(guidelines, configFiles, history, `https://github.com/${owner}/${repo}`),
        prTemplate: guidelines.prTemplate,
        guidelineWarnings: guidelines.warnings,
    };
}

function groupByStage(journey: JourneyStep[], checks: Check[]): StageGroup[] {
    const rank = (status: CheckStatus) => WORST_FIRST.indexOf(status);
    return journey.map((step) => ({
        ...step,
        // Worst first, so problems are at the top (sort keeps the original order for ties)
        checks: checks.filter((c) => c.stage === step.stage).sort((a, b) => rank(a.status) - rank(b.status)),
    }));
}
