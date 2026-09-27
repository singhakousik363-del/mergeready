// Things that limited the check (a file too big, a config we couldn't read).
// Shown gently: they are not the user's fault.
export function Warnings({ warnings }: { warnings: string[] }) {
    if (warnings.length === 0) return null;
    return (
        <aside aria-labelledby="warnings-heading" className="mt-8 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm">
            <h2 id="warnings-heading" className="flex items-center gap-2 font-medium">
                <span aria-hidden="true" className="text-warn">
                    !
                </span>
                Good to know
            </h2>
            <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
                {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                ))}
            </ul>
        </aside>
    );
}
