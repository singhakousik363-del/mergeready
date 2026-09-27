import { analyze as realAnalyze, type AnalyzeResponse } from "./analyze";
import { TooManyRequestsError, badRequest, toHttpError, type HttpError } from "./httpErrors";
import { RateLimiter } from "./rateLimit";
import { MAX_BODY_BYTES, validateInput, type AnalyzeInput } from "./validateInput";

type HandlerDeps = {
    analyze: (input: AnalyzeInput) => Promise<AnalyzeResponse>;
    limiter: RateLimiter;
    now: () => Date;
    // Server-side log; tests pass a spy
    log: (message: string) => void;
};

// Builds the POST /api/analyze handler. app/api/analyze/route.ts uses the real
// parts; tests pass a fake analyze and a fresh rate limiter.
export function createAnalyzeHandler(deps: Partial<HandlerDeps> = {}): (request: Request) => Promise<Response> {
    const { analyze, limiter, now, log }: HandlerDeps = {
        analyze: realAnalyze,
        limiter: new RateLimiter(),
        now: () => new Date(),
        log: (message) => console.error(message),
        ...deps,
    };

    return async function POST(request: Request): Promise<Response> {
        // 1. Read and check the body. Nothing here has touched GitHub yet,
        //    so bad requests never count against the rate limit.
        if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
            return send(badRequest("Send the request as JSON."));
        }
        const text = await request.text();
        if (Buffer.byteLength(text) > MAX_BODY_BYTES) {
            return send(badRequest("The request is too large."));
        }
        let body: unknown;
        try {
            body = JSON.parse(text);
        } catch {
            return send(badRequest("The request body isn't valid JSON."));
        }
        const validation = validateInput(body);
        if (!validation.ok) return send(badRequest(validation.message));

        // 2. Rate limit (only checks; counting happens below)
        const ip = clientIp(request);
        const limit = limiter.check(ip);
        if (!limit.allowed) return send(toHttpError(new TooManyRequestsError(limit.retryAfterSeconds), now()));

        // 3. The analysis
        try {
            const result = await analyze(validation.input);
            // Answers fully served from cache cost no GitHub calls, so they don't count
            if (!(result.meta.cached.rules && result.meta.cached.target)) limiter.record(ip);
            return Response.json(result, { headers: { "Cache-Control": "no-store" } });
        } catch (err) {
            // A failed analysis still used GitHub calls (or tried to)
            limiter.record(ip);
            const httpError = toHttpError(err, now());
            // Log only the error's name: the full error can contain request details
            if (httpError.status >= 500) log(`POST /api/analyze failed: ${httpError.body.error.code} (${errorName(err)})`);
            return send(httpError);
        }
    };
}

function send(error: HttpError): Response {
    const headers: Record<string, string> = { "Cache-Control": "no-store" };
    if (error.retryAfterSeconds !== null) headers["Retry-After"] = String(error.retryAfterSeconds);
    return Response.json(error.body, { status: error.status, headers });
}

// The visitor's IP. On Vercel, x-forwarded-for is set by the platform (a
// visitor can't fake it); its first entry is the visitor. Locally there is
// none, so everyone shares the "unknown" bucket.
export function clientIp(request: Request): string {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function errorName(err: unknown): string {
    return err instanceof Error ? err.name : typeof err;
}
