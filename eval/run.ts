// Runs the evaluation one stage at a time. Uses your real GITHUB_TOKEN; every
// GitHub answer is cached in eval/.cache, so running a stage again is free.
//   node --env-file=.env.local --import tsx eval/run.ts select
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { CUTOFF, DATA_DIR, PER_REPO, REPOS, repoKey } from "./config";
import { createCachedGitHub } from "./github";
import { selectRepo, type RepoSelection } from "./select";

export type Dataset = { rules: string; cutoff: string; perRepo: number; repos: RepoSelection[] };

const DATASET_FILE = path.join(DATA_DIR, "dataset.json");

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

export function readJson<T>(file: string): T {
    return JSON.parse(readFileSync(file, "utf8")) as T;
}

export function writeJson(file: string, value: unknown): void {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

const STAGES: Record<string, () => Promise<void>> = { select: stageSelect };

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
