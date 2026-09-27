import path from "node:path";

// A link from the CONTRIBUTING file to another doc in the same repo
export type DocLink = {
    // Path inside the repo, e.g. "doc/contributing/pull-requests.md"
    path: string;
    // The clickable text of the link, e.g. "Pull Requests"
    linkText: string;
    // 2 = very likely has PR rules, 1 = maybe (0 is never returned)
    score: number;
};

// An owner/repo pair, e.g. { owner: "nodejs", repo: "node" }
export type RepoName = { owner: string; repo: string };

type RawLink = { text: string; target: string };

// Words that point to PR / commit / newcomer rules
const STRONG_WORDS = [
    /pull ?requests?/,
    /\bprs?\b/,
    /\bcommits?\b/,
    /code ?reviews?/,
    /\bfirst\b/,
    /\bnewcomers?\b/,
    /\bbeginners?\b/,
];
const WEAK_WORDS = [/contribut/];

// Docs we never follow: they are about behaviour or project politics, not PR rules
const NEVER_FOLLOW = /^(code[ _-]?of[ _-]?conduct|governance)$/i;

const DOC_EXTENSION = /\.(md|markdown|rst)$/i;
// "https:", "mailto:" etc. Anything with a scheme is not a relative link.
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
// https://github.com/{owner}/{repo}/blob/{branch}/{path}
const GITHUB_BLOB_URL = /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+)\/blob\/[^/]+\/(.+)$/i;
// https://github.com/{owner}/{repo}/ followed by anything
const GITHUB_REPO_URL = /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+)\//i;

// If a CONTRIBUTING file has fewer own words than this, it is "mostly links"
const SHORT_FILE_WORDS = 300;

// Finds links to other docs in the same repo, best first.
// `fromPath` is where the CONTRIBUTING file lives, because "./x.md" is
// relative to its folder. `sameRepos` are the names that count as "this
// repo" in full GitHub URLs (more than one when a repo was renamed).
export function findDocLinks(text: string, fromPath: string, sameRepos: RepoName[]): DocLink[] {
    const byPath = new Map<string, DocLink>();

    for (const link of extractLinks(text)) {
        const docPath = resolveDocPath(link.target, fromPath, sameRepos);
        if (docPath === null || docPath === fromPath) continue;

        const fileName = path.posix.basename(docPath).replace(DOC_EXTENSION, "");
        if (NEVER_FOLLOW.test(fileName)) continue;

        const score = scoreText(`${fileName} ${link.text}`);
        const seen = byPath.get(docPath);
        // Same file linked twice: keep the first position but the best text
        if (!seen) byPath.set(docPath, { path: docPath, linkText: link.text, score });
        else if (score > seen.score) byPath.set(docPath, { ...seen, linkText: link.text, score });
    }

    // Map keeps insertion order, and sort is stable, so equal scores
    // stay in the order they appear in the file
    return [...byPath.values()].filter((link) => link.score > 0).sort((a, b) => b.score - a.score);
}

