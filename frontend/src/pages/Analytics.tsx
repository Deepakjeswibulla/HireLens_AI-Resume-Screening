import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft, BarChart3, CheckCircle2, TrendingDown, Users } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { useFetch } from "@/hooks/useFetch";
import { formatScore } from "@/lib/utils";

const CHART_COLORS = ["#7c3aed", "#8b5cf6", "#a78bfa", "#c4b5fd"];
const AXIS = { fontSize: 11, fill: "hsl(215 16% 45%)" };

function ChartCard({
  title,
  description,
  children,
  empty,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="py-10 text-center text-[13px] text-muted-foreground">Not enough data to chart this yet.</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export function Analytics() {
  const { screeningId } = useParams();
  const isScreeningView = Boolean(screeningId);
  const id = Number(screeningId);

  const screeningsState = useFetch(() => api.listScreenings(), []);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const analysedScreenings = (screeningsState.data ?? []).filter((screening) => screening.analyzed_count > 0);
  const activeId = isScreeningView ? id : selectedId ?? analysedScreenings[0]?.id ?? null;

  const analyticsState = useFetch(
    () => (activeId ? api.analytics(activeId) : Promise.resolve(null)),
    [activeId],
  );
  const screeningState = useFetch(
    () => (activeId ? api.getScreening(activeId) : Promise.resolve(null)),
    [activeId],
  );

  const data = analyticsState.data;
  const screening = screeningState.data;

  const topChartData = useMemo(
    () =>
      (data?.top_candidates ?? []).map((candidate) => ({
        name: candidate.name.split(" ")[0],
        Skills: candidate.skills ?? 0,
        Semantic: candidate.semantic ?? 0,
        Experience: candidate.experience ?? 0,
        Education: candidate.education ?? 0,
      })),
    [data],
  );

  if (isScreeningView && analyticsState.loading && !data) {
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

  if (analyticsState.error) {
    return <ErrorState message={analyticsState.error} onRetry={analyticsState.reload} />;
  }

  if (!isScreeningView && analysedScreenings.length === 0) {
    return (
      <div>
        <PageHeader title="Analytics" subtitle="Screening insights computed from real analysis data." />
        <EmptyState
          icon={<BarChart3 className="size-5" />}
          title="No analysed screenings yet"
          description="Analytics appear once a screening has been analysed. Create a screening or load the synthetic demo to explore the charts."
          action={
            <Button asChild>
              <Link to="/screenings/new">Create a screening</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle={
          isScreeningView && screening
            ? `${screening.job_title}${screening.company ? ` · ${screening.company}` : ""}`
            : "Screening insights computed from real analysis data."
        }
        actions={
          <>
            {isScreeningView ? (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/screenings/${id}`}>
                  <ArrowLeft /> Back to rankings
                </Link>
              </Button>
            ) : (
              <Select
                value={String(activeId ?? "")}
                onValueChange={(value) => setSelectedId(Number(value))}
              >
                <SelectTrigger className="w-[260px]" aria-label="Choose a screening">
                  <SelectValue placeholder="Choose a screening" />
                </SelectTrigger>
                <SelectContent>
                  {analysedScreenings.map((entry) => (
                    <SelectItem key={entry.id} value={String(entry.id)}>
                      {entry.job_title} ({entry.analyzed_count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {screening?.is_demo ? <Badge tone="outline">synthetic demo data</Badge> : null}
          </>
        }
      />

      {!data?.has_data ? (
        <EmptyState
          icon={<BarChart3 className="size-5" />}
          title="Nothing analysed yet"
          description={data?.message ?? "Run an analysis for this screening to see its analytics."}
          action={
            activeId ? (
              <Button asChild>
                <Link to={`/screenings/${activeId}`}>Open screening</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Candidates analysed"
              value={data.analyzed_count}
              hint={`${data.candidate_count} uploaded${data.failed_count ? ` · ${data.failed_count} failed` : ""}`}
              icon={<Users />}
            />
            <StatCard
              label="Average score"
              value={formatScore(data.average_score)}
              hint={`Lowest ${formatScore(data.lowest_score)} · highest ${formatScore(data.highest_score)}`}
            />
            <StatCard
              label="Strong matches"
              value={data.strong_matches ?? 0}
              hint={`${data.strong_match_percent ?? 0}% of analysed candidates`}
              tone="success"
              icon={<CheckCircle2 />}
            />
            <StatCard
              label="Meeting experience"
              value={
                data.minimum_experience
                  ? `${data.meeting_experience ?? 0}`
                  : "n/a"
              }
              hint={
                data.minimum_experience
                  ? `${data.meeting_experience_percent ?? 0}% meet the ${data.minimum_experience}-year requirement`
                  : "The JD states no minimum experience"
              }
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Score distribution"
              description="How many candidates fall into each score band."
              empty={!data.score_distribution?.some((entry) => entry.count > 0)}
            >
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.score_distribution ?? []} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 18% 91%)" vertical={false} />
                  <XAxis dataKey="range" tick={AXIS} tickLine={false} axisLine={false} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                  <ChartTooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(220 18% 91%)" }}
                    formatter={(value: number) => [`${value} candidates`, "Count"]}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} fill={CHART_COLORS[0]} animationDuration={400} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Required skill coverage"
              description="Share of analysed candidates showing each required skill."
              empty={!data.required_skill_coverage?.length}
            >
              <ResponsiveContainer width="100%" height={Math.max(240, (data.required_skill_coverage?.length ?? 0) * 30)}>
                <BarChart
                  data={data.required_skill_coverage ?? []}
                  layout="vertical"
                  margin={{ top: 4, right: 24, bottom: 0, left: 24 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 18% 91%)" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} unit="%" />
                  <YAxis type="category" dataKey="skill" width={110} tick={AXIS} tickLine={false} axisLine={false} />
                  <ChartTooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(220 18% 91%)" }}
                    formatter={(value: number, _name, entry) => [
                      `${value}% (${(entry?.payload as { matched: number })?.matched ?? 0} candidates)`,
                      "Coverage",
                    ]}
                  />
                  <Bar dataKey="percent" radius={[0, 4, 4, 0]} animationDuration={400}>
                    {(data.required_skill_coverage ?? []).map((entry) => (
                      <Cell
                        key={entry.skill}
                        fill={entry.percent >= 70 ? "#15803d" : entry.percent >= 40 ? "#7c3aed" : "#b45309"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Most common skill gaps"
              description="Required skills missing across the most candidates."
              empty={!data.most_common_gaps?.length}
            >
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.most_common_gaps ?? []} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 18% 91%)" vertical={false} />
                  <XAxis dataKey="skill" tick={{ ...AXIS, fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} tickLine={false} axisLine={false} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                  <ChartTooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(220 18% 91%)" }}
                    formatter={(value: number) => [`${value} candidates`, "Missing"]}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#b45309" animationDuration={400} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Relevant experience distribution"
              description="Relevant (not merely total) years per candidate."
              empty={!data.experience_distribution?.some((entry) => entry.count > 0)}
            >
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.experience_distribution ?? []} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 18% 91%)" vertical={false} />
                  <XAxis dataKey="range" tick={AXIS} tickLine={false} axisLine={false} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                  <ChartTooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(220 18% 91%)" }}
                    formatter={(value: number) => [`${value} candidates`, "Count"]}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} fill={CHART_COLORS[1]} animationDuration={400} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <ChartCard
              title="Top candidates — component scores"
              description="Why the leading candidates scored what they did."
              empty={!topChartData.length}
            >
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topChartData} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 18% 91%)" vertical={false} />
                  <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} />
                  <ChartTooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(220 18% 91%)" }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Skills" fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Semantic" fill={CHART_COLORS[1]} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Experience" fill={CHART_COLORS[2]} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Education" fill={CHART_COLORS[3]} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <Card>
              <CardHeader>
                <CardTitle>Insights</CardTitle>
                <CardDescription>Computed from this screening's stored analyses.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5 text-[13px]">
                {data.most_common_gaps?.length ? (
                  <Insight
                    icon={<TrendingDown className="size-3.5 text-warning" />}
                    text={`Biggest gap: ${data.most_common_gaps[0].skill} — missing in ${data.most_common_gaps[0].count} of ${data.analyzed_count} candidates.`}
                  />
                ) : null}
                {data.most_matched_skills?.length ? (
                  <Insight
                    icon={<CheckCircle2 className="size-3.5 text-success" />}
                    text={`Most frequently matched: ${data.most_matched_skills
                      .slice(0, 3)
                      .map((entry) => `${entry.skill} (${entry.count})`)
                      .join(", ")}.`}
                  />
                ) : null}
                {data.label_distribution?.length ? (
                  <Insight
                    icon={<Users className="size-3.5 text-primary" />}
                    text={`Match mix: ${data.label_distribution
                      .map((entry) => `${entry.count} ${entry.label.toLowerCase()}`)
                      .join(", ")}.`}
                  />
                ) : null}
                {data.status_distribution?.length ? (
                  <Insight
                    icon={<BarChart3 className="size-3.5 text-muted-foreground" />}
                    text={`Recruiter statuses: ${data.status_distribution
                      .map((entry) => `${entry.count} ${entry.status}`)
                      .join(", ")}.`}
                  />
                ) : null}
                <p className="pt-1 text-2xs leading-relaxed text-muted-foreground">
                  All figures come from stored analyses. Empty charts mean no data, never zero-filled placeholders.
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Insight({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-border bg-surface p-2">
      <span className="mt-0.5">{icon}</span>
      <p className="leading-relaxed">{text}</p>
    </div>
  );
}
