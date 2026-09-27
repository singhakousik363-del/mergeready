import type { RefObject } from "react";
import type { AnalyzeResponse } from "@/lib/server/analyze";
import { STAGE_LABEL, STATUS_LABEL } from "@/lib/ui/labels";

type Props = {
    data: AnalyzeResponse;
    // The page moves focus here when results arrive
    headingRef: RefObject<HTMLHeadingElement | null>;
};

export function Results({ data, headingRef }: Props) {
    const kindLabel = data.kind === "pr" ? "Pull request" : "Issue";
    return (
        <section className="mt-12" aria-labelledby="results-heading">
            <p className="text-sm text-muted">
                {kindLabel} in {data.repo.owner}/{data.repo.repo}
            </p>
            {/* tabIndex -1: focusable by code (after a check) but not in the Tab order */}
            <h2 id="results-heading" ref={headingRef} tabIndex={-1} className="mt-1 font-display text-3xl sm:text-4xl">
                <a href={data.target.url} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
                    #{data.target.number} {data.target.title}
                </a>
            </h2>
            <ul className="mt-6">
                {data.journey.map((step) => (
                    <li key={step.stage}>
                        {STAGE_LABEL[step.stage]}: {STATUS_LABEL[step.status]} ({step.summary})
                    </li>
                ))}
            </ul>
        </section>
    );
}
