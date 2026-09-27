export type GitHubErrorCode =
    | "MISSING_TOKEN"
    | "INVALID_REPO"
    | "REPO_NOT_FOUND"
    | "RATE_LIMITED"
    | "GITHUB_TIMEOUT"
    | "GITHUB_UNAVAILABLE";

// Base class: every GitHub problem has a short `code` (for our code)
// and a friendly `message` (safe to show to the user).
export class GitHubError extends Error {
    readonly code: GitHubErrorCode;

    constructor(code: GitHubErrorCode, message: string) {
        super(message);
        this.name = "GitHubError";
        this.code = code;
    }
}

export class MissingTokenError extends GitHubError {
    constructor(message = "Server is not configured correctly (GitHub token is missing).") {
        super("MISSING_TOKEN", message);
        this.name = "MissingTokenError";
    }
}

export class InvalidRepoError extends GitHubError {
    constructor() {
        super("INVALID_REPO", "That doesn't look like a valid GitHub owner/repo name.");
        this.name = "InvalidRepoError";
    }
}

export class RepoNotFoundError extends GitHubError {
    constructor() {
        super("REPO_NOT_FOUND", "Repo not found. It may not exist, or it may be private.");
        this.name = "RepoNotFoundError";
    }
}

export class RateLimitError extends GitHubError {
    // When GitHub will let us try again (null if GitHub didn't say)
    readonly resetAt: Date | null;

    constructor(resetAt: Date | null) {
        const when = resetAt ? ` after ${resetAt.toISOString().slice(11, 16)} UTC` : " in a few minutes";
        super("RATE_LIMITED", `GitHub rate limit reached. Please try again${when}.`);
        this.name = "RateLimitError";
        this.resetAt = resetAt;
    }
}

export class GitHubTimeoutError extends GitHubError {
    constructor() {
        super("GITHUB_TIMEOUT", "GitHub took too long to respond. Please try again.");
        this.name = "GitHubTimeoutError";
    }
}

export class GitHubUnavailableError extends GitHubError {
    constructor() {
        super("GITHUB_UNAVAILABLE", "Couldn't reach GitHub right now. Please try again.");
        this.name = "GitHubUnavailableError";
    }
}

// Octokit errors carry an HTTP `status` number. Read it safely without `any`.
export function getHttpStatus(err: unknown): number | null {
    if (typeof err === "object" && err !== null && "status" in err && typeof err.status === "number") {
        return err.status;
    }
    return null;
}

// Read one response header (e.g. "x-ratelimit-remaining") from an Octokit error.
function getHeader(err: unknown, name: string): string | null {
    if (typeof err !== "object" || err === null || !("response" in err)) return null;
    const response = err.response;
    if (typeof response !== "object" || response === null || !("headers" in response)) return null;
    const headers = response.headers;
    if (typeof headers !== "object" || headers === null || !(name in headers)) return null;
    const value: unknown = (headers as Record<string, unknown>)[name];
    return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

// AbortSignal.timeout() fails fetch with a "TimeoutError".
// Octokit wraps that inside its own error, so check the `cause` too.
function isTimeout(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    if (err.name === "TimeoutError") return true;
    return err.cause instanceof Error && err.cause.name === "TimeoutError";
}

function isRateLimit(err: unknown, status: number | null): boolean {
    if (status === 429) return true;
    if (status !== 403) return false;
    // Primary limit: GitHub says 0 requests left
    if (getHeader(err, "x-ratelimit-remaining") === "0") return true;
    // Secondary limit: only the message tells us
    return err instanceof Error && /rate limit/i.test(err.message);
}

function getResetTime(err: unknown): Date | null {
    // x-ratelimit-reset = time in seconds since 1970
    const reset = Number(getHeader(err, "x-ratelimit-reset"));
    if (Number.isFinite(reset) && reset > 0) return new Date(reset * 1000);
    // retry-after = seconds to wait (used by secondary limits)
    const retryAfter = Number(getHeader(err, "retry-after"));
    if (Number.isFinite(retryAfter) && retryAfter > 0) return new Date(Date.now() + retryAfter * 1000);
    return null;
}

// Turn any error from Octokit into one of our friendly error types.
export function toGitHubError(err: unknown): GitHubError {
    if (err instanceof GitHubError) return err;
    if (isTimeout(err)) return new GitHubTimeoutError();

    const status = getHttpStatus(err);
    if (isRateLimit(err, status)) return new RateLimitError(getResetTime(err));
    if (status === 401) return new MissingTokenError("Server is not configured correctly (GitHub token is invalid).");
    if (status === 404) return new RepoNotFoundError();
    // 5xx, network failures (Octokit reports these as 500) and anything unexpected
    return new GitHubUnavailableError();
}
