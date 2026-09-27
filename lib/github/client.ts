import { Octokit } from "@octokit/rest";
import { MissingTokenError } from "./errors";

// Give up on any single GitHub request after this long
export const GITHUB_TIMEOUT_MS = 10_000;

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
