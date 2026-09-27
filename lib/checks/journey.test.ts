import { describe, it, expect } from "vitest";
import { buildJourney, worstStatus } from "./journey";
import type { Check, CheckStatus, Stage } from "./types";

function check(stage: Stage, status: CheckStatus, message = "x"): Check {
    return { id: `${stage}-${status}`, ruleType: null, stage, status, message, howToFix: [], evidence: { rules: [], observed: [] } };
}

describe("worstStatus", () => {
    it("fail > warn > manual > pending > pass > skip", () => {
        expect(worstStatus([check("pr", "pass"), check("pr", "warn"), check("pr", "fail")])).toBe("fail");
        expect(worstStatus([check("pr", "pass"), check("pr", "manual"), check("pr", "warn")])).toBe("warn");
        expect(worstStatus([check("pr", "pending"), check("pr", "manual")])).toBe("manual");
        expect(worstStatus([check("pr", "pass"), check("pr", "pending")])).toBe("pending");
        expect(worstStatus([check("pr", "skip"), check("pr", "pass")])).toBe("pass");
        expect(worstStatus([])).toBe("skip");
    });
});

describe("buildJourney", () => {
    it("gives the five stages in order, each with its worst status and a short summary", () => {
        const journey = buildJourney(
            [
                check("issue", "pass"),
                check("work", "warn"),
                check("commit", "fail"),
                check("commit", "fail"),
                check("commit", "warn"),
                check("pr", "manual"),
                check("merge", "pending", "Waiting for a maintainer to review."),
            ],
            "pr"
        );
        expect(journey).toEqual([
            { stage: "issue", status: "pass", summary: "All good" },
            { stage: "work", status: "warn", summary: "1 to look at" },
            { stage: "commit", status: "fail", summary: "2 to fix, 1 to look at" },
            { stage: "pr", status: "manual", summary: "1 to check yourself" },
            { stage: "merge", status: "pending", summary: "Waiting for a maintainer to review." },
        ]);
    });

    it("with only an issue, later stages say to open a PR", () => {
        const journey = buildJourney([check("issue", "warn")], "issue");
        expect(journey.map((s) => s.summary)).toEqual([
            "1 to look at",
            "Open a PR to check this.",
            "Open a PR to check this.",
            "Open a PR to check this.",
            "Open a PR to check this.",
        ]);
    });

    it("a stage with only skipped checks is skipped", () => {
        const [issueStage] = buildJourney([check("issue", "skip")], "pr");
        expect(issueStage).toEqual({ stage: "issue", status: "skip", summary: "Nothing to check here." });
    });
});
