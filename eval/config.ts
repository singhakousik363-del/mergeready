// Fixed in eval/SELECTION.md before the first run. Don't change these to
// get nicer numbers; if one must change, explain why in REPORT.md.
import path from "path";

export type RepoRef = { owner: string; repo: string };

export const REPOS: RepoRef[] = [
    { owner: "stdlib-js", repo: "stdlib" },
    { owner: "nodejs", repo: "node" },
    { owner: "prometheus", repo: "prometheus" },
    { owner: "vitejs", repo: "vite" },
];

export const PER_REPO = 20;
export const MAX_SCANNED_PER_REPO = 400;
export const CUTOFF = "2026-09-14T23:59:59Z";

// Commits dated up to this long after the PR was opened count as "first submission"
export const FIRST_PUSH_GRACE_MS = 10 * 60 * 1000;
// An author change this soon after a trigger (failing check, maintainer comment) counts as a fix
export const FIX_WINDOW_MS = 48 * 60 * 60 * 1000;

export const MAINTAINER_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

export const EVAL_DIR = path.join(process.cwd(), "eval");
export const DATA_DIR = path.join(EVAL_DIR, "data");
export const CACHE_DIR = path.join(EVAL_DIR, ".cache");

export function repoKey(repo: RepoRef): string {
    return `${repo.owner}/${repo.repo}`;
}
