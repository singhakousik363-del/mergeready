import { Octokit } from "@octokit/rest";
import { InvalidNumberError, InvalidRepoError, MissingTokenError } from "./errors";

// Give up on any single GitHub request after this long
export const GITHUB_TIMEOUT_MS = 10_000;

// GitHub's biggest page size for list endpoints
export const PER_PAGE = 100;

// GitHub rules: owner = letters/digits/hyphens (max 39, no leading hyphen),
// repo = letters/digits/. _ - (max 100)
const OWNER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;
const REPO_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

// Validate user input before sending it anywhere
export function assertValidRepo(owner: string, repo: string): void {
    if (!OWNER_PATTERN.test(owner) || !REPO_PATTERN.test(repo) || repo === "." || repo === "..") {
        throw new InvalidRepoError();
    }
}

export function assertValidNumber(number: number): void {
    // isSafeInteger also rejects NaN, 1.5 and numbers too big to be exact
    if (!Number.isSafeInteger(number) || number <= 0) throw new InvalidNumberError();
}

type ClientOptions = {
    // Tests pass a fake fetch and a short timeout; the app uses the defaults
    fetch?: typeof fetch;
    timeoutMs?: number;
};

export function createOctokit(options: ClientOptions = {}): Octokit {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new MissingTokenError();

    return new Octokit({
        auth: token,
        userAgent: "mergeready",
        request: { fetch: withTimeout(options.fetch ?? fetch, options.timeoutMs ?? GITHUB_TIMEOUT_MS) },
        // Octokit prints every failed request (like 404s) with log.error.
        // We catch and handle every error ourselves, so keep the console quiet.
        // warn stays on: GitHub uses it to announce deprecated APIs.
        log: { debug: noop, info: noop, warn: console.warn, error: noop },
    });
}

// Wraps fetch so each request gets its own timer. (One shared timer made
// when the client is created would cancel every request after 10s total.)
export function withTimeout(baseFetch: typeof fetch, timeoutMs: number): typeof fetch {
    return (input, init) => {
        const timeout = AbortSignal.timeout(timeoutMs);
        // Keep any cancel signal the caller already passed in
        const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
        return baseFetch(input, { ...init, signal });
    };
}

function noop(): void {}

// "renovate[bot]" (GitHub App) or "stdlib-bot" (a normal account used as a bot,
// which GitHub doesn't mark as type "Bot")
const BOT_NAME = /\[bot\]$|-bot$/i;

export function looksLikeBot(name: string): boolean {
    return BOT_NAME.test(name);
}

type Page<T> = { data: T[]; headers: { link?: string } };

export type PagedResult<T> = {
    items: T[];
    // How many pages were not read because of maxPages (0 = we read everything)
    skippedPages: number;
};

// Which pages to keep when there are more than maxPages:
// - "first":  pages 1, 2, 3 (for commits and files)
// - "newest": page 1 plus the LAST pages (for timelines, which list oldest
//             first, so the newest claims and PRs are at the end)
export type KeepPages = "first" | "newest";

// Reads up to maxPages pages of a GitHub list. Page 1 is always read first,
// because its Link header tells us how many pages exist.
export async function fetchPages<T>(
    fetchPage: (page: number) => Promise<Page<T>>,
    maxPages: number,
    keep: KeepPages
): Promise<PagedResult<T>> {
    const first = await fetchPage(1);
    const lastPage = parseLastPage(first.headers.link) ?? 1;

    // Which other pages to read
    let pages: number[];
    if (lastPage <= maxPages) {
        pages = range(2, lastPage);
    } else if (keep === "first") {
        pages = range(2, maxPages);
    } else {
        pages = range(lastPage - maxPages + 2, lastPage);
    }

    // The other pages don't depend on each other, so ask for them together
    const rest = await Promise.all(pages.map(fetchPage));
    return {
        items: [first, ...rest].flatMap((page) => page.data),
        skippedPages: Math.max(0, lastPage - maxPages),
    };
}

// Link: <https://api.github.com/...?page=2>; rel="next", <https://api.github.com/...?page=5>; rel="last"
//   -> 5. Returns null when there is no "last" link (= only one page).
export function parseLastPage(link: string | undefined): number | null {
    const match = link ? /<([^>]+)>;\s*rel="last"/.exec(link) : null;
    if (!match) return null;
    try {
        const page = Number(new URL(match[1]).searchParams.get("page"));
        return Number.isSafeInteger(page) && page > 0 ? page : null;
    } catch {
        return null;
    }
}

// range(2, 4) -> [2, 3, 4]; range(2, 1) -> []
function range(from: number, to: number): number[] {
    return Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
}
