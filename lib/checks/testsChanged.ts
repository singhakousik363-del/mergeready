import type { ChangedFile, PullRequestData } from "../github/fetchPullRequest";
import type { Rule } from "../rules/types";
import { evidenceOf, failStatus, plural, rulesOfType, steps, type Check } from "./types";

// Test files, by the usual naming conventions:
// test/ tests/ __tests__/ spec/ folders, x.test.js, x.spec.ts, x_test.go, test_x.py, XTest.java
const TEST_FILE = [
    /(?:^|\/)(?:tests?|__tests__|specs?)\//i,
    /\.(?:test|spec)\.[^/]+$/i,
    /_test\.[^/]+$/i,
    /(?:^|\/)test_[^/]+\.py$/i,
    /Tests?\.(?:java|kt|cs|swift|php)$/,
];
// Source code, by file extension
const CODE_FILE = /\.(?:[cm]?[jt]sx?|py|go|rs|java|kt|kts|scala|c|h|cc|cpp|cxx|hpp|cs|rb|php|swift|m|mm|lua|dart|ex|exs|erl|hs|clj|r|jl|sh)$/i;
// Code that doesn't need tests: docs, examples and benchmarks
const NO_TESTS_NEEDED = /(?:^|\/)(?:docs?|examples?|benchmarks?)\//i;

// Code changed without any test file changing?
export function checkTestsChanged(rules: Rule[], pr: PullRequestData): Check {
    const testRules = rulesOfType(rules, "tests-changed");
    const tests = pr.files.filter(isTestFile);
    const code = pr.files.filter((f) => !isTestFile(f) && CODE_FILE.test(f.filename) && !NO_TESTS_NEEDED.test(f.filename));
    const observed = [`${plural(code.length, "code file")} and ${plural(tests.length, "test file")} changed`];

    const base = { id: "tests-changed", ruleType: "tests-changed" as const, stage: "work" as const };

    if (testRules.length === 0) {
        return { ...base, status: "skip", message: "This repo doesn't seem to ask for tests.", howToFix: [], evidence: { rules: [], observed } };
    }
    const evidence = { rules: evidenceOf(testRules), observed };

    if (code.length === 0) {
        return { ...base, status: "pass", message: "No code files changed (for example docs only), so no tests are needed.", howToFix: [], evidence };
    }
    if (tests.length > 0) {
        return { ...base, status: "pass", message: "You changed code and tests.", howToFix: [], evidence };
    }
    // Show a few of the code files, so the user knows what needs a test
    const shown = code.slice(0, 5).map((f) => `Code changed: ${f.filename}`);
    return {
        ...base,
        status: failStatus(testRules),
        message: `You changed ${plural(code.length, "code file")} but no test files.`,
        howToFix: steps(
            "Add or update a test that fails without your change and passes with it.",
            "Look at how existing tests are named in this repo (for example a test/ folder or *.test.js files) and follow that.",
        ),
        evidence: { ...evidence, observed: [...observed, ...shown] },
    };
}

function isTestFile(file: ChangedFile): boolean {
    return TEST_FILE.some((pattern) => pattern.test(file.filename));
}
