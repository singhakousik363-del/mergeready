import type { JourneyStep } from "@/lib/checks/journey";
import { STAGE_LABEL, STATUS_LABEL } from "@/lib/ui/labels";
import { StatusIcon, STATUS_STYLE } from "./StatusBadge";

// Issue -> Work -> Commit -> PR -> Merge, drawn like a git commit graph.
// Vertical on phones, horizontal from md (768px) up. Each stage links to its section.
export function JourneyMap({ journey }: { journey: JourneyStep[] }) {
    return (
        <nav aria-label="Your journey" className="mt-8">
            <ol className="flex flex-col md:flex-row">
                {journey.map((step, i) => {
                    const style = STATUS_STYLE[step.status];
                    const last = i === journey.length - 1;
                    return (
                        <li key={step.stage} className="relative pb-5 md:flex-1 md:pb-0">
                            {/* The line to the next stage: down on phones, right on desktop */}
                            {!last && (
                                <span
                                    aria-hidden="true"
                                    className="absolute left-[17px] top-10 bottom-0 w-0.5 bg-line md:left-[calc(50%+22px)] md:right-[calc(-50%+22px)] md:top-[17px] md:bottom-auto md:h-0.5 md:w-auto"
                                />
                            )}
                            <a
                                href={`#stage-${step.stage}`}
                                className="relative flex gap-3 rounded-lg md:flex-col md:items-center md:px-1 md:text-center"
                            >
                                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 bg-card ${style.border} ${style.text}`}>
                                    <StatusIcon status={step.status} />
                                </span>
                                <span>
                                    <span className="block font-medium">
                                        {i + 1}. {STAGE_LABEL[step.stage]}
                                    </span>
                                    <span className={`block text-sm font-medium ${style.text}`}>{STATUS_LABEL[step.status]}</span>
                                    <span className="block text-sm text-muted">{step.summary}</span>
                                </span>
                            </a>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
