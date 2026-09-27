import { describe, it, expect, vi } from "vitest";
import { requestAnalysis } from "./requestAnalysis";

const INPUT = { url: " https://github.com/stdlib-js/stdlib/issues/12959 ", username: "" };

function respond(status: number, body: unknown, headers: Record<string, string> = {}): typeof fetch {
    return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } }));
}

describe("requestAnalysis", () => {
    it("posts the trimmed link (and no empty username) and returns the data", async () => {
        const fetchImpl = respond(200, { ok: true, kind: "issue" });
        const result = await requestAnalysis(INPUT, new AbortController().signal, fetchImpl);

        expect(result).toEqual({ ok: true, data: { ok: true, kind: "issue" } });
        const [url, init] = vi.mocked(fetchImpl).mock.calls[0];
        expect(url).toBe("/api/analyze");
        expect(JSON.parse(String(init?.body))).toEqual({ url: "https://github.com/stdlib-js/stdlib/issues/12959" });
    });

    it("passes on the server's friendly error and Retry-After", async () => {
        const fetchImpl = respond(
            429,
            { ok: false, error: { code: "TOO_MANY_REQUESTS", message: "Too many checks from your network. Please try again in 42 seconds." } },
            { "retry-after": "42" }
        );
        expect(await requestAnalysis(INPUT, new AbortController().signal, fetchImpl)).toEqual({
            ok: false,
            code: "TOO_MANY_REQUESTS",
            message: "Too many checks from your network. Please try again in 42 seconds.",
            retryAfterSeconds: 42,
        });
    });

    it("gives a generic message for anything unexpected (e.g. an HTML error page)", async () => {
        const html: typeof fetch = vi.fn(async () => new Response("<html>502</html>", { status: 502 }));
        expect(await requestAnalysis(INPUT, new AbortController().signal, html)).toMatchObject({
            ok: false,
            code: "BAD_RESPONSE",
        });
        expect(await requestAnalysis(INPUT, new AbortController().signal, respond(200, { weird: true }))).toMatchObject({
            code: "BAD_RESPONSE",
        });
    });

    it("says so when the network is down", async () => {
        const offline: typeof fetch = vi.fn(async () => {
            throw new TypeError("Failed to fetch");
        });
        expect(await requestAnalysis(INPUT, new AbortController().signal, offline)).toMatchObject({ code: "NETWORK" });
    });

    it("returns null when the user started a new check (cancelled)", async () => {
        const controller = new AbortController();
        const slow: typeof fetch = vi.fn(
            (_url, init) =>
                new Promise<Response>((_resolve, reject) => {
                    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
                })
        );
        const pending = requestAnalysis(INPUT, controller.signal, slow);
        controller.abort();
        expect(await pending).toBeNull();
    });
});
