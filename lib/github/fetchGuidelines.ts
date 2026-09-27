import type { Octokit } from "@octokit/rest";
import { createOctokit } from "./client";
import { findDocLinks, findExternalGuide, type RepoName } from "./docLinks";
import {
    InvalidRepoError,
    MissingTokenError,
    RateLimitError,
    GitHubError,
    getHttpStatus,
    toGitHubError,
} from "./errors";

// Files bigger than this are too big to send to the AI later
export const MAX_FILE_BYTES = 100 * 1024;

// Limits for docs that CONTRIBUTING links to (one level deep only)
export const MAX_EXTRA_DOCS = 3;
export const MAX_EXTRA_TOTAL_BYTES = 150 * 1024;
// Stop trying after this many links, so broken links can't cause lots of requests
const MAX_EXTRA_ATTEMPTS = 6;

// A same-repo doc that CONTRIBUTING links to, e.g. doc/contributing/pull-requests.md
export type ExtraDoc = {
    path: string;
    text: string;
    // Clickable GitHub link (html_url), so every rule can be traced to this file
    source: string;
    // The link text in CONTRIBUTING, e.g. "Pull Requests"
    linkText: string;
};

export type Guidelines = {
    contributing: string | null;
    prTemplate: string | null;
    // Clickable GitHub links (html_url) to where each file came from
    sources: { contributing: string | null; prTemplate: string | null };
    // Docs linked from CONTRIBUTING, best first (max 3)
    extraDocs: ExtraDoc[];
    // Problems the user should know about, e.g. "file too large"
    warnings: string[];
};

type FetchOptions = {
    // Tests pass a fake Octokit here, so the real API is never called
    octokit?: Octokit;
};

// Where a file lives. owner/repo can differ from the input repo when
// GitHub uses the org-wide "<owner>/.github" repo.
type FileLocation = { owner: string; repo: string; path: string };

type FileResult =
    | { status: "found"; text: string; htmlUrl: string; location: FileLocation }
    | { status: "missing" }
    | { status: "unusable"; warning: string };

type DirEntry = { name: string; path: string; type: string };

// GitHub rules: owner = letters/digits/hyphens (max 39, no leading hyphen),
// repo = letters/digits/. _ - (max 100)
const OWNER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;
const REPO_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

// GitHub looks in these folders, in this order ("" = repo root)
const SEARCH_DIRS = [".github", "", "docs"];
const CONTRIBUTING_NAME = /^contributing(\.(md|markdown|rst|txt))?$/i;
const PR_TEMPLATE_NAME = /^pull_request_template(\.(md|markdown|txt))?$/i;
const PR_TEMPLATE_DIR_NAME = /^pull_request_template$/i;

export async function fetchGuidelines(
    owner: string,
    repo: string,
    options: FetchOptions = {}
): Promise<Guidelines> {
    // 1. Validate user input before sending it anywhere
    if (!OWNER_PATTERN.test(owner) || !REPO_PATTERN.test(repo) || repo === "." || repo === "..") {
        throw new InvalidRepoError();
    }

    const octokit = options.octokit ?? createOctokit();

    // 2. Ask GitHub's community profile where the files are
    const fromProfile = await getProfileLocations(octokit, owner, repo);

    // 3. Read each file; fall back to searching folders only if needed
    const listDir = createDirLister(octokit, owner, repo);
    const contributing = await resolveFile(octokit, fromProfile.contributing, () =>
        findContributing(listDir, owner, repo)
    );
    const prTemplate = await resolveFile(octokit, fromProfile.prTemplate, () =>
        findPrTemplate(listDir, owner, repo)
    );

    // 4. Build the result
    const warnings: string[] = [];
    if (contributing.status === "unusable") warnings.push(contributing.warning);
    if (prTemplate.status === "unusable") warnings.push(prTemplate.warning);

    // 5. Follow CONTRIBUTING's links to other docs in the same repo
    let extraDocs: ExtraDoc[] = [];
    if (contributing.status === "found") {
        const sameRepos = sameRepoNames(contributing.location, { owner, repo });
        extraDocs = await fetchExtraDocs(octokit, contributing.text, contributing.location, sameRepos, warnings);

        // Nothing to follow in the repo? Maybe the real guide is on a website.
        const externalGuide = extraDocs.length === 0 ? findExternalGuide(contributing.text, sameRepos) : null;
        if (externalGuide) {
            warnings.push(
                `${contributing.location.path} mostly points to an external guide: ${externalGuide}. ` +
                    "MergeReady can't read external websites, so rules there aren't checked."
            );
        }
    }

    return {
        contributing: contributing.status === "found" ? contributing.text : null,
        prTemplate: prTemplate.status === "found" ? prTemplate.text : null,
        sources: {
            contributing: contributing.status === "found" ? contributing.htmlUrl : null,
            prTemplate: prTemplate.status === "found" ? prTemplate.htmlUrl : null,
        },
        extraDocs,
        warnings,
    };
}

