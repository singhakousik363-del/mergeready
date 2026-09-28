import { describe, it, expect } from "vitest";
import { isStrict } from "./strictness";

describe("isStrict", () => {
    it("is strict for must, required, mandatory and 'cannot be merged' style words", () => {
        expect(isStrict("Your commit must contain the `Signed-off-by` line.")).toBe(true);
        expect(isStrict("A linked issue is required.")).toBe(true);
        expect(isStrict("Tests are mandatory.")).toBe(true);
        expect(isStrict("Make sure to sign off your commits, or they cannot be merged.")).toBe(true);
        expect(isStrict("PRs without tests won't be accepted.")).toBe(true);
        expect(isStrict("PRs without a description will be closed.")).toBe(true);
    });

    it("is not strict for advice words", () => {
        expect(isStrict("Bug fixes and features should always come with tests.")).toBe(false);
        expect(isStrict("Be sure to sign off on the DCO.")).toBe(false);
        expect(isStrict("Please make sure you read the guide.")).toBe(false);
        expect(isStrict("Use the `Fixes:` prefix and the full issue URL.")).toBe(false);
    });

    it("is not strict when the sentence only sometimes applies", () => {
        expect(isStrict("If your PR fixes a bug, you must add a test.")).toBe(false);
        expect(isStrict("A test is required if applicable.")).toBe(false);
        expect(isStrict("Screenshots (optional, but required for UI changes)")).toBe(false);
        expect(isStrict("Remove this if it's not required.")).toBe(false);
    });
});
