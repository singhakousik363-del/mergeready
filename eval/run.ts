// Runs the evaluation one stage at a time. Uses your real GITHUB_TOKEN; every
// GitHub answer is cached in eval/.cache, so running a stage again is free.
//   node --env-file=.env.local --import tsx eval/run.ts select
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { CUTOFF, DATA_DIR, PER_REPO, REPOS, repoKey } from "./config";
import { createCachedGitHub } from "./github";
import { reconstructPr } from "./reconstruct";
import { selectRepo, type RepoSelection } from "./select";
import type { Snapshots } from "./types";

export type Dataset = { rules: string; cutoff: string; perRepo: number; repos: RepoSelection[] };

const DATASET_FILE = path.join(DATA_DIR, "dataset.json");
export const SNAPSHOTS_FILE = path.join(DATA_DIR, "snapshots.json");

async function stageSelect(): Promise<void> {
    const gh = createCachedGitHub();
    const repos: RepoSelection[] = [];
    for (const repo of REPOS) {
        console.log(`\n${repoKey(repo)}`);
        const selection = await selectRepo(gh, repo);
        console.log(`  kept ${selection.prs.length} of ${selection.scanned} scanned; skipped ${JSON.stringify(selection.skipped)}`);
        repos.push(selection);
    }
    const dataset: Dataset = { rules: "eval/SELECTION.md", cutoff: CUTOFF, perRepo: PER_REPO, repos };
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

export function readJson<T>(file: string): T {
    return JSON.parse(readFileSync(file, "utf8")) as T;
}

export function writeJson(file: string, value: unknown): void {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

const STAGES: Record<string, () => Promise<void>> = { select: stageSelect, reconstruct: stageReconstruct };

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