async function getProfileLocations(
    octokit: Octokit,
    owner: string,
    repo: string
): Promise<{ contributing: FileLocation | null; prTemplate: FileLocation | null }> {
    try {
        const { data } = await octokit.rest.repos.getCommunityProfileMetrics({ owner, repo });
        return {
            contributing: parseContentsUrl(data.files.contributing?.url),
            prTemplate: parseContentsUrl(data.files.pull_request_template?.url),
        };
    } catch (err) {
        if (getHttpStatus(err) === 404) {
            // Either the repo doesn't exist, or only the profile is missing.
            // Ask for the repo itself to know which (throws RepoNotFoundError).
            await ensureRepoExists(octokit, owner, repo);
        } else {
            const error = toGitHubError(err);
            // These will fail the fallback too, so stop now
            if (error instanceof RateLimitError || error instanceof MissingTokenError) throw error;
        }
        // Profile didn't help: the fallback search will look for the files
        return { contributing: null, prTemplate: null };
    }
}

async function ensureRepoExists(octokit: Octokit, owner: string, repo: string): Promise<void> {
    try {
        await octokit.rest.repos.get({ owner, repo });
    } catch (err) {
        throw toGitHubError(err);
    }
}

// "https://api.github.com/repos/facebook/react/contents/.github/X.md?ref=main"
//   -> { owner: "facebook", repo: "react", path: ".github/X.md" }
function parseContentsUrl(url: string | undefined): FileLocation | null {
    if (!url) return null;
    try {
        const match = /^\/repos\/([^/]+)\/([^/]+)\/contents\/(.+)$/.exec(new URL(url).pathname);
        if (!match) return null;
        const [, owner, repo, path] = match;
        return { owner, repo, path: decodeURIComponent(path) };
    } catch {
        return null;
    }
}

async function resolveFile(
    octokit: Octokit,
    fromProfile: FileLocation | null,
    findFallback: () => Promise<FileLocation | null>
): Promise<FileResult> {
    if (fromProfile) {
        const result = await readFile(octokit, fromProfile);
        // "missing" here means the profile was out of date, so keep looking
        if (result.status !== "missing") return result;
    }
    const fallback = await findFallback();
    return fallback ? readFile(octokit, fallback) : { status: "missing" };
}

async function readFile(octokit: Octokit, location: FileLocation): Promise<FileResult> {
    let data;
    try {
        ({ data } = await octokit.rest.repos.getContent(location));
    } catch (err) {
        if (getHttpStatus(err) === 404) return { status: "missing" };
        throw toGitHubError(err);
    }

    // The path might be a folder, symlink or submodule instead of a file
    if (Array.isArray(data) || data.type !== "file") return { status: "missing" };

    if (data.size > MAX_FILE_BYTES) {
        const kb = Math.round(data.size / 1024);
        return { status: "unusable", warning: `${data.path} is too large to analyse (${kb}KB).` };
    }

    const text = decodeBase64(data.content, data.encoding);
    if (text === null) {
        return { status: "unusable", warning: `${data.path} could not be read (it may not be a text file).` };
    }

    const htmlUrl =
        data.html_url ?? `https://github.com/${location.owner}/${location.repo}/blob/HEAD/${location.path}`;
    return { status: "found", text, htmlUrl, location };
}

// Which owner/repo names mean "the repo CONTRIBUTING is in" inside full GitHub URLs:
// - where the file really is (e.g. react/react), and
// - the name the user typed (e.g. facebook/react), because GitHub redirects renamed repos.
// Exception: a file from the org-wide "<owner>/.github" repo is in a different repo
// from the one being analysed, so the typed name doesn't count there.
function sameRepoNames(fileLocation: FileLocation, requested: RepoName): RepoName[] {
    const inOrgWideRepo = fileLocation.repo.toLowerCase() === ".github" && requested.repo.toLowerCase() !== ".github";
    const fileRepo = { owner: fileLocation.owner, repo: fileLocation.repo };
    return inOrgWideRepo ? [fileRepo] : [fileRepo, requested];
}

