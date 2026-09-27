import { readFileSync } from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import { checkTestsChanged } from "./testsChanged";
import type { PullRequestData } from "../github/fetchPullRequest";
import type { Rule } from "../rules/types";

// Real data, see __fixtures__/SOURCES.md
function fixture<T>(name: string): T {
    return JSON.parse(readFileSync(path.join(import.meta.dirname, "__fixtures__", name), "utf8"));
}
const REAL_PR = fixture<PullRequestData>("stdlib-pr-15585.json");

// Real rule found by try-rules
const STDLIB_TESTS_RULE: Rule = {
    type: "tests-changed",
    details: null,
    confidence: "prose",
    sourceQuote: "Tests should accompany **all** bug fixes and features.",
    sourceUrl: "https://github.com/stdlib-js/stdlib/blob/develop/CONTRIBUTING.md?plain=1#L241",
};

describe("checkTestsChanged", () => {
    it("real PR #15585 changes code and tests (docs/types files don't count as code)", () => {
        const check = checkTestsChanged([STDLIB_TESTS_RULE], REAL_PR);
        expect(check).toMatchObject({ stage: "work", status: "pass", message: "You changed code and tests." });
        expect(check.evidence.observed).toEqual(["6 code files and 5 test files changed"]);
    });

    it("yellow (prose rule) when the same code changes come without the test files", () => {
        const noTests = { ...REAL_PR, files: REAL_PR.files.filter((f) => !f.filename.includes("/test/")) };
        const check = checkTestsChanged([STDLIB_TESTS_RULE], noTests);
        expect(check.status).toBe("warn");
        expect(check.message).toBe("You changed 6 code files but no test files.");
        expect(check.evidence.observed[1]).toBe("Code changed: lib/node_modules/@stdlib/stats/base/dists/rayleigh/ctor/lib/main.js");
    });

    it("knows common test file names", () => {
        const files = ["src/app.test.ts", "pkg/server_test.go", "tests/test_api.py", "src/__tests__/a.js", "src/test/java/FooTest.java"];
        for (const filename of files) {
            const pr = { ...REAL_PR, files: [{ filename: "src/app.ts", status: "modified" }, { filename, status: "added" }] };
            expect(checkTestsChanged([STDLIB_TESTS_RULE], pr).status).toBe("pass");
        }
    });

    it("docs-only and example-only changes need no tests", () => {
        const pr = { ...REAL_PR, files: [{ filename: "README.md", status: "modified" }, { filename: "examples/demo.js", status: "added" }] };
        expect(checkTestsChanged([STDLIB_TESTS_RULE], pr).message).toBe(
            "No code files changed (for example docs only), so no tests are needed."
        );
    });

    it("skips without a rule", () => {
        expect(checkTestsChanged([], REAL_PR).status).toBe("skip");
    });
});
