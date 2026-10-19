import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Metric = {
  label: string;
  value: string;
  status: "ok" | "pending" | "error";
  hint: string;
};

const METRICS: Metric[] = [
  {
    label: "Notes Indexed",
    value: "—",
    status: "pending",
    hint: "FlexSearch stub · S4",
  },
  {
    label: "Last Sync",
    value: "never",
    status: "pending",
    hint: "GitHub pull not wired",
  },
  {
    label: "Open Tickets",
    value: "0",
    status: "ok",
    hint: "From _site/tickets (stub)",
  },
  {
    label: "Recent Commits",
    value: "—",
    status: "pending",
    hint: "GitHub API stub",
  },
];

const statusDot: Record<Metric["status"], string> = {
  ok: "bg-success",
  pending: "bg-warning",
  error: "bg-danger",
};

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted">
          Terminology metrics · S2 shell (data stubs)
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {METRICS.map((m) => (
          <Card key={m.label}>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-mono text-[11px] uppercase tracking-wider">
                {m.label}
              </CardTitle>
              <span
                className={`h-2 w-2 rounded-full ${statusDot[m.status]}`}
                title={m.status}
                aria-label={`status ${m.status}`}
              />
            </CardHeader>
            <CardContent>
              <p className="font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground">
                {m.value}
              </p>
              <p className="mt-2 text-xs text-muted">{m.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-mono text-[11px] uppercase tracking-wider">
            Recent Edits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted">
            Placeholder — will list last 10 notes after S3/S6.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
