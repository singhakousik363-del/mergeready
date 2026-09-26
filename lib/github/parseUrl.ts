export type ParsedGitHubUrl =
    | { ok: true; owner: string; repo: string; type: "issue" | "pull"; number: number }
    | { ok: false; error: string };

export function parseGithubUrl(url: string): ParsedGitHubUrl {
    // 1. Turn the text into a URL object (fails if it's not a valid link)
    let parsed: URL;
    try {
        parsed = new URL(url.trim());
    } catch {
        return { ok: false, error: "This is not a valid link." };
    }

    // 2. Only accept github.com links
    const host = parsed.hostname.toLowerCase();
    if (host !== "github.com" && host !== "www.github.com") {
        return { ok: false, error: "Please paste a github.com link." };
    }

    // 3. Split "/facebook/react/issues/123" into parts, drop empty ones
    const parts = parsed.pathname.split("/").filter((part) => part !== "");

    // 4. Need at least: owner, repo, issues/pull, number
    //    (extra parts like /files or /commits are allowed)
    if (parts.length < 4) {
        return { ok: false, error: "Link must point to an issue or a pull request." };
    }

    const [owner, repo, kind, numberText] = parts;

    // 5. Decide whether it's an issue or a pull request
    let type: "issue" | "pull";
    if (kind === "issues") {
        type = "issue";
    } else if (kind === "pull") {
        type = "pull";
    } else {
        return { ok: false, error: "Link must point to an issue or a pull request." };
    }

    // 6. The number must be a positive whole number
    const number = Number(numberText);
    if (!Number.isInteger(number) || number <= 0) {
        return { ok: false, error: "Could not find a valid issue or PR number." };
    }

    // 7. Everything is valid
    return { ok: true, owner, repo, type, number };
}