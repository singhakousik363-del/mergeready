import { describe, it, expect, vi } from "vitest";
import { clientIp, createAnalyzeHandler } from "./handleAnalyze";
import { RateLimiter } from "./rateLimit";
import { BudgetExceededError } from "./httpErrors";
import { RateLimitError, RepoNotFoundError } from "../github/errors";
import type { AnalyzeResponse } from "./analyze";
import type { AnalyzeInput } from "./validateInput";

const ISSUE_URL = "https://github.com/stdlib-js/stdlib/issues/12959";

// Just enough of a response for the handler (it only reads meta.cached)
function fakeResult(cached: { rules: boolean; target: boolean }): AnalyzeResponse {
    return { ok: true, meta: { analyzedAt: "", durationMs: 1, cached } } as AnalyzeResponse;
}

function request(body: unknown, headers: Record<string, string> = {}): Request {
    return new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: typeof body === "string" ? body : JSON.stringify(body),
    });
}

function setup(analyze: (input: AnalyzeInput) => Promise<AnalyzeResponse>) {
    const analyzeSpy = vi.fn(analyze);
    const log = vi.fn();
    const handler = createAnalyzeHandler({
        analyze: analyzeSpy,
        limiter: new RateLimiter(),
        now: () => new Date("2026-09-28T12:00:00Z"),
        log,
    });
    return { handler, analyze: analyzeSpy, log };
}

describe("POST /api/analyze: success", () => {
    it("validates, analyzes and returns JSON that is never cached by browsers", async () => {
        const { handler, analyze } = setup(async () => fakeResult({ rules: false, target: false }));

        const response = await handler(request({ url: ISSUE_URL, username: "MannXo" }));

        expect(response.status).toBe(200);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(await response.json()).toMatchObject({ ok: true });
        expect(analyze).toHaveBeenCalledWith({ owner: "stdlib-js", repo: "stdlib", kind: "issue", number: 12959, username: "MannXo" });
    });
});

describe("POST /api/analyze: bad requests never reach GitHub", () => {
    const cases: [string, Request, string][] = [
        ["not JSON content type", new Request("http://localhost/api/analyze", { method: "POST", body: "url=x" }), "Send the request as JSON."],
        ["broken JSON", request("{ url: "), "The request body isn't valid JSON."],
        ["too large", request({ url: ISSUE_URL, pad: "x".repeat(5000) }), "The request is too large."],
        ["not a GitHub link", request({ url: "https://gitlab.com/a/b/issues/1" }), "Please paste a github.com link."],
        ["bad username", request({ url: ISSUE_URL, username: "-x" }), "That doesn't look like a GitHub username."],
    ];

    for (const [name, req, message] of cases) {
        it(name, async () => {
            const { handler, analyze } = setup(async () => fakeResult({ rules: false, target: false }));
            const response = await handler(req);
            const body = await response.json();

            expect(response.status).toBe(400);
            expect(body.error.code).toBe("BAD_REQUEST");
            expect(body.error.message).toBe(message);
            expect(analyze).not.toHaveBeenCalled();
        });
    }
});

describe("POST /api/analyze: rate limit", () => {
    it("allows 10 GitHub-using requests per minute per IP, then 429 with Retry-After", async () => {
        const { handler, analyze } = setup(async () => fakeResult({ rules: false, target: false }));
        const headers = { "x-forwarded-for": "1.2.3.4, 10.0.0.1" };

        for (let i = 0; i < 10; i++) expect((await handler(request({ url: ISSUE_URL }, headers))).status).toBe(200);
        const blocked = await handler(request({ url: ISSUE_URL }, headers));

        expect(blocked.status).toBe(429);
        expect(blocked.headers.get("retry-after")).toBe("60");
        expect((await blocked.json()).error.code).toBe("TOO_MANY_REQUESTS");
        expect(analyze).toHaveBeenCalledTimes(10);
        // Someone else on another IP is not affected
        expect((await handler(request({ url: ISSUE_URL }, { "x-forwarded-for": "5.6.7.8" }))).status).toBe(200);
    });

    it("answers fully served from cache don't count", async () => {
        const { handler } = setup(async () => fakeResult({ rules: true, target: true }));
        for (let i = 0; i < 25; i++) {
            expect((await handler(request({ url: ISSUE_URL }, { "x-forwarded-for": "1.2.3.4" }))).status).toBe(200);
        }
    });

    it("half-cached answers (rules cached, PR not) do count", async () => {
        const { handler } = setup(async () => fakeResult({ rules: true, target: false }));
        for (let i = 0; i < 10; i++) await handler(request({ url: ISSUE_URL }));
        expect((await handler(request({ url: ISSUE_URL }))).status).toBe(429);
    });
});

describe("POST /api/analyze: errors are safe and friendly", () => {
    it("repo not found = 404 with our message", async () => {
        const { handler } = setup(async () => {
            throw new RepoNotFoundError();
        });
        const response = await handler(request({ url: ISSUE_URL }));
        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({
            ok: false,
            error: { code: "REPO_NOT_FOUND", message: "Repo not found. It may not exist, or it may be private." },
        });
    });

    it("GitHub token rate limit = 503 with Retry-After", async () => {
        const { handler } = setup(async () => {
            throw new RateLimitError(new Date("2026-09-28T12:10:00Z"));
        });
        const response = await handler(request({ url: ISSUE_URL }));
        expect(response.status).toBe(503);
        expect(response.headers.get("retry-after")).toBe("600");
    });

    it("time budget = 504", async () => {
        const { handler } = setup(async () => {
            throw new BudgetExceededError(25);
        });
        expect((await handler(request({ url: ISSUE_URL }))).status).toBe(504);
    });

    it("unknown errors: generic 500, and neither the response nor the log contains the error's details", async () => {
        const { handler, log } = setup(async () => {
            throw new Error("GET /repos failed, authorization: token ghp_SECRET123");
        });
        const response = await handler(request({ url: ISSUE_URL }));
        const text = await response.text();

        expect(response.status).toBe(500);
        expect(text).not.toContain("ghp_SECRET123");
        expect(text).not.toContain("stack");
        expect(log).toHaveBeenCalledWith("POST /api/analyze failed: INTERNAL_ERROR (Error)");
        expect(JSON.stringify(log.mock.calls)).not.toContain("ghp_SECRET123");
    });
});

describe("clientIp", () => {
    it("uses the first x-forwarded-for entry, then x-real-ip, then 'unknown'", () => {
        const make = (headers: Record<string, string>) => new Request("http://localhost", { headers });
        expect(clientIp(make({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
        expect(clientIp(make({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
        expect(clientIp(make({}))).toBe("unknown");
    });
});
