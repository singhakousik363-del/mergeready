// Step 1: pick the dataset with the rules in eval/SELECTION.md
import { looksLikeBot } from "../lib/github/client";
import { CUTOFF, MAINTAINER_ASSOCIATIONS, MAX_SCANNED_PER_REPO, PER_REPO, repoKey, type RepoRef } from "./config";
import type { CachedGitHub } from "./github";

export type ListedPr = {
    number: number;
    title: string;
    url: string;
    createdAt: string;
    state: "OPEN" | "CLOSED" | "MERGED";
    authorAssociation: string;
    author: { __typename: string; login: string } | null;
    comments: { nodes: { authorAssociation: string; author: { login: string } | null }[] };
    reviews: { nodes: { authorAssociation: string; author: { login: string } | null }[] };
};

// Why a PR was left out (counted in the report), or "candidate"
export type Verdict = "candidate" | "after-cutoff" | "bot" | "maintainer" | "not-looked-at";

// Rules 1, 2, 3 and 5 of SELECTION.md (rule 4, "new contributor", needs a search)
export function classifyPr(pr: ListedPr, cutoff = CUTOFF): Verdict {
    if (pr.createdAt > cutoff) return "after-cutoff";
    const login = pr.author?.login ?? "ghost";
    if (!pr.author || pr.author.__typename !== "User" || looksLikeBot(login)) return "bot";
    if (MAINTAINER_ASSOCIATIONS.has(pr.authorAssociation)) return "maintainer";

    const byMaintainer = (item: { authorAssociation: string; author: { login: string } | null }) =>
        MAINTAINER_ASSOCIATIONS.has(item.authorAssociation) && item.author?.login !== login;
    const lookedAt = pr.state !== "OPEN" || pr.comments.nodes.some(byMaintainer) || pr.reviews.nodes.some(byMaintainer);
    return lookedAt ? "candidate" : "not-looked-at";
}

export type SelectedPr = { number: number; title: string; url: string; createdAt: string; state: ListedPr["state"]; author: string };

export type RepoSelection = {
    repo: RepoRef;
    // PRs opened on or before the cutoff that were looked at (limit: MAX_SCANNED_PER_REPO)
    scanned: number;
    // How many PRs each rule removed
    skipped: Record<Exclude<Verdict, "candidate"> | "not-new", number>;
    prs: SelectedPr[];
};

const LIST_QUERY = `query ($owner: String!, $name: String!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(first: 50, after: $after, orderBy: { field: CREATED_AT, direction: DESC }) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number title url createdAt state authorAssociation
        author { __typename login }
        comments(first: 50) { nodes { authorAssociation author { login } } }
        reviews(first: 30) { nodes { authorAssociation author { login } } }
      }
    }
  }
}`;

type ListResult = {
    repository: { pullRequests: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: ListedPr[] } };
};

// window: the main set uses PER_REPO and CUTOFF; the held-out set passes its
// own window. PRs come newest first, so the scan stops at the first PR
// created before window.start.
type Window = { perRepo: number; start: string | null; end: string };

export async function selectRepo(
    gh: CachedGitHub,
    repo: RepoRef,
    window: Window = { perRepo: PER_REPO, start: null, end: CUTOFF }
): Promise<RepoSelection> {
    const { perRepo } = window;
    const skipped = { "after-cutoff": 0, bot: 0, maintainer: 0, "not-looked-at": 0, "not-new": 0 };
    const prs: SelectedPr[] = [];
    let scanned = 0;
    let after: string | null = null;

    let beforeWindow = false;
    while (prs.length < perRepo && scanned < MAX_SCANNED_PER_REPO && !beforeWindow) {
        const page: ListResult = await gh.graphql<ListResult>(LIST_QUERY, { owner: repo.owner, name: repo.repo, after });
        const { nodes, pageInfo } = page.repository.pullRequests;

        for (const pr of nodes) {
            if (prs.length >= perRepo || scanned >= MAX_SCANNED_PER_REPO) break;
            if (window.start !== null && pr.createdAt < window.start) {
                beforeWindow = true;
                break;
            }
            const verdict = classifyPr(pr, window.end);
            // Change 1 in SELECTION.md: PRs after the cutoff don't use up the scan limit
            if (verdict === "after-cutoff") {
                skipped[verdict]++;
                continue;
            }
            scanned++;
            if (verdict !== "candidate") {
                skipped[verdict]++;
                continue;
            }
            // Rule 4: no merged PR in this repo before this one was opened
            const author = pr.author?.login ?? "ghost";
            const search = await gh.rest<{ total_count: number }>("GET /search/issues", {
                q: `repo:${repoKey(repo)} is:pr is:merged author:${author} merged:<${pr.createdAt}`,
                per_page: 1,
            });
            if (search.total_count > 0) {
                skipped["not-new"]++;
                continue;
            }
            prs.push({ number: pr.number, title: pr.title, url: pr.url, createdAt: pr.createdAt, state: pr.state, author });
            console.log(`  ${repoKey(repo)}#${pr.number} by @${author} (${prs.length}/${perRepo})`);
        }
        if (!pageInfo.hasNextPage) break;
        after = pageInfo.endCursor;
    }
    return { repo, scanned, skipped, prs };
}
