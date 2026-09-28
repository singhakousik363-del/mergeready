"use client";

import { useId } from "react";

// Real examples, so judges (and first-timers) can try it in one click
export const EXAMPLES = [
    { label: "A contested issue", detail: "stdlib #12959", url: "https://github.com/stdlib-js/stdlib/issues/12959" },
    { label: "A real first PR", detail: "stdlib #15585", url: "https://github.com/stdlib-js/stdlib/pull/15585" },
];

type Props = {
    url: string;
    username: string;
    onUrlChange: (value: string) => void;
    onUsernameChange: (value: string) => void;
    onSubmit: () => void;
    onExample: (url: string) => void;
    // Shown under the link field, e.g. "Please paste a github.com link."
    error: string | null;
    busy: boolean;
};

export function CheckForm({ url, username, onUrlChange, onUsernameChange, onSubmit, onExample, error, busy }: Props) {
    const id = useId();
    const urlId = `${id}-url`;
    const userId = `${id}-user`;
    const errorId = `${id}-error`;
    const userHintId = `${id}-user-hint`;

    return (
        <form
            className="mt-10 rounded-2xl border border-line bg-card p-5 shadow-[0_1px_0_var(--line)] sm:p-6"
            onSubmit={(event) => {
                // Handled in the page: no full reload
                event.preventDefault();
                onSubmit();
            }}
            noValidate
        >
            <label htmlFor={urlId} className="block text-sm font-medium">
                GitHub issue or pull request link
            </label>
            <input
                id={urlId}
                name="url"
                // "text", not "url": our own friendly messages instead of the browser's popups
                type="text"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://github.com/owner/repo/issues/123"
                value={url}
                onChange={(event) => onUrlChange(event.target.value)}
                aria-invalid={error !== null}
                aria-describedby={error ? errorId : undefined}
                className="mt-2 w-full rounded-lg border border-line bg-paper px-3 py-3 font-mono text-sm text-ink placeholder:text-muted focus:border-accent"
            />
            {error && (
                // role="alert": screen readers read the problem out right away
                <p id={errorId} role="alert" className="mt-2 flex items-center gap-2 text-sm text-fail">
                    <span aria-hidden="true">✕</span>
                    {error}
                </p>
            )}

            <label htmlFor={userId} className="mt-5 block text-sm font-medium">
                Your GitHub username <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
                id={userId}
                name="user"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="octocat"
                value={username}
                onChange={(event) => onUsernameChange(event.target.value)}
                aria-describedby={userHintId}
                className="mt-2 w-full rounded-lg border border-line bg-paper px-3 py-3 font-mono text-sm text-ink placeholder:text-muted focus:border-accent sm:max-w-xs"
            />
            <p id={userHintId} className="mt-2 text-sm text-muted">
                So your own comments and pull requests don&apos;t count as someone else&apos;s claim.
            </p>

            <div className="mt-6 flex flex-col gap-4">
                <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex items-center justify-center self-start rounded-lg bg-accent px-6 py-3 font-medium text-on-accent transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
                >
                    {busy ? "Checking…" : "Check"}
                </button>

                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted">Try an example:</span>
                    {EXAMPLES.map((example) => (
                        <button
                            key={example.url}
                            type="button"
                            disabled={busy}
                            onClick={() => onExample(example.url)}
                            className="rounded-full border border-line px-3 py-1.5 hover:border-accent disabled:opacity-60"
                        >
                            {example.label} <span className="font-mono text-muted">{example.detail}</span>
                        </button>
                    ))}
                </div>
            </div>
        </form>
    );
}
