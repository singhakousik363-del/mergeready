import { describe, it, expect } from "vitest";
import { findDocLinks, findExternalGuide, resolveDocPath } from "./docLinks";

// Real excerpt (trimmed) from https://github.com/nodejs/node/blob/main/CONTRIBUTING.md
const NODE_CONTRIBUTING = `# Contributing to Node.js

> \\[!TIP]
> Contributing for the first time? Please read our
> [Guide for First-Time Contributors](./doc/contributing/first-contributions.md) for tips
> and answers to FAQs.

The Node.js project has an open governance model.
Individuals making significant and valuable contributions are made
Collaborators and given commit-access to the project. See the
[GOVERNANCE.md](./GOVERNANCE.md) document for more information about how this
works.

## Contents

* [Code of Conduct](#code-of-conduct)
* [Pull Requests](#pull-requests)

## [Code of Conduct](./doc/contributing/code-of-conduct.md)

The Node.js project has a
[Code of Conduct](https://github.com/nodejs/admin/blob/HEAD/CODE_OF_CONDUCT.md)
to which all contributors must adhere.

## [Issues](./doc/contributing/issues.md)

* [Asking for General Help](./doc/contributing/issues.md#asking-for-general-help)

## [Pull Requests](./doc/contributing/pull-requests.md)

* [Dependencies](./doc/contributing/pull-requests.md#dependencies)
* [Reviewing Pull Requests](./doc/contributing/pull-requests.md#reviewing-pull-requests)
* [Large Pull Requests](./doc/contributing/large-pull-requests.md)

## [AI Use Policy and Guidelines](./doc/contributing/ai-guidelines.md)
`;

// Full file from https://github.com/facebook/react/blob/main/CONTRIBUTING.md
const REACT_CONTRIBUTING = `# Contributing to React

Want to contribute to React? There are a few things you need to know.

We wrote a **[contribution guide](https://reactjs.org/docs/how-to-contribute.html)** to help you get started.
`;

// Most tests read a CONTRIBUTING file from acme/app
const ACME_APP = [{ owner: "acme", repo: "app" }];

// Real lines from https://github.com/stdlib-js/stdlib/blob/develop/CONTRIBUTING.md
// stdlib links to its own docs with full URLs and reference-style links
const STDLIB_CONTRIBUTING_LINES = `-   read and follow the [development guide][stdlib-development].
When writing commit messages, follow the Git [style guide][stdlib-style-guides-git].

[stdlib-code-of-conduct]: https://github.com/stdlib-js/stdlib/blob/develop/CODE_OF_CONDUCT.md
[stdlib-style-guides-git]: https://github.com/stdlib-js/stdlib/blob/develop/docs/style-guides/git
[stdlib-doctest]: https://github.com/stdlib-js/stdlib/blob/develop/docs/contributing/doctest.md
[stdlib-development]: https://github.com/stdlib-js/stdlib/blob/develop/docs/contributing/development.md
[stdlib-branching]: https://github.com/stdlib-js/stdlib/blob/develop/docs/contributing/branching.md
[stdlib-pull-requests]: https://github.com/stdlib-js/stdlib/pulls
[github-pull-request]: https://help.github.com/articles/creating-a-pull-request/
`;
const STDLIB = [{ owner: "stdlib-js", repo: "stdlib" }];

function paths(text: string, fromPath = "CONTRIBUTING.md"): string[] {
    return findDocLinks(text, fromPath, ACME_APP).map((link) => link.path);
}

describe("findDocLinks", () => {
    it("picks the PR and first-timer docs from the real Node.js CONTRIBUTING", () => {
        expect(findDocLinks(NODE_CONTRIBUTING, "CONTRIBUTING.md", [{ owner: "nodejs", repo: "node" }])).toEqual([
            {
                path: "doc/contributing/first-contributions.md",
                linkText: "Guide for First-Time Contributors",
                score: 2,
            },
            { path: "doc/contributing/pull-requests.md", linkText: "Pull Requests", score: 2 },
            { path: "doc/contributing/large-pull-requests.md", linkText: "Large Pull Requests", score: 2 },
        ]);
    });

    it("never follows CODE_OF_CONDUCT or GOVERNANCE, even with a matching link text", () => {
        const text = `[How to contribute](./CODE_OF_CONDUCT.md) [PR rules](docs/governance.md) [Commits](code-of-conduct.rst)`;

        expect(paths(text)).toEqual([]);
    });

    it("scores only the file name and link text, not the parent folders", () => {
        const text = `[Setup](./doc/contributing/setup.md) [Style](./pull-requests/style.md)`;

        expect(paths(text)).toEqual([]);
    });

    it("gives 2 points to newcomer and beginner docs, 1 point to contributing docs", () => {
        const text = `[Contributors](./contributors.md) [Start here](./NEWCOMERS.md) [Help](./beginner_guide.md)`;

        expect(findDocLinks(text, "CONTRIBUTING.md", ACME_APP).map((l) => [l.path, l.score])).toEqual([
            ["NEWCOMERS.md", 2],
            ["beginner_guide.md", 2],
            ["contributors.md", 1],
        ]);
    });

    it("resolves ../ and / links from a CONTRIBUTING file inside .github/", () => {
        const text = `[PR guide](../docs/pr-guide.md) [Commit style](/COMMITS.md) [Outside](../../escape-pr.md)`;

        expect(paths(text, ".github/CONTRIBUTING.md")).toEqual(["docs/pr-guide.md", "COMMITS.md"]);
    });

    it("ignores websites, emails, anchors, images, non-doc files and itself", () => {
        const text = [
            "[PR guide](https://example.com/pull-requests.md)",
            "[PR guide](//example.com/pull-requests.md)",
            "[Mail PR team](mailto:pr@example.com)",
            "[Pull requests](#pull-requests)",
            "![Pull request flow](./pull-request-flow.md)",
            "[Commit script](./scripts/commit.sh)",
            "[Contributing](./CONTRIBUTING.md#top)",
        ].join("\n");

        expect(paths(text)).toEqual([]);
    });

    it("understands reference-style markdown links and reStructuredText links", () => {
        const markdown = `See the [commit guide][commits].\n\n[commits]: ./docs/commit-messages.md "Commits"\n`;
        const rst = "Read `Pull request guide <docs/pull_requests.rst>`_ first.";

        expect(paths(markdown)).toEqual(["docs/commit-messages.md"]);
        expect(paths(rst)).toEqual(["docs/pull_requests.rst"]);
    });

    it("lists a file linked twice once, with its best link text", () => {
        const text = `[Notes](./doc/guide.md#notes) and later [Pull request guide](./doc/guide.md)`;

        expect(findDocLinks(text, "CONTRIBUTING.md", ACME_APP)).toEqual([
            { path: "doc/guide.md", linkText: "Pull request guide", score: 2 },
        ]);
    });

    it("decodes %20 in paths and rejects broken encoding", () => {
        const text = `[PR guide](./pull%20requests.md) [Commits](./commits%E0%A4.md)`;

        expect(paths(text)).toEqual(["pull requests.md"]);
    });
});

