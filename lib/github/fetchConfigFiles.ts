import type { Octokit } from "@octokit/rest";
import { assertValidRepo, createOctokit } from "./client";
import { MissingTokenError, RateLimitError, RepoNotFoundError, toGitHubError } from "./errors";
import { MAX_FILE_BYTES } from "./fetchGuidelines";

// A tool config file from the repo, e.g. package.json or a workflow
export type ConfigFile = {
    path: string;
    text: string;
    // Clickable GitHub link to the file
    url: string;
};

export type ConfigFiles = {
    files: ConfigFile[];
    warnings: string[];
};

// Every place commitlint looks for its config (besides package.json)
export const COMMITLINT_FILES = [
    ".commitlintrc",
    ".commitlintrc.json",
    ".commitlintrc.yaml",
    ".commitlintrc.yml",
    ".commitlintrc.js",
    ".commitlintrc.cjs",
    ".commitlintrc.mjs",
    ".commitlintrc.ts",
    ".commitlintrc.cts",
    "commitlint.config.js",
    "commitlint.config.cjs",
    "commitlint.config.mjs",
    "commitlint.config.ts",
    "commitlint.config.cts",
];

// .github/dco.yml configures the DCO GitHub App
const SINGLE_FILES = ["package.json", ".github/dco.yml", ...COMMITLINT_FILES];
const WORKFLOWS_DIR = ".github/workflows";

type BlobFields = { text: string | null; byteSize: number; isBinary: boolean | null } | null;

type QueryResult = {
    repository: {
        defaultBranchRef: { name: string } | null;
        workflows: { entries: { name: string; type: string; object: BlobFields }[] } | null;
        // f0, f1, ... = the files in SINGLE_FILES, in the same order
        [alias: `f${number}`]: BlobFields;
    } | null;
};

const BLOB_FIELDS = "... on Blob { text byteSize isBinary }";

// ONE GraphQL request reads every config file and the whole workflows folder.
// A file that doesn't exist just comes back as null (no error, no extra request).
// "HEAD:path" = the file on the default branch. The paths are our own constants;
// owner and repo go in as variables, so user input never becomes part of the query.
const QUERY = `query ($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    defaultBranchRef { name }
${SINGLE_FILES.map((path, i) => `    f${i}: object(expression: "HEAD:${path}") { ${BLOB_FIELDS} }`).join("\n")}
    workflows: object(expression: "HEAD:${WORKFLOWS_DIR}") {
      ... on Tree { entries { name type object { ${BLOB_FIELDS} } } }
    }
  }
}`;

type FetchOptions = {
    // Tests pass a fake Octokit here, so the real API is never called
    octokit?: Octokit;
};

export async function fetchConfigFiles(owner: string, repo: string, options: FetchOptions = {}): Promise<ConfigFiles> {
    assertValidRepo(owner, repo);
    const octokit = options.octokit ?? createOctokit();

    let result: QueryResult;
    try {
        result = await octokit.graphql<QueryResult>(QUERY, { owner, name: repo });
    } catch (err) {
        const types = graphqlErrorTypes(err);
        if (types.includes("RATE_LIMITED")) throw new RateLimitError(null);
        if (types.includes("NOT_FOUND")) throw new RepoNotFoundError();

        const error = toGitHubError(err);
        // These will break every other request too, so stop the analysis
        if (error instanceof RateLimitError || error instanceof MissingTokenError) throw error;
        // Config files are a bonus: without them, template and doc rules still work
        return {
            files: [],
            warnings: [`Couldn't read config files (commitlint, DCO, workflows): ${error.message}`],
        };
    }

    const repository = result.repository;
    if (!repository) throw new RepoNotFoundError();

    const branch = repository.defaultBranchRef?.name ?? "HEAD";
    const files: ConfigFile[] = [];
    const warnings: string[] = [];

    function add(path: string, blob: BlobFields): void {
        if (!blob) return;
        if (blob.byteSize > MAX_FILE_BYTES) {
            warnings.push(`${path} is too large to analyse (${Math.round(blob.byteSize / 1024)}KB).`);
            return;
        }
        // text is null for binary files
        if (blob.isBinary || blob.text === null) return;
        files.push({ path, text: blob.text, url: blobUrl(owner, repo, branch, path) });
    }

    SINGLE_FILES.forEach((path, i) => add(path, repository[`f${i}`]));
    for (const entry of repository.workflows?.entries ?? []) {
        if (entry.type === "blob" && /\.ya?ml$/i.test(entry.name)) add(`${WORKFLOWS_DIR}/${entry.name}`, entry.object);
    }
    return { files, warnings };
}

// https://github.com/acme/app/blob/main/.github/workflows/lint%20pr.yml
function blobUrl(owner: string, repo: string, branch: string, path: string): string {
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    // encodeURI keeps the "/" in branch names like "release/1.x"
    return `https://github.com/${owner}/${repo}/blob/${encodeURI(branch)}/${encodedPath}`;
}

// GraphQL problems come back as a list like [{ type: "NOT_FOUND", message: "..." }].
// Read the types safely without `any`.
function graphqlErrorTypes(err: unknown): string[] {
    if (typeof err !== "object" || err === null || !("errors" in err) || !Array.isArray(err.errors)) return [];
    return err.errors.flatMap((e: unknown) =>
        typeof e === "object" && e !== null && "type" in e && typeof e.type === "string" ? [e.type] : []
    );
}
