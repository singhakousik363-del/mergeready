import { afterEach, describe, it, expect, vi } from "vitest";
import type { Octokit } from "@octokit/rest";
import { fetchGuidelines } from "./fetchGuidelines";
import { MissingTokenError, RateLimitError, RepoNotFoundError } from "./errors";

// Real excerpts (trimmed) so tests look like real repos
// Source: https://github.com/facebook/react/blob/main/.github/PULL_REQUEST_TEMPLATE.md
const REACT_PR_TEMPLATE = `## Summary

<!--
 Explain the **motivation** for making this change. What existing problem does the pull request solve?
-->

## How did you test this change?
`;

// Source: https://github.com/nodejs/node/blob/main/CONTRIBUTING.md
const NODE_CONTRIBUTING = `# Contributing to Node.js

The Node.js project welcomes all contributions from anyone willing to work in
good faith with other contributors and the community.
`;

type FakeRepo = {
    // path -> file text. Folders are worked out from the paths.
    files: Record<string, string>;
    // What the community profile API reports (paths inside this repo)
    profile?: { contributing?: string; prTemplate?: string };
    // Make the profile API fail with this error instead
    profileError?: Error;
    // Override the reported size of a file (to test huge files)
    sizes?: Record<string, number>;
};

// Error shaped like Octokit's RequestError
function httpError(status: number, message: string, headers: Record<string, string> = {}): Error {
    return Object.assign(new Error(message), { status, response: { headers } });
}

function contentsUrl(path: string): string {
    return `https://api.github.com/repos/acme/app/contents/${path}?ref=main`;
}

function htmlUrl(path: string): string {
    return `https://github.com/acme/app/blob/main/${path}`;
}