describe("findExternalGuide", () => {
    it("finds the website the real React CONTRIBUTING points to", () => {
        expect(findExternalGuide(REACT_CONTRIBUTING, [{ owner: "react", repo: "react" }])).toBe(
            "https://reactjs.org/docs/how-to-contribute.html"
        );
    });

    it("returns null for a CONTRIBUTING file with lots of its own text", () => {
        const longText = `${"Please write tests for every change you make. ".repeat(40)}\n${REACT_CONTRIBUTING}`;

        expect(findExternalGuide(longText, [{ owner: "react", repo: "react" }])).toBeNull();
    });

    it("does not count links back into the same repo, or unrelated links, as a guide", () => {
        const text = [
            "# Contributing",
            "[Contributing](https://github.com/acme/app/blob/main/docs/contributing.md)",
            "[Chat with us](https://discord.gg/acme)",
        ].join("\n");

        expect(findExternalGuide(text, ACME_APP)).toBeNull();
    });
});

describe("full GitHub URLs to the same repo", () => {
    it("turns real stdlib links into repo paths", () => {
        const url = (path: string) => `https://github.com/stdlib-js/stdlib/blob/develop/${path}`;

        expect(resolveDocPath(url("docs/contributing/development.md"), "CONTRIBUTING.md", STDLIB)).toBe(
            "docs/contributing/development.md"
        );
        expect(resolveDocPath(url("docs/contributing/doctest.md#usage"), "CONTRIBUTING.md", STDLIB)).toBe(
            "docs/contributing/doctest.md"
        );
        // A folder, not a .md file
        expect(resolveDocPath(url("docs/style-guides/git"), "CONTRIBUTING.md", STDLIB)).toBeNull();
        // Not a file link at all
        expect(resolveDocPath("https://github.com/stdlib-js/stdlib/pulls", "CONTRIBUTING.md", STDLIB)).toBeNull();
    });

    it("finds nothing to follow in the real stdlib lines, because no file name or text scores", () => {
        // development.md, doctest.md and branching.md have no PR/commit/first-timer words,
        // CODE_OF_CONDUCT is never followed, and the Git style guide is a folder
        expect(findDocLinks(STDLIB_CONTRIBUTING_LINES, "CONTRIBUTING.md", STDLIB)).toEqual([]);
    });

    it("follows a full URL to the same repo like a relative link", () => {
        const text = "[Pull request guide](https://github.com/acme/app/blob/main/docs/pull-requests.md)";

        expect(paths(text)).toEqual(["docs/pull-requests.md"]);
    });

    it("matches owner and repo without caring about upper/lower case", () => {
        const text = "[Commit rules](https://github.com/ACME/App/blob/main/COMMITS.md)";

        expect(paths(text)).toEqual(["COMMITS.md"]);
    });

    it("accepts the old name of a renamed repo, like facebook/react -> react/react", () => {
        const text = "[Pull requests](https://github.com/facebook/react/blob/main/docs/pull-requests.md)";
        const reactNames = [
            { owner: "react", repo: "react" },
            { owner: "facebook", repo: "react" },
        ];

        expect(findDocLinks(text, "CONTRIBUTING.md", reactNames).map((l) => l.path)).toEqual([
            "docs/pull-requests.md",
        ]);
    });

    it("ignores full URLs to other repos and URLs that escape the repo", () => {
        const text = [
            "[PR guide](https://github.com/other/app/blob/main/pull-requests.md)",
            "[PR guide](https://github.com/acme/app-docs/blob/main/pull-requests.md)",
            "[PR guide](https://github.com/acme/app/blob/main/../../pull-requests.md)",
            "[PR guide](https://gitlab.com/acme/app/blob/main/pull-requests.md)",
        ].join("\n");

        expect(paths(text)).toEqual([]);
    });

    it("does not count full URLs into the same repo as an external guide", () => {
        const text = "# Contributing\n[PR guide](https://github.com/acme/app/blob/main/docs/pr-guide.md)";

        expect(findExternalGuide(text, ACME_APP)).toBeNull();
    });
});
