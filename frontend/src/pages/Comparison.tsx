import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, GitCompareArrows, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Skeleton, TBody, TD, TH, THead, TR, Table, TableWrap } from "@/components/ui/table";
import { ScorePill } from "@/components/candidate/ScorePill";
import { SkillTag } from "@/components/candidate/SkillTag";
import { api } from "@/lib/api";
import { useFetch } from "@/hooks/useFetch";
import { MATCH_LABEL_TONE, cn, formatScore, formatYears } from "@/lib/utils";
import type { ComparisonCandidate } from "@/types";

const ROWS: {
  label: string;
  value: (candidate: ComparisonCandidate) => string;
  raw?: (candidate: ComparisonCandidate) => number | null;
  higherIsBetter?: boolean;
}[] = [
  {
    label: "Overall score",
    value: (c) => formatScore(c.overall_score),
    raw: (c) => c.overall_score,
    higherIsBetter: true,
  },
  { label: "Skills score", value: (c) => formatScore(c.skill_score), raw: (c) => c.skill_score, higherIsBetter: true },
  {
    label: "Semantic score",
    value: (c) => formatScore(c.semantic_score),
    raw: (c) => c.semantic_score,
    higherIsBetter: true,
  },
  {
    label: "Experience score",
    value: (c) => formatScore(c.experience_score),
    raw: (c) => c.experience_score,
    higherIsBetter: true,
  },
  {
    label: "Education score",
    value: (c) => formatScore(c.education_score),
    raw: (c) => c.education_score,
    higherIsBetter: true,
  },
  {
    label: "Relevant experience",
    value: (c) => formatYears(c.relevant_experience_years),
    raw: (c) => c.relevant_experience_years,
    higherIsBetter: true,
  },
  {
    label: "Required skill coverage",
    value: (c) => (c.coverage ? `${c.coverage.required.matched}/${c.coverage.required.total}` : "—"),
    raw: (c) => c.coverage?.required.matched ?? null,
    higherIsBetter: true,
  },
  {
    label: "Preferred skill coverage",
    value: (c) => (c.coverage ? `${c.coverage.preferred.matched}/${c.coverage.preferred.total}` : "—"),
    raw: (c) => c.coverage?.preferred.matched ?? null,
    higherIsBetter: true,
  },
  {
    label: "Missing required",
    value: (c) => String(c.missing_required.length),
    raw: (c) => c.missing_required.length,
    higherIsBetter: false,
  },
  { label: "Data completeness", value: (c) => `${Math.round(c.data_completeness)}%`, raw: (c) => c.data_completeness },
];

