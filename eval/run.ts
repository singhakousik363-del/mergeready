// Runs the evaluation one stage at a time. Uses your real GITHUB_TOKEN; every
// GitHub answer is cached in eval/.cache, so running a stage again is free.
//   node --env-file=.env.local --import tsx eval/run.ts select [main|heldout]
//   ... eval/run.ts evaluate main after-fixes   (writes eval/results.after-fixes.json)
import { execSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { CUTOFF, DATA_DIR, EVAL_DIR, HELDOUT, PER_REPO, REPOS, repoKey } from "./config";
import { createCachedGitHub } from "./github";
import { labelingMarkdown, labelsTemplate, type LabelsFile } from "./labelingDoc";
import { CATEGORY_RULE, finalCategories, score, type Pair, type Scores } from "./metrics";
import { reconstructPr } from "./reconstruct";
import { buildReport } from "./report";
import { loadRepoFiles, RULE_TYPES, runTool, type ToolResult } from "./runTool";
import { selectRepo, type RepoSelection } from "./select";
import { findBoilerplate, suggestLabels } from "./suggestLabels";
import type { Snapshots } from "./types";

export type Results = {
    labelsCommit: string;
    // The MergeReady version that was run (lib/ must have no uncommitted changes)
    toolCommit: string;
    tool: ToolResult[];
    pairs: Pair[];
    overall: Scores;
    byRuleType: Record<string, Scores>;
    byRepo: Record<string, Scores>;
    notCheckableByRepo: Record<string, number>;
};

const REPORT_FILE = path.join(EVAL_DIR, "REPORT.md");

export type Dataset = { rules: string; cutoff: string; perRepo: number; repos: RepoSelection[]; windowStart?: string };

// "main": the 80 PRs up to 14 Sep. "heldout": PRs from 15-18 Sep, chosen
// after MergeReady was frozen (see the addendum in SELECTION.md).
type SetName = "main" | "heldout";
const SET: SetName = process.argv[3] === "heldout" ? "heldout" : "main";
const SET_DIR = SET === "main" ? DATA_DIR : path.join(DATA_DIR, "heldout");
const DATASET_FILE = path.join(SET_DIR, "dataset.json");
const SNAPSHOTS_FILE = path.join(SET_DIR, "snapshots.json");
const SUGGESTED_FILE = path.join(SET_DIR, "labels.suggested.json");
const LABELS_FILE = path.join(SET_DIR, "labels.json");
const LABELING_FILE = path.join(EVAL_DIR, SET === "main" ? "LABELING.md" : "LABELING-heldout.md");
// results.json, results.after-fixes.json, results.heldout.json
const RESULTS_NAME = [SET === "main" ? null : SET, process.argv[4] ?? null].filter(Boolean).join(".");
const RESULTS_FILE = path.join(EVAL_DIR, RESULTS_NAME ? `results.${RESULTS_NAME}.json` : "results.json");

async function stageSelect(): Promise<void> {
    const gh = createCachedGitHub();
    const repos: RepoSelection[] = [];
    for (const repo of REPOS) {
        console.log(`\n${repoKey(repo)}`);
        const selection =
            SET === "main"
                ? await selectRepo(gh, repo)
                : await selectRepo(gh, repo, { perRepo: HELDOUT.perRepo, start: HELDOUT.start, end: HELDOUT.end });
        console.log(`  kept ${selection.prs.length} of ${selection.scanned} scanned; skipped ${JSON.stringify(selection.skipped)}`);
        repos.push(selection);
    }
    const dataset: Dataset =
        SET === "main"
            ? { rules: "eval/SELECTION.md", cutoff: CUTOFF, perRepo: PER_REPO, repos }
            : { rules: "eval/SELECTION.md (held-out addendum)", windowStart: HELDOUT.start, cutoff: HELDOUT.end, perRepo: HELDOUT.perRepo, repos };
    writeJson(DATASET_FILE, dataset);
    console.log(`\nwrote ${DATASET_FILE} (GitHub: ${gh.stats.fetched} fetched, ${gh.stats.cached} from cache)`);
}

async function stageReconstruct(): Promise<void> {
    const gh = createCachedGitHub();
    const dataset = readJson<Dataset>(DATASET_FILE);
    const out: Snapshots = { snapshots: [], excluded: [] };
    for (const { repo, prs } of dataset.repos) {
        for (const pr of prs) {
            // One broken PR must not stop the run: it's excluded with the reason
            const result = await reconstructPr(gh, repo, pr.number).catch((err: unknown) => ({
                repo,
                number: pr.number,
                url: pr.url,
                reason: `Error while rebuilding: ${err instanceof Error ? err.message : "unknown"}`,
            }));
            if ("reason" in result) {
                out.excluded.push(result);
                console.log(`  EXCLUDED ${repoKey(repo)}#${pr.number}: ${result.reason}`);
            } else {
                out.snapshots.push(result);
                const r = result.reconstruction;
                console.log(`  ${repoKey(repo)}#${pr.number}: body ${r.body}, title ${r.title}, commits ${r.commits} (${result.original.commits.length} kept, ${r.laterCommitsLeftOut} later)`);
            }
        }
    }
    writeJson(SNAPSHOTS_FILE, out);
    console.log(`\nwrote ${SNAPSHOTS_FILE}: ${out.snapshots.length} rebuilt, ${out.excluded.length} excluded (GitHub: ${gh.stats.fetched} fetched, ${gh.stats.cached} from cache)`);
}

// No GitHub calls: works only on the rebuilt snapshots
async function stageSuggest(): Promise<void> {
    const { snapshots } = readJson<Snapshots>(SNAPSHOTS_FILE);
    const boilerplate = findBoilerplate(snapshots);
    const entries = snapshots.map((snapshot) => ({ snapshot, suggestions: suggestLabels(snapshot, boilerplate) }));

    writeJson(SUGGESTED_FILE, entries.map(({ snapshot, suggestions }) => ({ pr: `${repoKey(snapshot.repo)}#${snapshot.number}`, suggestions })));
    writeFileSync(LABELING_FILE, labelingMarkdown(entries, boilerplate));
    // Never overwrite decisions someone already made
    if (existsSync(LABELS_FILE)) {
        console.log(`kept existing ${LABELS_FILE} (delete it to start the review over)`);
    } else {
        writeJson(LABELS_FILE, labelsTemplate(entries));
    }

    const count: Record<string, number> = {};
    for (const e of entries) for (const s of e.suggestions) count[s.category] = (count[s.category] ?? 0) + 1;
    console.log(`suggestions by category: ${JSON.stringify(count)}`);
    console.log(`PRs with none: ${entries.filter((e) => e.suggestions.length === 0).length}; boilerplate bot texts: ${boilerplate.size}`);
    console.log(`wrote ${LABELING_FILE}, ${SUGGESTED_FILE}`);
}

// Runs MergeReady on every rebuilt PR and scores it against the locked labels
async function stageEvaluate(): Promise<void> {
    // The labels must be final: all reviewed and committed, with no later edits
    const labels = readJson<LabelsFile>(LABELS_FILE);
    if (labels.prs.some((p) => !p.reviewed)) throw new Error("Some PRs are not reviewed yet.");
    if (execSync(`git status --porcelain -- ${LABELS_FILE}`).toString().trim() !== "") {
        throw new Error("labels.json has changes that are not committed. Lock (commit) the labels first.");
    }
    const labelsCommit = execSync(`git log -1 --format=%h -- ${LABELS_FILE}`).toString().trim();
    // The tool must be a committed version, so the result names exactly what was run
    if (execSync("git status --porcelain -- lib").toString().trim() !== "") {
        throw new Error("lib/ has changes that are not committed. Commit (freeze) MergeReady first.");
    }
    const toolCommit = execSync("git log -1 --format=%h -- lib").toString().trim();

    const gh = createCachedGitHub();
    const { snapshots } = readJson<Snapshots>(SNAPSHOTS_FILE);
    const labelsByPr = new Map(labels.prs.map((p) => [p.pr, p]));
    const tool: ToolResult[] = [];
    const pairs: Pair[] = [];
    const notCheckableByRepo: Record<string, number> = {};

    for (const repo of REPOS) {
        const files = await loadRepoFiles(gh, repo);
        for (const snapshot of snapshots.filter((s) => repoKey(s.repo) === repoKey(repo))) {
            const result = await runTool(gh, snapshot, files);
            tool.push(result);
            const label = labelsByPr.get(result.pr);
            if (!label) throw new Error(`No label for ${result.pr}`);
            const categories = finalCategories(label);
            if (categories.has("not-checkable")) notCheckableByRepo[result.repo] = (notCheckableByRepo[result.repo] ?? 0) + 1;
            const objected = new Set([...categories].flatMap((c) => (c === "not-checkable" ? [] : [CATEGORY_RULE[c]])));
            for (const ruleType of RULE_TYPES) {
                pairs.push({ pr: result.pr, repo: result.repo, ruleType, objection: objected.has(ruleType), flag: result.flags[ruleType] });
            }
            console.log(`  ${result.pr}: flags ${JSON.stringify(Object.fromEntries(Object.entries(result.flags).filter(([, f]) => f)))} | objections ${[...objected].join(", ") || "none"}`);
        }
    }

    const group = (key: (p: Pair) => string) =>
        Object.fromEntries([...new Set(pairs.map(key))].map((k) => [k, score(pairs.filter((p) => key(p) === k))]));
    const results: Results = {
        labelsCommit,
        toolCommit,
        tool,
        pairs,
        overall: score(pairs),
        byRuleType: group((p) => p.ruleType),
        byRepo: group((p) => p.repo),
        notCheckableByRepo,
    };
    writeJson(RESULTS_FILE, results);
    console.log(`\nwrote ${RESULTS_FILE} (labels from commit ${labelsCommit}, MergeReady ${toolCommit}; GitHub: ${gh.stats.fetched} fetched, ${gh.stats.cached} from cache)`);
}

// No GitHub calls: turns results.json into REPORT.md
async function stageReport(): Promise<void> {
    const report = buildReport({
        results: readJson<Results>(RESULTS_FILE),
        dataset: readJson<Dataset>(DATASET_FILE),
        firstRun: readJson<Dataset>(path.join(DATA_DIR, "dataset.first-run.json")),
        labels: readJson<LabelsFile>(LABELS_FILE),
        snapshots: readJson<Snapshots>(SNAPSHOTS_FILE),
    });
    writeFileSync(REPORT_FILE, report);
    console.log(`wrote ${REPORT_FILE}`);
}

export function readJson<T>(file: string): T {
    return JSON.parse(readFileSync(file, "utf8")) as T;
}

export function writeJson(file: string, value: unknown): void {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

const STAGES: Record<string, () => Promise<void>> = {
    select: stageSelect,
    reconstruct: stageReconstruct,
    suggest: stageSuggest,
    evaluate: stageEvaluate,
    report: stageReport,
};

async function main(): Promise<void> {
    const stage = process.argv[2] ?? "";
    const run = STAGES[stage];
    if (!run) {
        console.log(`Usage: eval/run.ts <${Object.keys(STAGES).join(" | ")}>`);
        process.exitCode = 1;
        return;
    }
    await run();
}

void main();
