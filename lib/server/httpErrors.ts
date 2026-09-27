import { GitHubError, RateLimitError, type GitHubErrorCode } from "../github/errors";

// The whole analysis ran out of time (see analyze.ts)
export class BudgetExceededError extends Error {
    constructor(seconds: number) {
        super(`The analysis took longer than ${seconds} seconds, so it was stopped. Please try again in a moment.`);
        this.name = "BudgetExceededError";
    }
}

// Our own per-IP limit (see rateLimit.ts), not GitHub's
export class TooManyRequestsError extends Error {
    readonly retryAfterSeconds: number;

    constructor(retryAfterSeconds: number) {
        super(`Too many checks from your network. Please try again in ${retryAfterSeconds} seconds.`);
        this.name = "TooManyRequestsError";
        this.retryAfterSeconds = retryAfterSeconds;
    }
}

export type ErrorCode = GitHubErrorCode | "BAD_REQUEST" | "TOO_MANY_REQUESTS" | "ANALYSIS_TIMEOUT" | "INTERNAL_ERROR";

export type ErrorBody = { ok: false; error: { code: ErrorCode; message: string } };

export type HttpError = {
    status: number;
    body: ErrorBody;
    // For the Retry-After header (null = don't send it)
    retryAfterSeconds: number | null;
};

const STATUS_BY_CODE: Record<GitHubErrorCode, number> = {
    INVALID_REPO: 400,
    INVALID_NUMBER: 400,
    REPO_NOT_FOUND: 404,
    ISSUE_NOT_FOUND: 404,
    PR_NOT_FOUND: 404,
    // Our GitHub token ran out: the service is unavailable for a while
    RATE_LIMITED: 503,
    GITHUB_TIMEOUT: 504,
    GITHUB_UNAVAILABLE: 502,
    // Never say more: the message must not hint at the token
    MISSING_TOKEN: 500,
};

export function badRequest(message: string): HttpError {
    return { status: 400, body: { ok: false, error: { code: "BAD_REQUEST", message } }, retryAfterSeconds: null };
}

// Turns any error into a safe HTTP answer. Only our own friendly messages
// reach the browser: never raw GitHub errors, stack traces or the token.
export function toHttpError(err: unknown, now: Date): HttpError {
    if (err instanceof TooManyRequestsError) {
        return error(429, "TOO_MANY_REQUESTS", err.message, err.retryAfterSeconds);
    }
    if (err instanceof BudgetExceededError) {
        return error(504, "ANALYSIS_TIMEOUT", err.message, null);
    }
    if (err instanceof RateLimitError) {
        const seconds = err.resetAt ? Math.max(1, Math.ceil((err.resetAt.getTime() - now.getTime()) / 1000)) : 60;
        return error(503, err.code, err.message, seconds);
    }
    if (err instanceof GitHubError) {
        return error(STATUS_BY_CODE[err.code], err.code, err.message, null);
    }
    return error(500, "INTERNAL_ERROR", "Something went wrong on our side. Please try again.", null);
}

function error(status: number, code: ErrorCode, message: string, retryAfterSeconds: number | null): HttpError {
    return { status, body: { ok: false, error: { code, message } }, retryAfterSeconds };
}