// A fake Octokit with only the 3 methods fetchGuidelines uses
function createFakeOctokit(fake: FakeRepo) {
    const getCommunityProfileMetrics = vi.fn(async () => {
        if (fake.profileError) throw fake.profileError;
        const health = (path?: string) => (path ? { url: contentsUrl(path), html_url: htmlUrl(path) } : null);
        return {
            data: {
                files: {
                    contributing: health(fake.profile?.contributing),
                    pull_request_template: health(fake.profile?.prTemplate),
                },
            },
        };
    });

    const getContent = vi.fn(async ({ path }: { path: string }) => {
        const file = fake.files[path];
        if (file !== undefined) {
            return {
                data: {
                    type: "file",
                    name: path.split("/").pop(),
                    path,
                    size: fake.sizes?.[path] ?? Buffer.byteLength(file),
                    encoding: "base64",
                    content: Buffer.from(file).toString("base64"),
                    html_url: htmlUrl(path),
                },
            };
        }

        // Is `path` a folder? List its direct children.
        const prefix = path === "" ? "" : `${path}/`;
        const children = new Map<string, "file" | "dir">();
        for (const filePath of Object.keys(fake.files)) {
            if (!filePath.startsWith(prefix)) continue;
            const [name, ...rest] = filePath.slice(prefix.length).split("/");
            children.set(name, rest.length > 0 ? "dir" : "file");
        }
        if (children.size === 0) throw httpError(404, "Not Found");
        return {
            data: [...children].map(([name, type]) => ({ name, type, path: prefix + name })),
        };
    });

    const get = vi.fn(async () => ({ data: {} }));

    const octokit = { rest: { repos: { getCommunityProfileMetrics, getContent, get } } };
    return { octokit: octokit as unknown as Octokit, getContent, get };
}

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("fetchGuidelines", () => {
    it("uses the files the community profile finds", async () => {
        const { octokit } = createFakeOctokit({
            files: {
                "CONTRIBUTING.md": NODE_CONTRIBUTING,
                ".github/PULL_REQUEST_TEMPLATE.md": REACT_PR_TEMPLATE,
            },
            profile: { contributing: "CONTRIBUTING.md", prTemplate: ".github/PULL_REQUEST_TEMPLATE.md" },
        });

        const result = await fetchGuidelines("acme", "app", { octokit });

        expect(result).toEqual({
            contributing: NODE_CONTRIBUTING,
            prTemplate: REACT_PR_TEMPLATE,
            sources: {
                contributing: htmlUrl("CONTRIBUTING.md"),
                prTemplate: htmlUrl(".github/PULL_REQUEST_TEMPLATE.md"),
            },
            warnings: [],
        });
    });

    it("falls back to searching folders when the profile finds nothing", async () => {
        const { octokit } = createFakeOctokit({
            files: {
                ".github/CONTRIBUTING.md": NODE_CONTRIBUTING,
                "docs/pull_request_template.md": REACT_PR_TEMPLATE,
            },
            profile: {},
        });

        const result = await fetchGuidelines("acme", "app", { octokit });

        expect(result.contributing).toBe(NODE_CONTRIBUTING);
        expect(result.sources.contributing).toBe(htmlUrl(".github/CONTRIBUTING.md"));
        expect(result.prTemplate).toBe(REACT_PR_TEMPLATE);
        expect(result.sources.prTemplate).toBe(htmlUrl("docs/pull_request_template.md"));
    });

    it("finds a lowercase contributing.md in the repo root", async () => {
        const { octokit } = createFakeOctokit({
            files: { "contributing.md": NODE_CONTRIBUTING, "README.md": "# App" },
        });

        const result = await fetchGuidelines("acme", "app", { octokit });

        expect(result.contributing).toBe(NODE_CONTRIBUTING);
        expect(result.sources.contributing).toBe(htmlUrl("contributing.md"));
    });

    it("takes the first .md file (A to Z) from a PULL_REQUEST_TEMPLATE folder", async () => {
        const { octokit } = createFakeOctokit({
            files: {
                ".github/PULL_REQUEST_TEMPLATE/feature.md": "## Feature",
                ".github/PULL_REQUEST_TEMPLATE/bugfix.md": REACT_PR_TEMPLATE,
                ".github/PULL_REQUEST_TEMPLATE/notes.txt": "not a template",
            },
        });

        const result = await fetchGuidelines("acme", "app", { octokit });

        expect(result.prTemplate).toBe(REACT_PR_TEMPLATE);
        expect(result.sources.prTemplate).toBe(htmlUrl(".github/PULL_REQUEST_TEMPLATE/bugfix.md"));
    });

    it("falls back when the profile points to a file that no longer exists", async () => {
        const { octokit } = createFakeOctokit({
            files: { "docs/CONTRIBUTING.md": NODE_CONTRIBUTING },
            profile: { contributing: "CONTRIBUTING.md" },
        });

        const result = await fetchGuidelines("acme", "app", { octokit });

        expect(result.sources.contributing).toBe(htmlUrl("docs/CONTRIBUTING.md"));
    });

    it("returns nulls and no warnings when nothing is found", async () => {
        const { octokit } = createFakeOctokit({ files: { "README.md": "# App" } });

        const result = await fetchGuidelines("acme", "app", { octokit });

        expect(result).toEqual({
            contributing: null,
            prTemplate: null,
            sources: { contributing: null, prTemplate: null },
            warnings: [],
        });
    });

    it("warns instead of returning a file that is too large", async () => {
        const { octokit } = createFakeOctokit({
            files: { "CONTRIBUTING.md": NODE_CONTRIBUTING, ".github/pull_request_template.md": REACT_PR_TEMPLATE },
            profile: { contributing: "CONTRIBUTING.md" },
            sizes: { "CONTRIBUTING.md": 240 * 1024 },
        });

        const result = await fetchGuidelines("acme", "app", { octokit });

        expect(result.contributing).toBeNull();
        expect(result.sources.contributing).toBeNull();
        expect(result.warnings).toEqual(["CONTRIBUTING.md is too large to analyse (240KB)."]);
        // The other file is still returned
        expect(result.prTemplate).toBe(REACT_PR_TEMPLATE);
    });

    it("warns when a file is not valid text", async () => {
        const { octokit, getContent } = createFakeOctokit({ files: { "CONTRIBUTING.md": "" } });
        const binary = Buffer.from([0xff, 0xfe, 0xfd]).toString("base64");
        getContent.mockImplementation(async ({ path }: { path: string }) => {
            if (path === "") return { data: [{ name: "CONTRIBUTING.md", type: "file", path: "CONTRIBUTING.md" }] };
            if (path === "CONTRIBUTING.md") {
                return {
                    data: {
                        type: "file",
                        name: "CONTRIBUTING.md",
                        path,
                        size: 3,
                        encoding: "base64",
                        content: binary,
                        html_url: htmlUrl(path),
                    },
                };
            }
            throw httpError(404, "Not Found");
        });

        const result = await fetchGuidelines("acme", "app", { octokit });

        expect(result.contributing).toBeNull();
        expect(result.warnings).toEqual(["CONTRIBUTING.md could not be read (it may not be a text file)."]);
    });

    it("throws RepoNotFoundError when the repo doesn't exist", async () => {
        const { octokit, get } = createFakeOctokit({ files: {}, profileError: httpError(404, "Not Found") });
        get.mockRejectedValue(httpError(404, "Not Found"));

        await expect(fetchGuidelines("acme", "missing", { octokit })).rejects.toBeInstanceOf(RepoNotFoundError);
    });

    it("throws RateLimitError with the reset time", async () => {
        const { octokit } = createFakeOctokit({
            files: {},
            profileError: httpError(403, "API rate limit exceeded", {
                "x-ratelimit-remaining": "0",
                "x-ratelimit-reset": "1790000000",
            }),
        });

        const error = await fetchGuidelines("acme", "app", { octokit }).catch((e: unknown) => e);

        expect(error).toBeInstanceOf(RateLimitError);
        expect((error as RateLimitError).resetAt).toEqual(new Date(1790000000 * 1000));
    });

    it("throws MissingTokenError when GITHUB_TOKEN is not set", async () => {
        vi.stubEnv("GITHUB_TOKEN", "");

        await expect(fetchGuidelines("acme", "app")).rejects.toBeInstanceOf(MissingTokenError);
    });

    it("rejects invalid owner/repo names before calling GitHub", async () => {
        const { octokit, getContent } = createFakeOctokit({ files: {} });

        await expect(fetchGuidelines("../etc", "app", { octokit })).rejects.toMatchObject({ code: "INVALID_REPO" });
        expect(getContent).not.toHaveBeenCalled();
    });
});