export function Comparison() {
  const { screeningId } = useParams();
  const id = Number(screeningId);
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const ids = (params.get("ids") ?? "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);

  const screeningState = useFetch(() => api.getScreening(id), [id]);
  const comparisonState = useFetch(
    () => (ids.length >= 2 ? api.compare(ids) : Promise.resolve({ candidates: [] })),
    [ids.join(",")],
  );

  // A candidate that failed parsing has no scores; comparing them would be noise.
  const candidates = (comparisonState.data?.candidates ?? []).filter(
    (candidate) => candidate.overall_score !== null,
  );

  function removeCandidate(candidateId: number) {
    const next = ids.filter((value) => value !== candidateId);
    navigate(`/screenings/${id}/compare?ids=${next.join(",")}`);
  }

  if (ids.length < 2) {
    return (
      <div>
        <PageHeader
          title="Compare candidates"
          subtitle="Pick 2–4 candidates from the ranking table to compare their evidence side by side."
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link to={`/screenings/${id}`}>
                <ArrowLeft /> Back to rankings
              </Link>
            </Button>
          }
        />
        <EmptyState
          icon={<GitCompareArrows className="size-5" />}
          title="Select at least two candidates"
          description="Open the rankings for this screening, tick the candidates you want to compare, then use the Compare button."
          action={
            <Button asChild>
              <Link to={`/screenings/${id}`}>
                <Plus /> Choose candidates
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (comparisonState.loading && !comparisonState.data) {
    return (
      <div>
        <Skeleton className="h-10 w-72" />
        <Skeleton className="mt-4 h-80" />
      </div>
    );
  }

  if (comparisonState.error) {
    return <ErrorState message={comparisonState.error} onRetry={comparisonState.reload} />;
  }

  const best = (row: (typeof ROWS)[number]) => {
    if (!row.raw) return null;
    const values = candidates.map((candidate) => row.raw!(candidate)).filter((value): value is number => value !== null);
    if (!values.length) return null;
    return row.higherIsBetter === false ? Math.min(...values) : Math.max(...values);
  };

  return (
    <div>
      <PageHeader
        title="Compare candidates"
        subtitle={screeningState.data ? `${screeningState.data.job_title} · ${candidates.length} candidates` : undefined}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to={`/screenings/${id}`}>
              <ArrowLeft /> Back to rankings
            </Link>
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <TH className="w-[200px]">Metric</TH>
                {candidates.map((candidate) => (
                  <TH key={candidate.id} className="min-w-[190px]">
                    <div className="flex items-start justify-between gap-2 py-1">
                      <div>
                        <Link to={`/candidates/${candidate.id}`} className="text-[13px] font-semibold normal-case tracking-normal text-foreground hover:text-primary hover:underline">
                          {candidate.name}
                        </Link>
                        <div className="mt-1 flex items-center gap-1">
                          {candidate.match_label ? (
                            <Badge tone={MATCH_LABEL_TONE[candidate.match_label] ?? "muted"}>{candidate.match_label}</Badge>
                          ) : null}
                          {candidate.rank ? <Badge tone="outline">#{candidate.rank}</Badge> : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCandidate(candidate.id)}
                        className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                        aria-label={`Remove ${candidate.name} from comparison`}
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  </TH>
                ))}
              </tr>
            </THead>
            <TBody>
              <TR>
                <TD className="font-medium">Score</TD>
                {candidates.map((candidate) => (
                  <TD key={candidate.id}>
                    <ScorePill score={candidate.overall_score} label={candidate.match_label} />
                  </TD>
                ))}
              </TR>
              {ROWS.slice(1).map((row) => {
                const rowBest = best(row);
                return (
                  <TR key={row.label}>
                    <TD className="text-muted-foreground">{row.label}</TD>
                    {candidates.map((candidate) => {
                      const raw = row.raw?.(candidate) ?? null;
                      const isBest = rowBest !== null && raw !== null && raw === rowBest;
                      return (
                        <TD key={candidate.id}>
                          <span
                            className={cn(
                              "tabular-nums",
                              isBest && "rounded bg-success-subtle px-1.5 py-0.5 font-semibold text-success-foreground",
                            )}
                          >
                            {row.value(candidate)}
                          </span>
                        </TD>
                      );
                    })}
                  </TR>
                );
              })}
              <TR>
                <TD className="align-top text-muted-foreground">Matched required skills</TD>
                {candidates.map((candidate) => (
                  <TD key={candidate.id} className="align-top">
                    <div className="flex flex-wrap gap-1">
                      {candidate.matched_required.length ? (
                        candidate.matched_required.map((skill) => <SkillTag key={skill} skill={skill} state="exact" />)
                      ) : (
                        <span className="text-2xs text-muted-foreground">None</span>
                      )}
                    </div>
                  </TD>
                ))}
              </TR>
              <TR>
                <TD className="align-top text-muted-foreground">Missing required skills</TD>
                {candidates.map((candidate) => (
                  <TD key={candidate.id} className="align-top">
                    <div className="flex flex-wrap gap-1">
                      {candidate.missing_required.length ? (
                        candidate.missing_required.map((skill) => <SkillTag key={skill} skill={skill} state="missing" />)
                      ) : (
                        <span className="text-2xs text-muted-foreground">None</span>
                      )}
                    </div>
                  </TD>
                ))}
              </TR>
              <TR>
                <TD className="align-top text-muted-foreground">Relevant roles</TD>
                {candidates.map((candidate) => (
                  <TD key={candidate.id} className="align-top">
                    <ul className="space-y-1 text-2xs">
                      {candidate.experience_roles.length ? (
                        candidate.experience_roles.slice(0, 3).map((role, index) => (
                          <li key={`${role.title}-${index}`} className="leading-snug">
                            <span className="font-medium">{role.title ?? "Role"}</span>
                            {role.company ? ` · ${role.company}` : ""}
                            <span className="text-muted-foreground"> ({Math.round(role.relevance_factor * 100)}% relevant)</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-muted-foreground">No roles extracted</li>
                      )}
                    </ul>
                  </TD>
                ))}
              </TR>
              <TR>
                <TD className="align-top text-muted-foreground">Education</TD>
                {candidates.map((candidate) => (
                  <TD key={candidate.id} className="align-top text-2xs">
                    {candidate.education.length ? (
                      candidate.education.map((entry) => (
                        <p key={entry.degree} className="leading-snug">
                          {entry.degree}
                          {entry.year ? ` · ${entry.year}` : ""}
                        </p>
                      ))
                    ) : (
                      <span className="text-muted-foreground">Not extracted</span>
                    )}
                  </TD>
                ))}
              </TR>
            </TBody>
          </Table>
        </TableWrap>
      </Card>

      <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
        {candidates.map((candidate) => (
          <Card key={candidate.id}>
            <CardHeader>
              <CardTitle className="truncate">{candidate.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-2xs text-muted-foreground">
              <p className="leading-relaxed text-foreground">{candidate.headline}</p>
              {candidate.related_only.length ? (
                <p className="rounded border border-warning/30 bg-warning-subtle p-1.5 text-warning-foreground">
                  Related-only: {candidate.related_only.join(", ")}
                </p>
              ) : null}
              <Button variant="outline" size="sm" asChild className="w-full">
                <Link to={`/candidates/${candidate.id}`}>Open full profile</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-4 text-2xs text-muted-foreground">
        Highlighted values are the best in the row — a single best value is not a hiring recommendation, and
        missing information is excluded rather than scored as zero.
      </p>
    </div>
  );
}
