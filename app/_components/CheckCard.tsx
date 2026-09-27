import type { Check } from "@/lib/checks/types";
import { sourceLabel } from "@/lib/ui/labels";
import { FixSteps } from "./FixSteps";
import { StatusBadge, STATUS_STYLE } from "./StatusBadge";

// One check: what's wrong (or right), how to fix it, and the proof
export function CheckCard({ check }: { check: Check }) {
    const style = STATUS_STYLE[check.status];
    const { rules, observed } = check.evidence;
    const hasEvidence = rules.length > 0 || observed.length > 0;

    return (
        <article className={`rounded-xl border border-l-4 border-line bg-card p-4 sm:p-5 ${style.border}`}>
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:gap-3">
                <StatusBadge status={check.status} />
                <p className="font-medium">{check.message}</p>
            </div>

            {check.howToFix.length > 0 && (
                <div className="mt-4">
                    <h4 className="text-sm font-medium text-muted">How to fix</h4>
                    <FixSteps steps={check.howToFix} />
                </div>
            )}

            {hasEvidence && (
                // <details> opens and closes with the keyboard for free
                <details className="mt-4 text-sm">
                    <summary className="cursor-pointer font-medium text-accent">Why we checked this</summary>
                    {observed.length > 0 && (
                        <div className="mt-3">
                            <h5 className="font-medium text-muted">What we saw</h5>
                            <ul className="mt-1 flex flex-col gap-1">
                                {observed.map((line, i) => (
                                    <li key={i} className="break-words font-mono text-[13px]">
                                        {line}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {rules.length > 0 && (
                        <div className="mt-3">
                            <h5 className="font-medium text-muted">{rules.length === 1 ? "The rule" : "The rules"}</h5>
                            <ul className="mt-1 flex flex-col gap-3">
                                {rules.map((rule, i) => (
                                    <li key={i}>
                                        <span className="rounded bg-skip-soft px-1.5 py-0.5 text-xs text-muted">{sourceLabel(rule)}</span>
                                        <blockquote className="mt-1 whitespace-pre-wrap break-words border-l-2 border-line pl-3 font-mono text-[13px]">
                                            {rule.sourceQuote}
                                        </blockquote>
                                        <a href={rule.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-accent underline underline-offset-2">
                                            View source<span aria-hidden="true"> ↗</span>
                                            <span className="sr-only"> (opens in a new tab)</span>
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </details>
            )}
        </article>
    );
}