// Reads the best docs that CONTRIBUTING links to. These are a bonus, so
// most problems only add a warning instead of failing the whole analysis.
async function fetchExtraDocs(
    octokit: Octokit,
    contributingText: string,
    contributing: FileLocation,
    sameRepos: RepoName[],
    warnings: string[]
): Promise<ExtraDoc[]> {
    const docs: ExtraDoc[] = [];
    let totalBytes = 0;
    // Links are relative to the repo the CONTRIBUTING file is really in
    const links = findDocLinks(contributingText, contributing.path, sameRepos).slice(0, MAX_EXTRA_ATTEMPTS);

    for (const link of links) {
        if (docs.length >= MAX_EXTRA_DOCS) break;

        let result: FileResult;
        try {
            result = await readFile(octokit, { owner: contributing.owner, repo: contributing.repo, path: link.path });
        } catch (err) {
            // Rate limit / bad token will break everything after this too, so stop
            if (err instanceof RateLimitError || err instanceof MissingTokenError) throw err;
            const message = err instanceof GitHubError ? err.message : "Unknown error.";
            warnings.push(`Couldn't read ${link.path} (linked from ${contributing.path}): ${message}`);
            continue;
        }

        // A broken link is the repo's problem, not the user's: skip quietly
        if (result.status === "missing") continue;
        if (result.status === "unusable") {
            warnings.push(result.warning);
            continue;
        }

        const bytes = Buffer.byteLength(result.text);
        if (totalBytes + bytes > MAX_EXTRA_TOTAL_BYTES) {
            const limitKb = MAX_EXTRA_TOTAL_BYTES / 1024;
            warnings.push(`${link.path} was skipped: linked docs are limited to ${limitKb}KB in total.`);
            continue;
        }

        totalBytes += bytes;
        docs.push({ path: link.path, text: result.text, source: result.htmlUrl, linkText: link.linkText });
    }
    return docs;
}

// GitHub sends file content as base64. Returns null if it isn't valid UTF-8 text.
function decodeBase64(content: string | undefined, encoding: string): string | null {
    if (encoding !== "base64" || content === undefined) return null;
    try {
        // fatal: true = throw on bytes that aren't valid text, instead of hiding them
        return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(content, "base64"));
    } catch {
        return null;
    }
}

// Lists a folder once and remembers the answer, so the CONTRIBUTING and
// PR template searches don't ask GitHub for the same folder twice.
function createDirLister(octokit: Octokit, owner: string, repo: string) {
    const cache = new Map<string, Promise<DirEntry[]>>();

    return (path: string): Promise<DirEntry[]> => {
        let entries = cache.get(path);
        if (!entries) {
            entries = listDir(octokit, owner, repo, path);
            cache.set(path, entries);
        }
        return entries;
    };
}

async function listDir(octokit: Octokit, owner: string, repo: string, path: string): Promise<DirEntry[]> {
    try {
        const { data } = await octokit.rest.repos.getContent({ owner, repo, path });
        return Array.isArray(data) ? data : [];
    } catch (err) {
        if (getHttpStatus(err) === 404) return [];
        throw toGitHubError(err);
    }
}

type DirLister = (path: string) => Promise<DirEntry[]>;

async function findContributing(listDir: DirLister, owner: string, repo: string): Promise<FileLocation | null> {
    for (const dir of SEARCH_DIRS) {
        const file = (await listDir(dir)).find((e) => e.type === "file" && CONTRIBUTING_NAME.test(e.name));
        if (file) return { owner, repo, path: file.path };
    }
    return null;
}

async function findPrTemplate(listDir: DirLister, owner: string, repo: string): Promise<FileLocation | null> {
    // A single template file wins over a folder of templates
    for (const dir of SEARCH_DIRS) {
        const file = (await listDir(dir)).find((e) => e.type === "file" && PR_TEMPLATE_NAME.test(e.name));
        if (file) return { owner, repo, path: file.path };
    }

    // Folder of templates: take the first .md file in A→Z order
    for (const dir of SEARCH_DIRS) {
        const folder = (await listDir(dir)).find((e) => e.type === "dir" && PR_TEMPLATE_DIR_NAME.test(e.name));
        if (!folder) continue;
        const templates = (await listDir(folder.path))
            .filter((e) => e.type === "file" && /\.md$/i.test(e.name))
            .sort((a, b) => a.name.localeCompare(b.name));
        if (templates.length > 0) return { owner, repo, path: templates[0].path };
    }
    return null;
}
