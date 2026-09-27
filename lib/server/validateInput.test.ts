import { describe, it, expect } from "vitest";
import { MAX_URL_LENGTH, validateInput } from "./validateInput";

describe("validateInput", () => {
    it("accepts a real issue link", () => {
        expect(validateInput({ url: "https://github.com/stdlib-js/stdlib/issues/12959" })).toEqual({
            ok: true,
            input: { owner: "stdlib-js", repo: "stdlib", kind: "issue", number: 12959, username: null },
        });
    });

    it("accepts a real PR link (also its /files tab) with a username", () => {
        expect(validateInput({ url: "https://github.com/stdlib-js/stdlib/pull/15585/files", username: "@AdeshDeshmukh" })).toEqual({
            ok: true,
            input: { owner: "stdlib-js", repo: "stdlib", kind: "pr", number: 15585, username: "AdeshDeshmukh" },
        });
    });

    it("treats an empty or null username as not given, and ignores extra fields", () => {
        const url = "https://github.com/a/b/issues/1";
        expect(validateInput({ url, username: "" })).toMatchObject({ ok: true, input: { username: null } });
        expect(validateInput({ url, username: null, extra: 1 })).toMatchObject({ ok: true, input: { username: null } });
    });

    it("rejects bodies that aren't a JSON object", () => {
        for (const body of [null, "https://github.com/a/b/issues/1", 42, ["url"]]) {
            expect(validateInput(body).ok).toBe(false);
        }
    });

    it("rejects a missing, empty, non-string or too-long url", () => {
        expect(validateInput({})).toEqual({ ok: false, message: "Paste a link to a GitHub issue or pull request." });
        expect(validateInput({ url: "   " }).ok).toBe(false);
        expect(validateInput({ url: 123 }).ok).toBe(false);
        const long = `https://github.com/a/b/issues/1?${"x".repeat(MAX_URL_LENGTH)}`;
        expect(validateInput({ url: long })).toEqual({
            ok: false,
            message: "That link is too long to be a GitHub issue or pull request link.",
        });
    });

    it("rejects links that aren't GitHub issues or PRs", () => {
        for (const url of [
            "https://gitlab.com/a/b/issues/1",
            "https://github.com/a/b",
            "https://github.com/a/b/discussions/5",
            "javascript:alert(1)",
            "not a link",
        ]) {
            expect(validateInput({ url }).ok).toBe(false);
        }
    });

    it("rejects bad usernames", () => {
        const url = "https://github.com/a/b/issues/1";
        for (const username of ["-bad", "a b", "x".repeat(40), 7, { name: "x" }]) {
            expect(validateInput({ url, username })).toEqual({ ok: false, message: "That doesn't look like a GitHub username." });
        }
    });
});
