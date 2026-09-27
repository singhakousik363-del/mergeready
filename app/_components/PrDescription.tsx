import type { AnalyzeResponse } from "@/lib/server/analyze";
import { CopyButton } from "./CopyButton";

// The repo's own PR template, ready to paste. Checkboxes are never ticked:
// ticking one is a promise only the author can make.
export function PrDescription({ description, kind }: { description: AnalyzeResponse["prDescription"]; kind: "issue" | "pr" }) {
    return (
        <section aria-labelledby="description-heading" className="mt-16">
            <h2 id="description-heading" className="font-display text-3xl">
                {description.label}
            </h2>
            <p className="mt-2 text-muted">
                {kind === "pr"
                    ? "Your PR already has a description. Use this to see what the repo's template expects."
                    : "Paste this when you open your pull request, then fill in each part."}{" "}
                Checkboxes are left unticked on purpose: tick one only when it&apos;s true.
            </p>
            <div className="mt-4 overflow-hidden rounded-xl border border-line bg-card">
                <div className="flex items-center justify-between border-b border-line pl-4">
                    <span className="text-sm text-muted">Markdown</span>
                    <CopyButton text={description.text} what="PR description" className="border-l border-line" />
                </div>
                {/* tabIndex 0: keyboard users can scroll this box */}
                <pre tabIndex={0} className="max-h-96 overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-[13px]">
                    {description.text}
                </pre>
            </div>
        </section>
    );
}
