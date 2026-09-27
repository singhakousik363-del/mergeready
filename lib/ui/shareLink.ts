// Shareable results: /?url=<issue or PR link>&user=<GitHub name>
// Opening such a link fills the form and runs the check.
// parseUrl has no dependencies, so it is safe to use in the browser
import { MAX_URL_LENGTH } from "../github/parseUrl";

export type ShareParams = { url: string; username: string };

// "?url=...&user=..." (user left out when empty)
export function buildShareSearch({ url, username }: ShareParams): string {
    const params = new URLSearchParams({ url: url.trim() });
    if (username.trim() !== "") params.set("user", username.trim());
    return `?${params.toString()}`;
}

// Reads the form values from the page address. Anything odd is ignored:
// the server validates everything again anyway.
export function readShareParams(search: URLSearchParams): ShareParams | null {
    const url = search.get("url")?.trim() ?? "";
    if (url === "" || url.length > MAX_URL_LENGTH) return null;
    const username = (search.get("user") ?? "").trim().slice(0, 39);
    return { url, username };
}
