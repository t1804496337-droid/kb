export default function WorkflowsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Workflows</h1>
      <p className="text-sm text-muted">
        Step cards from <code className="font-mono text-accent">_site/workflows/*.md</code> (S6 stub).
      </p>
      <div className="rounded-[12px] border border-dashed border-border bg-card/50 p-10 text-center text-sm text-muted">
        Shell only — content lands in a later step.
      </div>
    </div>
  );
}
