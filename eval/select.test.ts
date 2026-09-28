import { describe, it, expect } from "vitest";
import { classifyPr, type ListedPr } from "./select";

function pr(parts: Partial<ListedPr>): ListedPr {
    return {
        number: 1,
        title: "fix: x",
        url: "https://github.com/a/b/pull/1",
        createdAt: "2026-09-01T00:00:00Z",
        state: "CLOSED",
        authorAssociation: "NONE",
        author: { __typename: "User", login: "newcomer" },
        comments: { nodes: [] },
        reviews: { nodes: [] },
        ...parts,
    };
}

describe("classifyPr (rules 1, 2, 3 and 5 of SELECTION.md)", () => {
    it("keeps a closed PR by a person who isn't a maintainer", () => {
        expect(classifyPr(pr({}))).toBe("candidate");
    });

    it("drops PRs opened after the cutoff", () => {
        expect(classifyPr(pr({ createdAt: "2026-09-15T00:00:00Z" }))).toBe("after-cutoff");
        expect(classifyPr(pr({ createdAt: "2026-09-14T23:59:59Z" }))).toBe("candidate");
    });

    it("drops bots, by account type or by name", () => {
        expect(classifyPr(pr({ author: { __typename: "Bot", login: "renovate" } }))).toBe("bot");
        expect(classifyPr(pr({ author: { __typename: "User", login: "stdlib-bot" } }))).toBe("bot");
        expect(classifyPr(pr({ author: null }))).toBe("bot");
    });

    it("drops maintainers", () => {
        for (const association of ["OWNER", "MEMBER", "COLLABORATOR"]) {
            expect(classifyPr(pr({ authorAssociation: association }))).toBe("maintainer");
        }
    });

    it("an open PR needs a maintainer comment or review that isn't the author's own", () => {
        const open = { state: "OPEN" as const };
        expect(classifyPr(pr(open))).toBe("not-looked-at");
        expect(classifyPr(pr({ ...open, comments: { nodes: [{ authorAssociation: "CONTRIBUTOR", author: { login: "x" } }] } }))).toBe(
            "not-looked-at"
        );
        expect(classifyPr(pr({ ...open, reviews: { nodes: [{ authorAssociation: "MEMBER", author: { login: "kgryte" } }] } }))).toBe(
            "candidate"
        );
    });
});
