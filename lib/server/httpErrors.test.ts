import { describe, it, expect } from "vitest";
import { BudgetExceededError, TooManyRequestsError, badRequest, toHttpError } from "./httpErrors";
import {
    GitHubTimeoutError,
    GitHubUnavailableError,
    InvalidRepoError,
    IssueNotFoundError,
    MissingTokenError,
    PullRequestNotFoundError,
    RateLimitError,
    RepoNotFoundError,
} from "../github/errors";

const NOW = new Date("2026-09-28T12:00:00Z");

describe("toHttpError", () => {
    it("maps our GitHub errors to HTTP status codes", () => {
        const cases: [Error, number, string][] = [
            [new InvalidRepoError(), 400, "INVALID_REPO"],
            [new RepoNotFoundError(), 404, "REPO_NOT_FOUND"],
            [new IssueNotFoundError("Issue #9 was not found."), 404, "ISSUE_NOT_FOUND"],
            [new PullRequestNotFoundError(9), 404, "PR_NOT_FOUND"],
            [new GitHubUnavailableError(), 502, "GITHUB_UNAVAILABLE"],
            [new GitHubTimeoutError(), 504, "GITHUB_TIMEOUT"],
            [new MissingTokenError(), 500, "MISSING_TOKEN"],
        ];
        for (const [err, status, code] of cases) {
            const result = toHttpError(err, NOW);
            expect([result.status, result.body.error.code]).toEqual([status, code]);
            expect(result.body.error.message).toBe(err.message);
        }
    });

    it("GitHub rate limit = 503 with Retry-After until the reset time", () => {
        const result = toHttpError(new RateLimitError(new Date("2026-09-28T12:05:00Z")), NOW);
        expect(result.status).toBe(503);
        expect(result.retryAfterSeconds).toBe(300);
        expect(result.body.error.message).toBe("GitHub rate limit reached. Please try again after 12:05 UTC.");
    });

    it("our own per-IP limit = 429 with Retry-After", () => {
        const result = toHttpError(new TooManyRequestsError(42), NOW);
        expect(result).toEqual({
            status: 429,
            body: { ok: false, error: { code: "TOO_MANY_REQUESTS", message: "Too many checks from your network. Please try again in 42 seconds." } },
            retryAfterSeconds: 42,
        });
    });

    it("the whole-analysis time budget = 504 with its own message", () => {
        const result = toHttpError(new BudgetExceededError(25), NOW);
        expect(result.status).toBe(504);
        expect(result.body.error).toEqual({
            code: "ANALYSIS_TIMEOUT",
            message: "The analysis took longer than 25 seconds, so it was stopped. Please try again in a moment.",
        });
    });

    it("never leaks unknown errors: generic 500, no message or stack from the error", () => {
        const secret = new Error("request failed: Authorization: token ghp_SECRET at /repos/x");
        const result = toHttpError(secret, NOW);
        expect(result.status).toBe(500);
        expect(JSON.stringify(result.body)).not.toContain("ghp_SECRET");
        expect(JSON.stringify(result.body)).not.toContain("at ");
        expect(result.body.error).toEqual({ code: "INTERNAL_ERROR", message: "Something went wrong on our side. Please try again." });
    });

    it("badRequest wraps a validation message", () => {
        expect(badRequest("Paste a link.")).toEqual({
            status: 400,
            body: { ok: false, error: { code: "BAD_REQUEST", message: "Paste a link." } },
            retryAfterSeconds: null,
        });
    });
});
