import { describe, it, expect } from "vitest";
import { finalCategories, score, wilson, type Pair } from "./metrics";

describe("wilson", () => {
    it("matches the known 95% interval for 8 of 10", () => {
        const r = wilson(8, 10);
        expect(r.value).toBe(0.8);
        expect(r.low).toBeCloseTo(0.49, 2);
        expect(r.high).toBeCloseTo(0.943, 2);
    });

    it("stays inside 0..1 at the edges and says 'no data' for n = 0", () => {
        expect(wilson(0, 5).low).toBe(0);
        expect(wilson(5, 5).high).toBe(1);
        expect(wilson(0, 0)).toEqual({ k: 0, n: 0, value: null, low: null, high: null });
    });
});

describe("score", () => {
    const pair = (objection: boolean, flag: Pair["flag"]): Pair => ({ pr: "a/b#1", repo: "a/b", ruleType: "dco-signoff", objection, flag });

    it("counts recall over objections and precision over flags, red and yellow apart", () => {
        const s = score([
            pair(true, "red"), // caught
            pair(true, "yellow"), // caught
            pair(true, null), // missed
            pair(false, "red"), // not raised by maintainers
            pair(false, null),
        ]);
        expect([s.objections, s.flags]).toEqual([3, 3]);
        expect([s.recall.k, s.recall.n]).toEqual([2, 3]);
        expect([s.precision.k, s.precision.n]).toEqual([2, 3]);
        expect([s.precisionRed.k, s.precisionRed.n]).toEqual([1, 2]);
        expect([s.precisionYellow.k, s.precisionYellow.n]).toEqual([1, 1]);
    });
});

describe("finalCategories", () => {
    it("uses confirmed and changed suggestions plus added objections, not rejected ones", () => {
        const categories = finalCategories({
            suggestions: [
                { category: "commit-format", decision: "reject" },
                { category: "template", decision: "change:not-checkable" },
                { category: "dco", decision: "confirm" },
            ],
            added: [{ category: "template" }],
        });
        expect([...categories].sort()).toEqual(["dco", "not-checkable", "template"]);
    });
});
