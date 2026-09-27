import { isValidLogin } from "../github/client";
import { parseGithubUrl } from "../github/parseUrl";

export const MAX_BODY_BYTES = 4 * 1024;
export const MAX_URL_LENGTH = 500;

export type AnalyzeInput = {
    owner: string;
    repo: string;
    kind: "issue" | "pr";
    number: number;
    // The user's GitHub name, if they gave one
    username: string | null;
};

export type ValidationResult = { ok: true; input: AnalyzeInput } | { ok: false; message: string };

// Checks the JSON body of POST /api/analyze: { url, username? }.
// Everything from the browser is untrusted, so anything unexpected is rejected.
export function validateInput(body: unknown): ValidationResult {
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
        return { ok: false, message: 'Send JSON like {"url": "https://github.com/owner/repo/issues/1"}.' };
    }

    const url = "url" in body ? body.url : undefined;
    if (typeof url !== "string" || url.trim() === "") {
        return { ok: false, message: "Paste a link to a GitHub issue or pull request." };
    }
    if (url.length > MAX_URL_LENGTH) {
        return { ok: false, message: "That link is too long to be a GitHub issue or pull request link." };
    }

    const parsed = parseGithubUrl(url);
    if (!parsed.ok) return { ok: false, message: parsed.error };

    // username is optional; "" counts as not given
    const rawUsername = "username" in body ? body.username : undefined;
    let username: string | null = null;
    if (rawUsername !== undefined && rawUsername !== null && rawUsername !== "") {
        if (typeof rawUsername !== "string" || !isValidLogin(rawUsername.trim().replace(/^@/, ""))) {
            return { ok: false, message: "That doesn't look like a GitHub username." };
        }
        // People often type "@name"
        username = rawUsername.trim().replace(/^@/, "");
    }

    return {
        ok: true,
        input: {
            owner: parsed.owner,
            repo: parsed.repo,
            kind: parsed.type === "pull" ? "pr" : "issue",
            number: parsed.number,
            username,
        },
    };
}
