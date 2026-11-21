import { Link } from "react-router-dom";
import { Info, Moon, Sparkles, Sun } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/table";
import { ErrorState } from "@/components/ui/empty-state";
import { Switch } from "@/components/ui/toggles";
import { api } from "@/lib/api";
import { useFetch } from "@/hooks/useFetch";
import { useTheme } from "@/hooks/useTheme";

const COMPONENT_LABELS: Record<string, string> = {
  skills: "Skills matching",
  semantic: "Semantic relevance",
  experience: "Relevant experience",
  education: "Education & qualifications",
};

export function Settings() {
  const { data: config, loading, error, reload } = useFetch(() => api.config(), []);
  const { theme, toggleTheme } = useTheme();

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="How this workspace scores candidates. Values come from the backend configuration, not the interface."
      />

      {loading && !config ? (
        <Skeleton className="h-64" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : config ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Score weights</CardTitle>
              <CardDescription>
                Configured in the backend (<code className="font-mono text-2xs">app/core/config.py</code>) and returned by{" "}
                <code className="font-mono text-2xs">/api/meta/config</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(config.weights).map(([key, weight]) => (
                <div key={key} className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
                  <span className="text-[13px]">{COMPONENT_LABELS[key] ?? key}</span>
                  <span className="text-[13px] font-semibold tabular-nums">{Math.round(weight * 100)}%</span>
                </div>
              ))}
              <p className="pt-1 text-2xs text-muted-foreground">
                Version {config.score_version}. Missing components are excluded and the remaining weights renormalised.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Match labels</CardTitle>
              <CardDescription>Descriptive bands — never an automatic decision.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {config.labels.map((label) => (
                <div key={label.label} className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
                  <span className="text-[13px] font-medium">{label.label}</span>
                  <span className="text-2xs text-muted-foreground tabular-nums">
                    {label.min}–{label.max}
                  </span>
                </div>
              ))}
              <p className="pt-1 text-2xs text-muted-foreground">
                Thresholds live in one place in the backend and are applied identically everywhere.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Semantic backend</CardTitle>
              <CardDescription>Embedding model used for semantic relevance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-[13px]">
              <Row label="State">
                <Badge tone={config.semantic.state === "ready" ? "success" : config.semantic.state === "loading" ? "warning" : "outline"}>
                  {config.semantic.state}
                </Badge>
              </Row>
              <Row label="Method">
                <span className="font-mono text-2xs">{config.semantic.method}</span>
              </Row>
              <Row label="Model">
                <span className="font-mono text-2xs">{config.semantic.model}</span>
              </Row>
              <Row label="Calibration window">
                <span className="font-mono text-2xs">
                  {config.semantic.calibration.low} – {config.semantic.calibration.high} cosine
                  {config.semantic.calibration_fallback
                    ? ` (fallback ${config.semantic.calibration_fallback.low} – ${config.semantic.calibration_fallback.high})`
                    : ""}
                </span>
              </Row>
              {config.semantic.error ? (
                <p className="rounded-md border border-warning/30 bg-warning-subtle p-2 text-2xs text-warning-foreground">
                  Model unavailable: {config.semantic.error}. The TF-IDF/SVD fallback is being used and is reported in the
                  UI so it is never mistaken for transformer output.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Uploads & appearance</CardTitle>
              <CardDescription>Limits enforced by the API and stored in the database.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-[13px]">
              <Row label="Max file size">
                <span>{config.semantic.max_upload_mb} MB</span>
              </Row>
              <Row label="Max resumes per screening">
                <span>{config.semantic.max_resumes}</span>
              </Row>
              <Row label="Accepted types">
                <span className="font-mono text-2xs">{config.semantic.accepted_types.join(", ")}</span>
              </Row>
              <Row label="Required skill weight">
                <span className="font-mono text-2xs">{config.semantic.requirement_weights.required}×</span>
              </Row>
              <Row label="Preferred skill weight">
                <span className="font-mono text-2xs">{config.semantic.requirement_weights.preferred}×</span>
              </Row>
              <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
                <span className="flex items-center gap-1.5">
                  {theme === "light" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />} Dark theme
                </span>
                <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} aria-label="Toggle dark theme" />
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Data & privacy</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-[13px] sm:grid-cols-2">
              <p className="text-muted-foreground">
                Uploaded files stay in a private local directory; only this API serves them, and resume text is rendered
                as plain text so it cannot execute markup. Screening data lives in a local SQLite database and survives
                restarts.
              </p>
              <div className="flex flex-col gap-2">
                <p className="text-muted-foreground">
                  Demo data is synthetic and flagged as such; it is never mixed into your real screenings.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/help">
                      <Info /> How scoring works
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href="/api/docs" target="_blank" rel="noreferrer">
                      <Sparkles /> API reference
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
