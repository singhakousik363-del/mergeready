import type { FixStep } from "@/lib/checks/types";
import { CopyButton } from "./CopyButton";

// "How to fix": numbered steps. A step with a command shows it in a code
// box with a copy button. Commands come only from the checks themselves.
export function FixSteps({ steps }: { steps: FixStep[] }) {
    return (
        <ol className="mt-2 flex list-decimal flex-col gap-2 pl-5">
            {steps.map((step, i) => (
                <li key={i}>
                    {step.text}
                    {step.command && (
                        <div className="mt-2 flex items-stretch overflow-hidden rounded-lg border border-line bg-paper">
                            <code className="flex-1 overflow-x-auto whitespace-pre px-3 py-2 font-mono text-sm">{step.command}</code>
                            <CopyButton text={step.command} what="command" className="border-l border-line" />
                        </div>
                    )}
                </li>
            ))}
        </ol>
    );
}
