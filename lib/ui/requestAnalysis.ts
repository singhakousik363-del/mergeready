// The browser side of POST /api/analyze. Turns every possible outcome into
// one simple result the page can show, and never throws.
// (Type-only imports: no server code ends up in the browser.)
import type { AnalyzeResponse } from "../server/analyze";
import type { ErrorBody } from "../server/httpErrors";

// The server stops itself at 25s; give it a little longer before giving up here
export const CLIENT_TIMEOUT_MS = 35_000;

export type AnalysisResult =
    | { ok: true; data: AnalyzeResponse }
    | { ok: false; code: string; message: string; retryAfterSeconds: number | null };

export type AnalysisRequest = { url: string; username: string };

// Returns null when `signal` cancelled the request (the user started a new check)
export async function requestAnalysis(
    { url, username }: AnalysisRequest,
    signal: AbortSignal,
    fetchImpl: typeof fetch = fetch
): Promise<AnalysisResult | null> {
    let response: Response;
    try {
        response = await fetchImpl("/api/analyze", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ url: url.trim(), username: username.trim() || undefined }),
            signal: AbortSignal.any([signal, AbortSignal.timeout(CLIENT_TIMEOUT_MS)]),
        });
    } catch (err) {
        if (signal.aborted) return null;
        if (err instanceof Error && err.name === "TimeoutError") {
            return failure("CLIENT_TIMEOUT", "The check took too long. Please try again in a moment.");
        }
        return failure("NETWORK", "Couldn't reach MergeReady. Check your internet connection and try again.");
    }

    let body: unknown;
    try {
        body = await response.json();
    } catch {
        return failure("BAD_RESPONSE", "Something went wrong on our side. Please try again.");
    }

    if (response.ok && isRecord(body) && body.ok === true) {
        return { ok: true, data: body as AnalyzeResponse };
    }
    if (isErrorBody(body)) {
        const retryAfter = Number(response.headers.get("retry-after"));
        return failure(body.error.code, body.error.message, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null);
    }
    return failure("BAD_RESPONSE", "Something went wrong on our side. Please try again.");
}

function failure(code: string, message: string, retryAfterSeconds: number | null = null): AnalysisResult {
    return { ok: false, code, message, retryAfterSeconds };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isErrorBody(value: unknown): value is ErrorBody {
    return (
        isRecord(value) &&
        value.ok === false &&
        isRecord(value.error) &&
        typeof value.error.code === "string" &&
        typeof value.error.message === "string"
    );
}
