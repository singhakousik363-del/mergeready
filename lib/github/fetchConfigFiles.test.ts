import { describe, it, expect, vi } from "vitest";
import type { Octokit } from "@octokit/rest";
import { COMMITLINT_FILES, fetchConfigFiles } from "./fetchConfigFiles";
import { InvalidRepoError, MissingTokenError, RateLimitError, RepoNotFoundError } from "./errors";

type Blob = { text: string | null; byteSize: number; isBinary: boolean | null } | null;

function blob(text: string): Blob {
    return { text, byteSize: Buffer.byteLength(text), isBinary: false };
}

// The f0, f1, ... aliases follow this order in the query
const SINGLE_FILES = ["package.json", ".github/dco.yml", ...COMMITLINT_FILES];

// Builds what GitHub's GraphQL API returns for a repo with these files
function repositoryWith(files: Record<string, Blob>, workflows: Record<string, Blob> | null, branch = "main") {
    const repository: Record<string, unknown> = {
        defaultBranchRef: { name: branch },
        workflows: workflows && {
            entries: Object.entries(workflows).map(([name, object]) => ({
                name,
                type: name.endsWith("/") ? "tree" : "blob",
                object,
            })),
        },
    };
    SINGLE_FILES.forEach((path, i) => (repository[`f${i}`] = files[path] ?? null));
    return { repository };
}

function fakeOctokit(graphql: (query: string, vars: Record<string, string>) => Promise<unknown>) {
    const spy = vi.fn(graphql);
    return { octokit: { graphql: spy } as unknown as Octokit, graphql: spy };
}

// Error shaped like Octokit's GraphqlResponseError
function graphqlError(type: string): Error {
    return Object.assign(new Error("GraphQL error"), { errors: [{ type, message: "x" }] });
}

// Error shaped like Octokit's RequestError
function httpError(status: number, headers: Record<string, string> = {}): Error {
    return Object.assign(new Error("HTTP error"), { status, response: { headers } });
}

describe("fetchConfigFiles", () => {
    it("reads config files and YAML workflows in ONE request", async () => {
        const { octokit, graphql } = fakeOctokit(async () =>
            repositoryWith(
                { "package.json": blob('{ "name": "app" }'), ".commitlintrc.yml": blob("extends: []") },
                { "ci.yml": blob("jobs: {}"), "README.md": blob("# docs"), "sub/": null }
            )
        );

        const result = await fetchConfigFiles("acme", "app", { octokit });

        expect(graphql).toHaveBeenCalledTimes(1);
        // owner/repo go in as variables, never inside the query text
        expect(graphql.mock.calls[0][1]).toEqual({ owner: "acme", name: "app" });
        expect(graphql.mock.calls[0][0]).not.toContain("acme");
        expect(result).toEqual({
            files: [
                { path: "package.json", text: '{ "name": "app" }', url: "https://github.com/acme/app/blob/main/package.json" },
                { path: ".commitlintrc.yml", text: "extends: []", url: "https://github.com/acme/app/blob/main/.commitlintrc.yml" },
                {
                    path: ".github/workflows/ci.yml",
                    text: "jobs: {}",
                    url: "https://github.com/acme/app/blob/main/.github/workflows/ci.yml",
                },
            ],
            warnings: [],
        });
    });

    it("asks for every commitlint config name in the query", async () => {
        const { octokit, graphql } = fakeOctokit(async () => repositoryWith({}, null));
        await fetchConfigFiles("acme", "app", { octokit });
        for (const name of COMMITLINT_FILES) expect(graphql.mock.calls[0][0]).toContain(`"HEAD:${name}"`);
    });

    it("returns nothing for a repo without config files or workflows", async () => {
        const { octokit } = fakeOctokit(async () => repositoryWith({}, null));
        expect(await fetchConfigFiles("acme", "app", { octokit })).toEqual({ files: [], warnings: [] });
    });

    it("skips binary and too-large files, with a warning for large ones", async () => {
        const { octokit } = fakeOctokit(async () =>
            repositoryWith(
                { "package.json": { text: "x", byteSize: 200 * 1024, isBinary: false } },
                { "big.yml": { text: null, byteSize: 10, isBinary: true } }
            )
        );
        expect(await fetchConfigFiles("acme", "app", { octokit })).toEqual({
            files: [],
            warnings: ["package.json is too large to analyse (200KB)."],
        });
    });

    it("keeps '/' in branch names and encodes spaces in file names", async () => {
        const { octokit } = fakeOctokit(async () => repositoryWith({}, { "lint pr.yml": blob("a: 1") }, "release/1.x"));
        const { files } = await fetchConfigFiles("acme", "app", { octokit });
        expect(files[0].url).toBe("https://github.com/acme/app/blob/release/1.x/.github/workflows/lint%20pr.yml");
    });

    it("rejects bad owner/repo names before calling GitHub", async () => {
        const { octokit, graphql } = fakeOctokit(async () => repositoryWith({}, null));
        await expect(fetchConfigFiles("acme", "../etc", { octokit })).rejects.toBeInstanceOf(InvalidRepoError);
        expect(graphql).not.toHaveBeenCalled();
    });

    it("throws RepoNotFoundError for a missing or private repo", async () => {
        const { octokit } = fakeOctokit(async () => {
            throw graphqlError("NOT_FOUND");
        });
        await expect(fetchConfigFiles("acme", "gone", { octokit })).rejects.toBeInstanceOf(RepoNotFoundError);
    });

    it("throws on rate limits (GraphQL-style and HTTP-style)", async () => {
        const graphqlLimit = fakeOctokit(async () => {
            throw graphqlError("RATE_LIMITED");
        });
        await expect(fetchConfigFiles("acme", "app", { octokit: graphqlLimit.octokit })).rejects.toBeInstanceOf(
            RateLimitError
        );

        const httpLimit = fakeOctokit(async () => {
            throw httpError(403, { "x-ratelimit-remaining": "0" });
        });
        await expect(fetchConfigFiles("acme", "app", { octokit: httpLimit.octokit })).rejects.toBeInstanceOf(
            RateLimitError
        );
    });

    it("throws on a bad token", async () => {
        const { octokit } = fakeOctokit(async () => {
            throw httpError(401);
        });
        await expect(fetchConfigFiles("acme", "app", { octokit })).rejects.toBeInstanceOf(MissingTokenError);
    });

    it("turns other failures into a warning, so the rest of the analysis still works", async () => {
        const { octokit } = fakeOctokit(async () => {
            throw httpError(502);
        });
        expect(await fetchConfigFiles("acme", "app", { octokit })).toEqual({
            files: [],
            warnings: ["Couldn't read config files (commitlint, DCO, workflows): Couldn't reach GitHub right now. Please try again."],
        });
    });
});