// For a CONTRIBUTING file that is mostly a pointer to a website (like
// facebook/react), returns that website's URL. Otherwise null.
export function findExternalGuide(text: string, sameRepos: RepoName[]): string | null {
    if (countOwnWords(text) >= SHORT_FILE_WORDS) return null;

    let best: { url: string; score: number } | null = null;

    for (const link of extractLinks(text)) {
        const url = link.target.trim();
        if (!/^https?:\/\//i.test(url)) continue;
        // A full link back into this same repo is not "external"
        const repoMatch = GITHUB_REPO_URL.exec(url);
        if (repoMatch && isSameRepo(repoMatch[1], repoMatch[2], sameRepos)) continue;

        const score = scoreText(`${url} ${link.text}`);
        if (score > 0 && (best === null || score > best.score)) best = { url, score };
    }
    return best?.url ?? null;
}

// 2 if any strong word matches, 1 if only a weak one does, else 0.
// "-" and "_" count as spaces, so "pull_request-guide" matches "pull request".
function scoreText(raw: string): number {
    const text = raw.toLowerCase().replace(/[-_]/g, " ");
    if (STRONG_WORDS.some((word) => word.test(text))) return 2;
    if (WEAK_WORDS.some((word) => word.test(text))) return 1;
    return 0;
}

// Finds the three link styles guideline files use, in the order they appear.
function extractLinks(text: string): RawLink[] {
    const found: { index: number; link: RawLink }[] = [];

    // Markdown: [text](target) or [text](target "title"). Images (![...]) are skipped.
    for (const m of text.matchAll(/(!?)\[([^\]]*)\]\(\s*<?([^)\s>]+)>?[^)]*\)/g)) {
        if (m[1] === "!") continue;
        found.push({ index: m.index, link: { text: m[2], target: m[3] } });
    }
    // Markdown reference: [text]: target
    for (const m of text.matchAll(/^ {0,3}\[([^\]]+)\]:\s*<?(\S+?)>?(?:\s.*)?$/gm)) {
        found.push({ index: m.index, link: { text: m[1], target: m[2] } });
    }
    // reStructuredText: `text <target>`_
    for (const m of text.matchAll(/`([^`<]*?)\s*<([^>`]+)>`_{1,2}/g)) {
        found.push({ index: m.index, link: { text: m[1], target: m[2] } });
    }

    return found.sort((a, b) => a.index - b.index).map((f) => f.link);
}

// Turns a link into a path inside the repo, or null if it isn't a same-repo doc.
//   "./doc/pr.md#notes" from "CONTRIBUTING.md"                     -> "doc/pr.md"
//   "https://github.com/nodejs/node/blob/main/doc/pr.md" (same repo) -> "doc/pr.md"
// Returns null for other websites, anchors, non-doc files and paths outside the repo.
export function resolveDocPath(target: string, fromPath: string, sameRepos: RepoName[]): string | null {
    let trimmed = target.trim();

    // A full link to a file in this same repo: keep only the path part.
    // (The branch in the URL is dropped; we always read the default branch.)
    const blob = GITHUB_BLOB_URL.exec(trimmed);
    if (blob && isSameRepo(blob[1], blob[2], sameRepos)) trimmed = `/${blob[3]}`;

    if (HAS_SCHEME.test(trimmed) || trimmed.startsWith("//")) return null;

    // Drop "#section" and "?query"; a link that was only "#section" becomes empty
    const withoutHash = trimmed.split(/[#?]/)[0];
    if (withoutHash === "") return null;

    let decoded: string;
    try {
        decoded = decodeURIComponent(withoutHash);
    } catch {
        return null;
    }
    // Control characters or backslashes have no place in a repo path
    if (decoded.includes("\\") || /\p{Cc}/u.test(decoded)) return null;
    if (!DOC_EXTENSION.test(decoded)) return null;

    // "/x.md" means repo root on GitHub; "x.md" means next to CONTRIBUTING
    const base = decoded.startsWith("/") ? "" : path.posix.dirname(fromPath);
    // Remove the leading "/" first: normalize("/../x.md") would quietly give
    // "/x.md", but we want "../x.md" so an escaping link gets rejected below
    const resolved = path.posix.normalize(path.posix.join(base, decoded.replace(/^\/+/, "")));
    // "../" left over means the link points outside the repo
    if (resolved === "" || resolved === ".." || resolved.startsWith("../")) return null;
    return resolved;
}

// GitHub names are not case-sensitive: "NodeJS/Node" is the same repo as "nodejs/node"
function isSameRepo(owner: string, repo: string, sameRepos: RepoName[]): boolean {
    return sameRepos.some(
        (same) => same.owner.toLowerCase() === owner.toLowerCase() && same.repo.toLowerCase() === repo.toLowerCase()
    );
}

// Words that are the file's own text, not link addresses or hidden comments
function countOwnWords(text: string): number {
    const visible = text
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/\]\([^)]*\)/g, "]")
        .replace(/https?:\/\/\S+/g, " ");
    return visible.split(/\s+/).filter((word) => /[a-z0-9]/i.test(word)).length;
}
