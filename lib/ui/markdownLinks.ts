// Helpers for showing a CONTRIBUTING section as markdown on our site.
// Links inside it were written for GitHub ("./doc/x.md", "#setup"), so they
// must be turned into full GitHub links, or they would point at our site.

// "https://github.com/o/r/blob/main/CONTRIBUTING.md?plain=1#L42" -> "https://github.com/o/r/blob/main/CONTRIBUTING.md"
function fileBaseUrl(sourceUrl: string): string | null {
    try {
        const url = new URL(sourceUrl);
        url.search = "";
        url.hash = "";
        return url.toString();
    } catch {
        return null;
    }
}

// Makes a link from the section work on our site:
// "#setup" -> file link + "#setup"; "./doc/x.md" -> the file next to it on GitHub;
// full links stay as they are. The caller still runs react-markdown's
// defaultUrlTransform afterwards, which blocks unsafe links like "javascript:".
export function resolveDocLink(href: string, sourceUrl: string): string {
    const base = fileBaseUrl(sourceUrl);
    if (href === "" || base === null) return href;
    if (href.startsWith("#")) return `${base}${href}`;
    try {
        return new URL(href, base).toString();
    } catch {
        return "";
    }
}

// Adds "[label]: url" lines under the text, so "[guide][label]" links work
// even though their targets were written at the end of the original file
export function withReferences(text: string, references: { label: string; url: string }[]): string {
    if (references.length === 0) return text;
    return `${text}\n\n${references.map((r) => `[${r.label}]: ${r.url}`).join("\n")}\n`;
}
