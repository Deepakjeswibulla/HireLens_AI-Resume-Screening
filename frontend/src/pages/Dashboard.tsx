import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  Plus,
  ScanSearch,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Skeleton, TBody, TD, TH, THead, TR, Table, TableWrap } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { useFetch } from "@/hooks/useFetch";
import { formatDate, formatScore } from "@/lib/utils";

const STATUS_TONE: Record<string, "muted" | "primary" | "success" | "warning" | "danger"> = {
  draft: "muted",
  uploading: "primary",
  analyzing: "warning",
  completed: "success",
  failed: "danger",
};

export function Dashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const [loadingDemo, setLoadingDemo] = useState(false);
  const { data, loading, error, reload } = useFetch(() => api.overview(), []);

  async function loadDemo() {
    setLoadingDemo(true);
    try {
      const result = await api.loadDemo();
      toast.success("Demo screening created", `${result.candidates} synthetic candidates are being analysed.`);
      navigate(`/screenings/${result.screening_id}/processing`);
    } catch (err) {
      toast.error("Could not load demo data", err instanceof Error ? err.message : undefined);
    } finally {
      setLoadingDemo(false);
    }
  }

  if (loading && !data) {
    return (
      <div>
        <PageHeader title="Overview" subtitle="Track your candidate screening and hiring insights." />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-[104px]" />
          ))}
        </div>
        <Skeleton className="mt-6 h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Overview" subtitle="Track your candidate screening and hiring insights." />
        <ErrorState message={error} onRetry={reload} />
      </div>
    );
  }

  const metrics = data?.metrics;
  const recent = data?.recent_screenings ?? [];
  const topCandidates = data?.top_candidates ?? [];

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle="Track your candidate screening and hiring insights."
        actions={
          <>
            <Button variant="outline" onClick={loadDemo} loading={loadingDemo}>
              <Sparkles /> Load demo data
            </Button>
            <Button asChild>
              <Link to="/screenings/new">
                <Plus /> New Screening
              </Link>
            </Button>
          </>
        }
      />

      {data?.semantic && data.semantic.state !== "ready" ? (
        <div className="mb-4 rounded-lg border border-warning/30 bg-warning-subtle px-4 py-2.5 text-[13px] text-warning-foreground">
          {data.semantic.state === "loading"
            ? "The semantic embedding model is loading. Screening works now; semantic scores will use the model once it is ready."
            : `Semantic matching is running on the ${data.semantic.method} fallback backend${data.semantic.error ? " (model unavailable)" : ""}. Scores are still computed from real text, but semantic similarity is weaker than the transformer model.`}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active jobs"
          value={metrics?.active_jobs ?? 0}
          hint={`${metrics?.total_screenings ?? 0} screenings in total`}
          icon={<Briefcase />}
        />
        <StatCard
          label="Total candidates"
          value={metrics?.total_candidates ?? 0}
          hint={`${metrics?.shortlisted ?? 0} shortlisted`}
          icon={<Users />}
        />
        <StatCard
          label="Candidates analyzed"
          value={metrics?.analyzed_candidates ?? 0}
          hint="Scored by the matching engine"
          icon={<ScanSearch />}
          tone="primary"
        />
        <StatCard
          label="Average match score"
          value={metrics?.average_score !== null && metrics?.average_score !== undefined ? formatScore(metrics.average_score) : "—"}
          hint={`${metrics?.strong_matches ?? 0} strong matches (85+)`}
          icon={<BarChart3 />}
          tone="success"
        />
      </div>

      {!data?.has_data ? (
        <div className="mt-6">
          <EmptyState
            icon={<ScanSearch className="size-5" />}
            title="No screenings yet"
            description="HireLens reads a job description, extracts its requirements, parses every resume you upload, then scores and ranks candidates with an explanation for each score. Create your first screening, or explore a fully synthetic demo."
            action={
              <>
                <Button asChild>
                  <Link to="/screenings/new">
                    <Plus /> Create your first screening
                  </Link>
                </Button>
                <Button variant="outline" onClick={loadDemo} loading={loadingDemo}>
                  <Sparkles /> Explore demo data
                </Button>
              </>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid items-start gap-4 xl:grid-cols-[1.6fr_1fr]">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Recent screening activity</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/jobs">
                  View all <ArrowRight />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <TableWrap>
                <Table>
                  <THead>
                    <tr>
                      <TH>Job title</TH>
                      <TH>Created</TH>
                      <TH className="text-right">Candidates</TH>
                      <TH className="text-right">Avg score</TH>
                      <TH>Status</TH>
                      <TH />
                    </tr>
                  </THead>
                  <TBody>
                    {recent.map((screening) => (
                      <TR key={screening.id}>
                        <TD>
                          <Link
                            to={`/screenings/${screening.id}`}
                            className="font-medium hover:text-primary hover:underline"
                          >
                            {screening.job_title}
                          </Link>
                          <div className="flex items-center gap-1.5">
                            <p className="text-2xs text-muted-foreground">{screening.company ?? "—"}</p>
                            {screening.is_demo ? <Badge tone="outline">demo</Badge> : null}
                          </div>
                        </TD>
                        <TD className="whitespace-nowrap text-muted-foreground">{formatDate(screening.created_at)}</TD>
                        <TD className="text-right tabular-nums">
                          {screening.candidate_count}
                          {screening.failed_count ? (
                            <span className="ml-1 text-2xs text-destructive">({screening.failed_count} failed)</span>
                          ) : null}
                        </TD>
                        <TD className="text-right font-medium tabular-nums">{formatScore(screening.average_score)}</TD>
                        <TD>
                          <Badge tone={STATUS_TONE[screening.status] ?? "muted"}>{screening.status}</Badge>
                        </TD>
                        <TD className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/screenings/${screening.id}`}>Open</Link>
                          </Button>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent top candidates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {topCandidates.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-muted-foreground">
                  No analysed candidates yet.
                </p>
              ) : (
                topCandidates.map((candidate, index) => (
                  <motion.div
                    key={candidate.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <Link
                      to={`/candidates/${candidate.id}`}
                      className="flex items-center gap-3 rounded-md border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-muted/40"
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-2xs font-semibold text-secondary-foreground">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{candidate.name}</p>
                        <p className="truncate text-2xs text-muted-foreground">{candidate.job_title}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[13px] font-semibold tabular-nums">{formatScore(candidate.overall_score)}</p>
                        <p className="text-2xs text-muted-foreground">{candidate.match_label}</p>
                      </div>
                    </Link>
                  </motion.div>
                ))
              )}
              {topCandidates.length > 0 ? (
                <p className="flex items-center gap-1 pt-1 text-2xs text-muted-foreground">
                  <Star className="size-3" /> Ranked by overall match score across all screenings
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
