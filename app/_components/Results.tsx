import type { RefObject } from "react";
import type { AnalyzeResponse } from "@/lib/server/analyze";
import { CopyButton } from "./CopyButton";
import { JourneyMap } from "./JourneyMap";
import { PrDescription } from "./PrDescription";
import { ReadYourself } from "./ReadYourself";
import { RulesPanel } from "./RulesPanel";
import { StageSection } from "./StageSection";
import { Warnings } from "./Warnings";

type Props = {
    data: AnalyzeResponse;
    // Full link that reopens this result
    shareUrl: string;
    // The page moves focus here when results arrive
    headingRef: RefObject<HTMLHeadingElement | null>;
};

export function Results({ data, shareUrl, headingRef }: Props) {
    const kindLabel = data.kind === "pr" ? "Pull request" : "Issue";
    const fromCache = data.meta.cached.rules && data.meta.cached.target;

    return (
        <section className="mt-14" aria-labelledby="results-heading">
            <p className="text-sm text-muted">
                {kindLabel} in{" "}
                <a href={data.repo.url} target="_blank" rel="noopener noreferrer" className="font-mono underline underline-offset-2">
                    {data.repo.owner}/{data.repo.repo}
                </a>
                {data.target.author && <> · by @{data.target.author}</>} · {data.target.state}
            </p>
            {/* tabIndex -1: focusable by code (after a check) but not in the Tab order */}
            <h2 id="results-heading" ref={headingRef} tabIndex={-1} className="mt-2 font-display text-3xl leading-tight sm:text-4xl">
                <a href={data.target.url} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
                    #{data.target.number} {data.target.title}
                    <span className="sr-only"> (opens on GitHub in a new tab)</span>
                </a>
            </h2>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
                <span>
                    Checked in {(data.meta.durationMs / 1000).toFixed(1)} s{fromCache ? " (from a check in the last minute)" : ""}
                </span>
                <span className="inline-flex items-center rounded-lg border border-line bg-card">
                    <span className="px-3 py-2">Share this result</span>
                    <CopyButton text={shareUrl} what="share link" className="border-l border-line" />
                </span>
            </div>

            <JourneyMap journey={data.journey} />
            <Warnings warnings={data.warnings} />

            {data.stages.map((group, index) => (
                <StageSection key={group.stage} group={group} index={index} />
            ))}

            <PrDescription description={data.prDescription} kind={data.kind} />
            <ReadYourself sections={data.sections} />
            <RulesPanel rules={data.rules} />
        </section>
    );
}
