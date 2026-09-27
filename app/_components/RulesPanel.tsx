import type { Rule } from "@/lib/rules/types";
import { RULE_TYPE_LABEL, SOURCE_GROUPS, ruleDetail, sourceLabel } from "@/lib/ui/labels";

// Every rule we found, grouped by where it came from. Nothing hidden.
export function RulesPanel({ rules }: { rules: Rule[] }) {
    return (
        <section aria-labelledby="rules-heading" className="mt-16">
            <h2 id="rules-heading" className="font-display text-3xl">
                Rules we found <span className="text-muted">({rules.length})</span>
            </h2>
            <p className="mt-2 text-muted">
                Every rule the checks above use, with the exact words and a link to where the repo wrote them.
            </p>
            <div className="mt-5 flex flex-col gap-3">
                {SOURCE_GROUPS.map((group) => {
                    const inGroup = rules.filter((rule) => rule.confidence === group.confidence);
                    return (
                        <details key={group.confidence} className="rounded-xl border border-line bg-card">
                            <summary className="cursor-pointer px-4 py-3">
                                <span className="font-medium">{group.title}</span>{" "}
                                <span className="text-muted">
                                    ({inGroup.length === 0 ? "none found" : inGroup.length})
                                </span>
                            </summary>
                            <div className="border-t border-line px-4 py-4">
                                <p className="text-sm text-muted">{group.explain}</p>
                                {inGroup.length > 0 && (
                                    <ul className="mt-3 flex flex-col gap-4">
                                        {inGroup.map((rule, i) => (
                                            <li key={i} className="text-sm">
                                                <p className="font-medium">{RULE_TYPE_LABEL[rule.type]}</p>
                                                <p className="text-muted">{ruleDetail(rule)}</p>
                                                <blockquote className="mt-1 whitespace-pre-wrap break-words border-l-2 border-line pl-3 font-mono text-[13px]">
                                                    {rule.sourceQuote}
                                                </blockquote>
                                                <a href={rule.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-accent underline underline-offset-2">
                                                    {sourceLabel(rule)}
                                                    <span aria-hidden="true"> ↗</span>
                                                    <span className="sr-only"> (opens in a new tab)</span>
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </details>
                    );
                })}
            </div>
        </section>
    );
}
