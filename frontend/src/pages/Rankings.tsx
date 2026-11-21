import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  Download,
  GitCompareArrows,
  RefreshCw,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { CandidateTable } from "@/components/candidate/CandidateTable";
import { api } from "@/lib/api";
import { useFetch } from "@/hooks/useFetch";
import { downloadBlob, formatDate, formatScore } from "@/lib/utils";
import type { CandidateListItem, CandidateStatus } from "@/types";

export function Rankings() {
  const { screeningId } = useParams();
  const id = Number(screeningId);
  const navigate = useNavigate();
  const toast = useToast();

  const [candidates, setCandidates] = useState<CandidateListItem[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [exporting, setExporting] = useState(false);

  const screeningState = useFetch(() => api.getScreening(id), [id]);
  const candidatesState = useFetch(() => api.candidates(id), [id]);

  useEffect(() => {
    if (candidatesState.data) setCandidates(candidatesState.data);
  }, [candidatesState.data]);

  const analyzed = candidates.filter((candidate) => candidate.overall_score !== null);
  const summary = useMemo(() => {
    const scores = analyzed.map((candidate) => candidate.overall_score as number);
    return {
      analyzed: analyzed.length,
      strong: scores.filter((score) => score >= 85).length,
      average: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
      highest: scores.length ? Math.max(...scores) : null,
      failed: candidates.filter((candidate) => candidate.parse_status === "failed").length,
    };
  }, [candidates, analyzed]);

  const screening = screeningState.data;
  const requiredSkills = screening?.requirements.required_skills ?? [];

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await api.exportCsv(id);
      downloadBlob(blob, `hirelens-${screening?.job_title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() ?? "screening"}-${id}.csv`);
      toast.success("CSV exported", "Only this screening's results are included.");
    } catch (error) {
      toast.error("Export failed", error instanceof Error ? error.message : undefined);
    } finally {
      setExporting(false);
    }
  }

  function handleStatusChange(candidateId: number, status: CandidateStatus) {
    setCandidates((current) =>
      current.map((candidate) => (candidate.id === candidateId ? { ...candidate, status } : candidate)),
    );
  }

  if (screeningState.loading && !screening) {
    return (
      <div>
        <Skeleton className="h-10 w-64" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
        <Skeleton className="mt-4 h-72" />
      </div>
    );
  }

  if (screeningState.error) {
    return <ErrorState message={screeningState.error} onRetry={screeningState.reload} />;
  }

  if (!screening) return null;

  return (
    <div className="pb-16">
      <PageHeader
        title={screening.job_title}
        subtitle={
          screening.company
            ? `${screening.company} · created ${formatDate(screening.created_at)}`
            : `Created ${formatDate(screening.created_at)}`
        }
        meta={
          <>
            <Badge tone={screening.status === "completed" ? "success" : screening.status === "failed" ? "danger" : "warning"}>
              {screening.status}
            </Badge>
            {screening.is_demo ? <Badge tone="outline">synthetic demo data</Badge> : null}
            <span className="text-2xs text-muted-foreground">
              {screening.candidate_count} resumes · {screening.required_skill_count} required skills
            </span>
          </>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/jobs">
                <ArrowLeft /> All screenings
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/screenings/${id}/analytics`}>
                <BarChart3 /> Analytics
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} loading={exporting}>
              <Download /> Export CSV
            </Button>
            <Button
              size="sm"
              onClick={() => navigate(`/screenings/${id}/compare?ids=${selected.join(",")}`)}
              disabled={selected.length < 2}
              title={selected.length < 2 ? "Select at least 2 candidates" : "Compare selected candidates"}
            >
              <GitCompareArrows /> Compare {selected.length ? `(${selected.length})` : ""}
            </Button>
          </>
        }
      />

      {screening.status === "analyzing" ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning-subtle px-4 py-2.5 text-[13px] text-warning-foreground">
          <span>Analysis is still running for this screening.</span>
          <Button size="sm" variant="outline" asChild>
            <Link to={`/screenings/${id}/processing`}>
              <RefreshCw /> View progress
            </Link>
          </Button>
        </div>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Candidates analyzed" value={summary.analyzed} hint={`${candidates.length} uploaded`} icon={<Users />} />
        <StatCard
          label="Strong matches"
          value={summary.strong}
          hint={summary.analyzed ? `${Math.round((summary.strong / summary.analyzed) * 100)}% of analysed` : "—"}
          icon={<Sparkles />}
          tone="success"
        />
        <StatCard label="Average score" value={formatScore(summary.average)} hint="Across analysed candidates" />
        <StatCard label="Highest score" value={formatScore(summary.highest)} hint="Top candidate" tone="primary" />
      </div>

      {candidates.length === 0 ? (
        <EmptyState
          icon={<Upload className="size-5" />}
          title="No resumes in this screening yet"
          description="Upload resumes to this screening, then run the analysis to see ranked candidates."
          action={
            <>
              <Button asChild>
                <Link to="/screenings/new">
                  <Sparkles /> Start a new screening
                </Link>
              </Button>
              <Button variant="outline" onClick={candidatesState.reload}>
                <RefreshCw /> Refresh
              </Button>
            </>
          }
        />
      ) : (
        <>
          {summary.failed ? (
            <div className="mb-3 rounded-lg border border-warning/30 bg-warning-subtle px-4 py-2 text-2xs text-warning-foreground">
              {summary.failed} file(s) could not be parsed and are excluded from ranking. Their errors are shown in the
              table.
            </div>
          ) : null}

          {candidatesState.error ? (
            <ErrorState message={candidatesState.error} onRetry={candidatesState.reload} className="mb-3" />
          ) : null}

          <CandidateTable
            candidates={candidates}
            requiredSkills={requiredSkills}
            selected={selected}
            onSelectedChange={setSelected}
            onStatusChange={handleStatusChange}
          />
        </>
      )}

      {selected.length >= 2 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-popover/95 px-4 py-2.5 shadow-lg backdrop-blur">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2">
            <p className="text-[13px]">
              <span className="font-medium">{selected.length} candidates selected</span>
              <span className="ml-2 text-muted-foreground">Compare up to 4 side by side.</span>
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
                Clear
              </Button>
              <Button size="sm" onClick={() => navigate(`/screenings/${id}/compare?ids=${selected.join(",")}`)}>
                <GitCompareArrows /> Compare candidates
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {candidates.length > 0 ? (
        <Card className="mt-4">
          <CardContent className="pt-4 text-2xs leading-relaxed text-muted-foreground">
            Scores combine skills (40%), semantic relevance (30%), experience (20%) and education (10%). Components with
            missing information are excluded and the remaining weights are renormalised — a candidate is never penalised
            for data the parser could not find. Labels describe evidence, not hiring decisions.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
