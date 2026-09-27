const SOURCES = [
    {
        title: "Repo config",
        what: "commitlint settings, DCO setup and CI workflows.",
        weight: "The repo's tools enforce these, so breaking one is red.",
    },
    {
        title: "PR template",
        what: "Sections to fill in, checkboxes, the “Fixes #” field.",
        weight: "The repo asks every PR for these, so a miss is red.",
    },
    {
        title: "Commit history",
        what: "Habits in the last 50 commits, like Conventional Commits or sign-offs.",
        weight: "A habit, not a rule, so a miss is yellow.",
    },
    {
        title: "Written guidelines",
        what: "Exact sentences from CONTRIBUTING and the docs it links to.",
        weight: "Found by pattern matching, so a miss is yellow.",
    },
];

// Shown under the checker. Rendered on the server: no JavaScript needed.
export function HowItWorks() {
    return (
        <section aria-labelledby="how-heading" className="mt-24 border-t border-line pt-12">
            <h2 id="how-heading" className="font-display text-3xl sm:text-4xl">
                How it works
            </h2>
            <p className="mt-3 max-w-2xl text-muted">
                No AI. MergeReady reads four kinds of evidence from the repo itself, and every rule it shows comes with
                the exact words and a link to where they are written.
            </p>
            <ol className="mt-6 grid gap-4 sm:grid-cols-2">
                {SOURCES.map((source, i) => (
                    <li key={source.title} className="rounded-xl border border-line bg-card p-4">
                        <p className="font-mono text-sm text-accent">0{i + 1}</p>
                        <h3 className="mt-1 font-medium">{source.title}</h3>
                        <p className="mt-1 text-sm">{source.what}</p>
                        <p className="mt-2 text-sm text-muted">{source.weight}</p>
                    </li>
                ))}
            </ol>
            <p className="mt-6 max-w-2xl text-sm text-muted">
                What it never does: tick a checkbox for you, guess a git command, or let an AI decide whether you pass.
            </p>
        </section>
    );
}
