import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { GuideSection } from "@/lib/rules/sections";
import { resolveDocLink, withReferences } from "@/lib/ui/markdownLinks";

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
                                    {withReferences(section.text, section.references)}
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
