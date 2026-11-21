import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/table";
import { api } from "@/lib/api";
import { useFetch } from "@/hooks/useFetch";
import { cn } from "@/lib/utils";
import type { ProgressResponse } from "@/types";

const POLL_MS = 700;

export function Processing() {
  const { screeningId } = useParams();
  const id = Number(screeningId);
  const navigate = useNavigate();
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const { data: screening } = useFetch(() => api.getScreening(id), [id]);

  useEffect(() => {
    if (!Number.isFinite(id)) return;
    let cancelled = false;
    let timer: number | undefined;

    async function poll() {
      try {
        const result = await api.progress(id);
        if (cancelled) return;
        setProgress(result);
        setPollError(null);
        if (result.state === "running" || result.state === "idle") {
          timer = window.setTimeout(poll, POLL_MS);
        }
      } catch (error) {
        if (cancelled) return;
        setPollError(error instanceof Error ? error.message : "Lost connection to the API.");
        timer = window.setTimeout(poll, 2500);
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [id]);

  const stages = progress?.stages ?? [];
  const done = stages.filter((stage) => stage.status === "done").length;
  const percent = progress?.percent ?? 0;

  const counts = useMemo(
    () => ({
      total: progress?.total_files ?? 0,
      processed: progress?.processed_files ?? 0,
      succeeded: progress?.succeeded_files ?? 0,
      failed: progress?.failed_files ?? 0,
    }),
    [progress],
  );

  async function retry() {
    setRetrying(true);
    try {
      await api.startAnalysis(id);
      setProgress((current) => (current ? { ...current, state: "running" } : current));
      window.location.reload();
    } catch (error) {
      setPollError(error instanceof Error ? error.message : "Could not restart the analysis.");
    } finally {
      setRetrying(false);
    }
  }

  if (!Number.isFinite(id)) {
    return <ErrorState message="That screening id is not valid." />;
  }

  return (
    <div>
      <PageHeader
        title={screening ? `Analysing ${screening.job_title}` : "Analysing candidates"}
        subtitle="Stages below reflect real backend work — nothing here is simulated."
        meta={
          screening ? (
            <>
              <Badge tone="outline">{screening.company ?? "No company"}</Badge>
              <Badge tone="outline">{counts.total} files</Badge>
            </>
          ) : null
        }
        actions={
          progress?.state === "completed" ? (
            <Button asChild>
              <Link to={`/screenings/${id}`}>
                View rankings <ArrowRight />
              </Link>
            </Button>
          ) : undefined
        }
      />

      {pollError ? <ErrorState message={pollError} className="mb-4" onRetry={() => window.location.reload()} /> : null}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Pipeline</CardTitle>
            <span className="text-2xs text-muted-foreground">
              {done}/{stages.length || 9} stages
            </span>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="mb-1.5 flex items-center justify-between text-2xs text-muted-foreground">
                <span>{progress?.message ?? "Waiting for the analysis to start…"}</span>
                <span className="tabular-nums">{Math.round(percent)}%</span>
              </div>
              <Progress
                value={percent}
                className="h-2"
                indicatorClassName={progress?.state === "failed" ? "bg-destructive" : undefined}
              />
            </div>

            {stages.length === 0 ? (
              <div className="space-y-2">
                {[0, 1, 2, 3, 4].map((index) => (
                  <Skeleton key={index} className="h-8" />
                ))}
              </div>
            ) : (
              <ul className="space-y-1.5">
                {stages.map((stage, index) => {
                  const state = stage.status;
                  return (
                    <motion.li
                      key={stage.key}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md border px-2.5 py-2 text-[13px]",
                        state === "running"
                          ? "border-primary/30 bg-primary-subtle/60"
                          : state === "done"
                            ? "border-border bg-surface"
                            : state === "failed"
                              ? "border-destructive/30 bg-destructive/5"
                              : "border-transparent",
                      )}
                    >
                      <StageIcon state={state} />
                      <span
                        className={cn(
                          "flex-1",
                          state === "pending" ? "text-muted-foreground" : "text-foreground",
                          state === "running" && "font-medium",
                        )}
                      >
                        {stage.label}
                      </span>
                      <span className="max-w-[45%] truncate text-2xs text-muted-foreground">
                        {stage.detail ?? ""}
                      </span>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle>Files</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Metric label="Total" value={counts.total} />
              <Metric label="Processed" value={counts.processed} />
              <Metric label="Succeeded" value={counts.succeeded} tone="success" />
              <Metric label="Failed" value={counts.failed} tone={counts.failed ? "danger" : "muted"} />
            </CardContent>
          </Card>

          {progress?.errors?.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5 text-warning" /> Files that failed
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-56 space-y-1.5 overflow-y-auto">
                {progress.errors.map((error) => (
                  <div key={`${error.file}-${error.message}`} className="rounded-md border border-border bg-surface p-2">
                    <p className="truncate text-2xs font-medium">{error.file}</p>
                    <p className="mt-0.5 text-2xs text-muted-foreground">{error.message}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {progress?.state === "completed" ? (
            <Card className="border-success/30 bg-success-subtle/40">
              <CardContent className="pt-4">
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-success-foreground">
                  <CheckCircle2 className="size-4" /> Analysis complete
                </p>
                <p className="mt-1 text-2xs text-muted-foreground">{progress.message}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={() => navigate(`/screenings/${id}`)}>
                    View rankings <ArrowRight />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/screenings/${id}/analytics`)}>
                    Analytics
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {progress?.state === "failed" ? (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="pt-4">
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-destructive">
                  <XCircle className="size-4" /> Analysis failed
                </p>
                <p className="mt-1 text-2xs text-muted-foreground">{progress.message}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={retry} loading={retrying}>
                    <RefreshCw /> Try again
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/screenings/${id}`)}>
                    Inspect screening
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {progress?.state === "running" ? (
            <p className="flex items-center gap-1.5 px-1 text-2xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> You can leave this page — analysis continues on the server.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StageIcon({ state }: { state: string }) {
  if (state === "running") return <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" aria-label="Running" />;
  if (state === "done") return <CheckCircle2 className="size-3.5 shrink-0 text-success" aria-label="Done" />;
  if (state === "failed") return <XCircle className="size-3.5 shrink-0 text-destructive" aria-label="Failed" />;
  if (state === "skipped") return <Circle className="size-3.5 shrink-0 text-muted-foreground" aria-label="Skipped" />;
  return <Circle className="size-3.5 shrink-0 text-border" aria-label="Pending" />;
}

function Metric({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: number;
  tone?: "muted" | "success" | "danger";
}) {
  const color =
    tone === "success" ? "text-success-foreground" : tone === "danger" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-surface px-2.5 py-2">
      <p className="label-muted">{label}</p>
      <p className={cn("mt-0.5 text-lg font-semibold tabular-nums", color)}>{value}</p>
    </div>
  );
}
