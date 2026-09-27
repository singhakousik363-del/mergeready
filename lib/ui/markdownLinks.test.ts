import { describe, it, expect } from "vitest";
import { defaultUrlTransform } from "react-markdown";
import { resolveDocLink, withReferences } from "./markdownLinks";

// Real source links from try-rules
const NODE_CONTRIBUTING = "https://github.com/nodejs/node/blob/main/CONTRIBUTING.md?plain=1#L46";

describe("resolveDocLink", () => {
    it("turns nodejs/node's relative doc links into GitHub links", () => {
        expect(resolveDocLink("./doc/contributing/pull-requests.md", NODE_CONTRIBUTING)).toBe(
            "https://github.com/nodejs/node/blob/main/doc/contributing/pull-requests.md"
        );
        expect(resolveDocLink("../README.md#install", "https://github.com/a/b/blob/main/docs/x.md?plain=1#L1")).toBe(
            "https://github.com/a/b/blob/main/README.md#install"
        );
    });

    it("points '#anchor' links at the section in the original file", () => {
        expect(resolveDocLink("#commit-message-guidelines", NODE_CONTRIBUTING)).toBe(
            "https://github.com/nodejs/node/blob/main/CONTRIBUTING.md#commit-message-guidelines"
        );
    });

    it("keeps full links", () => {
        expect(resolveDocLink("https://developercertificate.org/", NODE_CONTRIBUTING)).toBe("https://developercertificate.org/");
    });

    it("unsafe links end up empty after react-markdown's defaultUrlTransform", () => {
        expect(defaultUrlTransform(resolveDocLink("javascript:alert(1)", NODE_CONTRIBUTING))).toBe("");
    });
});

describe("withReferences", () => {
    it("adds the link targets under the text", () => {
        expect(
            withReferences("follow the Git [style guide][stdlib-style-guides-git].", [
                { label: "stdlib-style-guides-git", url: "https://github.com/stdlib-js/stdlib/blob/develop/docs/style-guides/git" },
            ])
        ).toBe(
            "follow the Git [style guide][stdlib-style-guides-git].\n\n" +
                "[stdlib-style-guides-git]: https://github.com/stdlib-js/stdlib/blob/develop/docs/style-guides/git\n"
        );
    });

    it("leaves text without references alone", () => {
        expect(withReferences("plain", [])).toBe("plain");
    });
});
