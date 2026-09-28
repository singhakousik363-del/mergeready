import Markdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { GuideSection } from "@/lib/rules/sections";
import { resolveDocLink, withReferences } from "@/lib/ui/markdownLinks";

// Headings inside a section become h4-h6, so they sit BELOW this page's own
// headings (h2 "Read this yourself") in the outline screen readers use
const HEADINGS: Components = {
    h1: ({ children }) => <h4>{children}</h4>,
    h2: ({ children }) => <h4>{children}</h4>,
    h3: ({ children }) => <h5>{children}</h5>,
    h4: ({ children }) => <h6>{children}</h6>,
    h5: ({ children }) => <h6>{children}</h6>,
    h6: ({ children }) => <h6>{children}</h6>,
};

// The section's first line is its heading, already shown in <summary>
function withoutFirstHeading(text: string): string {
    return /^#{1,6}\s/.test(text) ? text.slice(text.indexOf("\n") + 1 || text.length) : text;
}

// The parts of CONTRIBUTING that matter most for a first PR, shown as the
// repo wrote them. Pattern matching can miss rules; people reading can't.
export function ReadYourself({ sections }: { sections: GuideSection[] }) {
    if (sections.length === 0) return null;
    return (
        <section aria-labelledby="read-heading" className="mt-16">
            <h2 id="read-heading" className="font-display text-3xl">
                Read this yourself
            </h2>
            <p className="mt-2 text-muted">
                Our checks can miss rules written in unusual ways. These parts of the repo&apos;s guidelines matter most
                for a first pull request.
            </p>
            <div className="mt-5 flex flex-col gap-3">
                {sections.map((section) => (
                    <details key={section.sourceUrl} className="rounded-xl border border-line bg-card">
                        <summary className="cursor-pointer px-4 py-3 font-medium">{section.heading}</summary>
                        <div className="border-t border-line px-4 py-4">
                            <div className="markdown">
                                <Markdown
                                    remarkPlugins={[remarkGfm]}
                                    // Raw HTML (and HTML comments like "<!-- lint disable -->") is left
                                    // out completely: it is never rendered
                                    skipHtml
                                    // Links were written for GitHub: point them there, then make them safe
                                    urlTransform={(url) => defaultUrlTransform(resolveDocLink(url, section.sourceUrl))}
                                    components={{
                                        ...HEADINGS,
                                        a: ({ href, children }) => (
                                            <a href={href} target="_blank" rel="noopener noreferrer">
                                                {children}
                                                <span className="sr-only"> (opens in a new tab)</span>
                                            </a>
                                        ),
                                        // No images from other sites: they could track visitors. Show a link instead.
                                        img: ({ src, alt }) =>
                                            typeof src === "string" && src !== "" ? (
                                                <a href={src} target="_blank" rel="noopener noreferrer">
                                                    [image: {alt || "unnamed"}]
                                                </a>
                                            ) : null,
                                    }}
                                >
                                    {withReferences(withoutFirstHeading(section.text), section.references)}
                                </Markdown>
                            </div>
                            {section.truncated && <p className="mt-3 text-sm text-muted">This section is long, so it was cut short here.</p>}
                            <a href={section.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-accent underline underline-offset-2">
                                Read it on GitHub<span aria-hidden="true"> ↗</span>
                                <span className="sr-only"> (opens in a new tab)</span>
                            </a>
                        </div>
                    </details>
                ))}
            </div>
        </section>
    );
}
