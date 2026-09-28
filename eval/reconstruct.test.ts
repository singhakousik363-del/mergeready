import { describe, it, expect } from "vitest";
import { assigneesAt, bodyHistory, firstPushCommits, originalTitle } from "./reconstruct";

describe("bodyHistory", () => {
    it("a body that was never edited is the original", () => {
        expect(bodyHistory("Fixes #1", [])).toEqual({ original: "Fixes #1", versions: [] });
    });

    it("the OLDEST version is the original, whatever order GitHub lists them in", () => {
        const result = bodyHistory("v3", [
            { createdAt: "2026-09-03T00:00:00Z", editedAt: "2026-09-03T00:00:00Z", diff: "v3", editor: { login: "maintainer" } },
            { createdAt: "2026-09-01T00:00:00Z", editedAt: "2026-09-01T00:00:00Z", diff: "v1", editor: { login: "author" } },
            { createdAt: "2026-09-02T00:00:00Z", editedAt: "2026-09-02T00:00:00Z", diff: "v2", editor: { login: "author" } },
        ]);
        expect(result?.original).toBe("v1");
        expect(result?.versions.map((v) => [v.text, v.editor])).toEqual([
            ["v1", "author"],
            ["v2", "author"],
            ["v3", "maintainer"],
        ]);
    });

    it("returns null when the oldest text is gone (so the PR is excluded)", () => {
        expect(bodyHistory("now", [{ createdAt: "2026-09-01T00:00:00Z", editedAt: "2026-09-01T00:00:00Z", diff: null, editor: null }])).toBeNull();
    });
});

describe("originalTitle", () => {
    it("is the old title of the first rename", () => {
        expect(
            originalTitle("fix(math): handle NaN", [
                { at: "2026-09-05T00:00:00Z", from: "Fix NaN handling" },
                { at: "2026-09-02T00:00:00Z", from: "fixed nan" },
            ])
        ).toBe("fixed nan");
        expect(originalTitle("same", [])).toBe("same");
    });
});

describe("firstPushCommits", () => {
    it("keeps commits dated up to 10 minutes after the PR was opened", () => {
        const commits = [
            { sha: "a", date: "2026-09-01T09:00:00Z" },
            { sha: "b", date: "2026-09-01T10:09:00Z" },
            { sha: "c", date: "2026-09-02T12:00:00Z" },
        ];
        const { first, later } = firstPushCommits(commits, "2026-09-01T10:00:00Z");
        expect(first.map((c) => c.sha)).toEqual(["a", "b"]);
        expect(later.map((c) => c.sha)).toEqual(["c"]);
    });
});

describe("assigneesAt", () => {
    const events = [
        { type: "assigned" as const, at: "2026-09-01T00:00:00Z", login: "alice" },
        { type: "unassigned" as const, at: "2026-09-03T00:00:00Z", login: "alice" },
        { type: "assigned" as const, at: "2026-09-04T00:00:00Z", login: "bob" },
    ];

    it("replays assign/unassign events up to the given time", () => {
        expect(assigneesAt(events, "2026-09-02T00:00:00Z")).toEqual(["alice"]);
        expect(assigneesAt(events, "2026-09-03T12:00:00Z")).toEqual([]);
        expect(assigneesAt(events, "2026-09-05T00:00:00Z")).toEqual(["bob"]);
    });
});
