import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Briefcase,
  Download,
  ExternalLink,
  FileText,
  GitCompareArrows,
  GraduationCap,
  Info,
  Layers,
  Mail,
  Star,
  UserCheck,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/toast";
import { ComponentBar, ScorePill } from "@/components/candidate/ScorePill";
import { SkillTag, type SkillMatchState } from "@/components/candidate/SkillTag";
import { StatusSelect } from "@/components/candidate/StatusSelect";
import { api } from "@/lib/api";
import { useFetch } from "@/hooks/useFetch";
import { cn, formatScore, formatYears, titleCase } from "@/lib/utils";
import type { CandidateStatus, SkillEvidence } from "@/types";

const COMPONENT_LABELS: Record<string, string> = {
  skills: "Skills match",
  semantic: "Semantic relevance",
  experience: "Relevant experience",
  education: "Education",
};

const MATCH_STATE: Record<string, SkillMatchState> = {
  exact: "exact",
  alias: "alias",
  related: "related",
  semantic: "semantic",
};

export function CandidateProfile() {
  const { candidateId } = useParams();
  const id = Number(candidateId);
  const navigate = useNavigate();
  const toast = useToast();
  const { data: candidate, loading, error, reload } = useFetch(() => api.candidate(id), [id]);
  const [status, setStatus] = useState<CandidateStatus | null>(null);

  if (loading && !candidate) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!candidate) return null;

  const analysis = candidate.analysis;
  const profile = candidate.parsed_profile ?? ({} as typeof candidate.parsed_profile);
  const currentStatus = status ?? candidate.status;

  const matchedRequired = (analysis?.matched_skills ?? []).filter((match) => match.requirement === "required");
  const matchedPreferred = (analysis?.matched_skills ?? []).filter((match) => match.requirement === "preferred");
  const related = matchedRequired.filter((match) => match.match_type === "related");

  async function shortlist() {
    try {
      const updated = await api.updateStatus(candidate!.id, "shortlisted");
      setStatus(updated.status);
      toast.success("Candidate shortlisted", "You can change this at any time — scores never reject anyone.");
    } catch (err) {
      toast.error("Could not update status", err instanceof Error ? err.message : undefined);
    }
  }

  return (
    <div>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {candidate.name ?? "Unnamed candidate"}
            {candidate.rank ? <Badge tone="primary">Rank #{candidate.rank}</Badge> : null}
            {currentStatus !== "new" ? <Badge tone="success">{titleCase(currentStatus)}</Badge> : null}
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-3">
            {candidate.email ? (
              <span className="inline-flex items-center gap-1">
                <Mail className="size-3" /> {candidate.email}
              </span>
            ) : null}
            {candidate.resume_filename ? (
              <span className="inline-flex items-center gap-1">
                <FileText className="size-3" /> {candidate.resume_filename}
              </span>
            ) : null}
          </span>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/screenings/${candidate.screening_id}`}>
                <ArrowLeft /> Back to rankings
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/screenings/${candidate.screening_id}/compare?ids=${candidate.id}`)}
            >
              <GitCompareArrows /> Compare
            </Button>
            {currentStatus !== "shortlisted" ? (
              <Button size="sm" onClick={shortlist}>
                <UserCheck /> Shortlist
              </Button>
            ) : null}
            <StatusSelect candidateId={candidate.id} value={currentStatus} onChange={setStatus} className="hidden sm:block" />
          </>
        }
      />

      {candidate.parse_status === "failed" ? (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px]">
          <p className="font-medium text-destructive">This resume could not be parsed</p>
          <p className="mt-0.5 text-muted-foreground">{candidate.parse_error}</p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-5">
              <ScorePill score={candidate.overall_score} label={candidate.match_label} size="lg" />
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-3">
                <Detail label="Relevant experience" value={formatYears(candidate.relevant_experience_years)} />
                <Detail label="Total experience" value={formatYears(candidate.total_experience_years)} />
                <Detail
                  label="Required skills"
                  value={`${analysis?.coverage.required.matched ?? 0}/${analysis?.coverage.required.total ?? 0}`}
                />
                <Detail
                  label="Preferred skills"
                  value={`${analysis?.coverage.preferred.matched ?? 0}/${analysis?.coverage.preferred.total ?? 0}`}
                />
                <Detail label="Data completeness" value={`${Math.round(candidate.data_completeness)}%`} />
                <Detail label="Resume file" value={candidate.resume_filename ?? "—"} />
              </div>
            </CardContent>
          </Card>

          {analysis ? (
            <Card>
              <CardHeader>
                <CardTitle>Why this candidate scored {formatScore(analysis.overall_score)}</CardTitle>
                <CardDescription>Generated deterministically from the extracted evidence below.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-[13px]">
                <p className="font-medium text-foreground">{analysis.explanation.headline}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ExplanationList title="Strengths" items={analysis.explanation.strengths} tone="success" />
                  <ExplanationList title="Gaps" items={analysis.explanation.gaps} tone="warning" />
                </div>
                {analysis.explanation.notes.length ? (
                  <div className="rounded-md border border-border bg-muted/40 p-2.5">
                    <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
                    <ul className="space-y-1 text-2xs leading-relaxed text-muted-foreground">
                      {analysis.explanation.notes.map((note) => (
                        <li key={note}>· {note}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <p className="text-2xs text-muted-foreground">{analysis.explanation.disclaimer}</p>
              </CardContent>
            </Card>
          ) : (
            <EmptyState
              icon={<Info className="size-5" />}
              title="No analysis for this candidate yet"
              description="Run the screening analysis to score this candidate."
              compact
            />
          )}

          {analysis ? (
            <Card>
              <CardHeader>
                <CardTitle>Relevant experience</CardTitle>
                <CardDescription>
                  Each role's months are weighted by how much of it overlaps the job requirements.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {analysis.components.experience.roles.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">No employment history could be extracted.</p>
                ) : (
                  analysis.components.experience.roles.map((role, index) => (
                    <div key={`${role.title}-${index}`} className="rounded-md border border-border bg-surface p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-[13px] font-medium">
                            {role.title ?? "Role"}{" "}
                            {role.company ? <span className="text-muted-foreground">· {role.company}</span> : null}
                          </p>
                          <p className="text-2xs text-muted-foreground">
                            {role.start ?? "unknown"} → {role.end ?? "unknown"} · {role.months} months
                            {role.dates_confident ? "" : " (dates uncertain)"}
                          </p>
                        </div>
                        <Badge
                          tone={
                            role.relevance === "high"
                              ? "success"
                              : role.relevance === "partial"
                                ? "warning"
                                : "outline"
                          }
                        >
                          {role.relevance} relevance · {Math.round(role.relevance_factor * 100)}%
                        </Badge>
                      </div>
                      {role.matched_required_skills.length ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {role.matched_required_skills.map((skill) => (
                            <SkillTag key={skill} skill={skill} state="exact" />
                          ))}
                        </div>
                      ) : null}
                      {role.description ? (
                        <p className="mt-1.5 line-clamp-3 text-2xs leading-relaxed text-muted-foreground">
                          {role.description}
                        </p>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ) : null}

          {profile.projects?.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Project evidence</CardTitle>
                <CardDescription>Projects contribute to the semantic component.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {profile.projects.map((project) => (
                  <div key={project.name} className="rounded-md border border-border bg-surface p-2.5">
                    <p className="text-[13px] font-medium">{project.name}</p>
                    {project.description && project.description !== project.name ? (
                      <p className="mt-0.5 text-2xs leading-relaxed text-muted-foreground">
                        {project.description.startsWith(project.name)
                          ? project.description.slice(project.name.length).replace(/^[\s\-:]+/, "")
                          : project.description}
                      </p>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          {analysis ? (
            <Card>
              <CardHeader>
                <CardTitle>Score breakdown</CardTitle>
                <CardDescription>
                  Effective weights after excluding unavailable components.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(["skills", "semantic", "experience", "education"] as const).map((key) => (
                  <ComponentBar
                    key={key}
                    label={COMPONENT_LABELS[key]}
                    score={
                      key === "skills"
                        ? analysis.skill_score
                        : key === "semantic"
                          ? analysis.semantic_score
                          : key === "experience"
                            ? analysis.experience_score
                            : analysis.education_score
                    }
                    weight={analysis.effective_weights[key] ?? analysis.weights[key] ?? 0}
                    available={!analysis.unavailable_components.includes(key)}
                  />
                ))}
                <div className="border-t border-border pt-2 text-2xs text-muted-foreground">
                  <p>
                    Data completeness: <span className="font-medium text-foreground">{Math.round(analysis.data_completeness)}%</span>{" "}
                    of the configured weight was scored.
                  </p>
                  {analysis.unavailable_components.length ? (
                    <p className="mt-1">
                      Not scored: {analysis.unavailable_components.join(", ")} — information was unavailable, so these
                      were excluded rather than scored as zero.
                    </p>
                  ) : null}
                </div>
                {analysis.components.semantic.available ? (
                  <div className="rounded-md border border-border bg-muted/40 p-2.5 text-2xs leading-relaxed text-muted-foreground">
                    Semantic: mean best-match cosine {analysis.components.semantic.mean_similarity?.toFixed(3)} across{" "}
                    {analysis.components.semantic.passages_compared} requirement passages ({analysis.components.semantic.method}).
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Matched skills</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <SkillGroup title="Required" matches={matchedRequired} empty="No required skills matched" />
              <SkillGroup title="Preferred" matches={matchedPreferred} empty="No preferred skills matched" />
              {related.length ? (
                <p className="rounded-md border border-warning/30 bg-warning-subtle p-2 text-2xs text-warning-foreground">
                  {related.map((match) => `${match.skill} (via ${match.related_via.join(", ")})`).join("; ")} — related
                  skills only, counted as partial credit.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Missing skills</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="label-muted mb-1">Required</p>
                <div className="flex flex-wrap gap-1">
                  {analysis?.missing_skills.required.length ? (
                    analysis.missing_skills.required.map((skill) => (
                      <SkillTag key={skill} skill={skill} state="missing" />
                    ))
                  ) : (
                    <p className="text-2xs text-muted-foreground">None — all required skills found</p>
                  )}
                </div>
              </div>
              <div>
                <p className="label-muted mb-1">Preferred</p>
                <div className="flex flex-wrap gap-1">
                  {analysis?.missing_skills.preferred.length ? (
                    analysis.missing_skills.preferred.map((skill) => (
                      <SkillTag key={skill} skill={skill} state="preferred-missing" />
                    ))
                  ) : (
                    <p className="text-2xs text-muted-foreground">None</p>
                  )}
                </div>
              </div>
              {analysis?.missing_skills.uncertain.length ? (
                <div>
                  <p className="label-muted mb-1">Uncertain (not proof of absence)</p>
                  <div className="flex flex-wrap gap-1">
                    {analysis.missing_skills.uncertain.map((skill) => (
                      <SkillTag key={skill} skill={skill} state="uncertain" />
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <GraduationCap className="size-3.5" /> Education
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[13px]">
              {profile.education?.length ? (
                profile.education.map((entry) => (
                  <div key={`${entry.degree}-${entry.institution}`}>
                    <p className="font-medium">{entry.degree}</p>
                    <p className="text-2xs text-muted-foreground">
                      {[entry.institution, entry.year].filter(Boolean).join(" · ") || "Institution not extracted"}
                      {entry.field && !entry.degree.toLowerCase().includes(entry.field.toLowerCase())
                        ? ` · ${entry.field}`
                        : ""}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-2xs text-muted-foreground">No education details extracted.</p>
              )}
              {analysis?.components.education.note ? (
                <p className="rounded-md bg-muted/50 p-2 text-2xs text-muted-foreground">
                  {analysis.components.education.note}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <Layers className="size-3.5" /> All extracted skills
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {(profile.skills ?? []).length ? (
                  profile.skills.map((skill) => <SkillTag key={skill} skill={skill} state="exact" />)
                ) : (
                  <p className="text-2xs text-muted-foreground">No skills detected.</p>
                )}
              </div>
              {profile.certifications?.length ? (
                <div className="mt-3">
                  <p className="label-muted mb-1">Certifications</p>
                  <ul className="space-y-0.5 text-2xs text-muted-foreground">
                    {profile.certifications.map((item) => (
                      <li key={item}>· {item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <Briefcase className="size-3.5" /> Resume
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <ResumeViewer candidateId={candidate.id} filename={candidate.resume_filename} text={candidate.resume_text} />
              {profile.warnings?.length ? (
                <div className="rounded-md border border-warning/30 bg-warning-subtle p-2 text-2xs text-warning-foreground">
                  <p className="mb-1 font-medium">Parser warnings</p>
                  <ul className="space-y-0.5">
                    {profile.warnings.map((warning) => (
                      <li key={warning}>· {warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {profile.extraction?.ocr_suspected ? (
                <p className="text-2xs text-warning-foreground">
                  This PDF looked like a scan — text extraction may be incomplete.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="mt-6 flex items-center gap-1.5 text-2xs text-muted-foreground">
        <Star className="size-3" /> Scores are reproducible decision support. Hiring decisions stay with you.
      </p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label-muted">{label}</p>
      <p className="mt-0.5 font-medium text-foreground">{value}</p>
    </div>
  );
}

function ExplanationList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "success" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-2.5",
        tone === "success" ? "border-success/25 bg-success-subtle/50" : "border-warning/25 bg-warning-subtle/50",
      )}
    >
      <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {items.length ? (
        <ul className="space-y-1 text-2xs leading-relaxed">
          {items.map((item) => (
            <li key={item}>· {item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-2xs text-muted-foreground">Nothing notable.</p>
      )}
    </div>
  );
}

function SkillGroup({
  title,
  matches,
  empty,
}: {
  title: string;
  matches: SkillEvidence[];
  empty: string;
}) {
  return (
    <div>
      <p className="label-muted mb-1">{title}</p>
      {matches.length ? (
        <div className="flex flex-wrap gap-1">
          {matches.map((match) => (
            <Tooltip key={match.skill}>
              <TooltipTrigger asChild>
                <span>
                  <SkillTag
                    skill={match.skill}
                    state={MATCH_STATE[match.match_type] ?? "exact"}
                    hint={`${match.match_type} match · credit ${Math.round(match.credit * 100)}%${
                      match.evidence_zones.length ? ` · evidence: ${match.evidence_zones.join(", ")}` : ""
                    }`}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {match.match_type} match · credit {Math.round(match.credit * 100)}%
                {match.evidence_zones.length ? ` · found in ${match.evidence_zones.join(", ")}` : ""}
                {match.similarity ? ` · cosine ${match.similarity.toFixed(2)}` : ""}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      ) : (
        <p className="text-2xs text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

function ResumeViewer({
  candidateId,
  filename,
  text,
}: {
  candidateId: number;
  filename: string | null;
  text: string;
}) {
  const [tab, setTab] = useState("text");
  const fileUrl = api.resumeFileUrl(candidateId);

  return (
    <Dialog>
      <div className="space-y-2">
        <p className="text-2xs text-muted-foreground">{filename ?? "No file stored"}</p>
        <div className="flex flex-wrap gap-2">
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={!text}>
              <FileText /> View extracted text
            </Button>
          </DialogTrigger>
          <Button variant="ghost" size="sm" asChild>
            <a href={fileUrl} target="_blank" rel="noreferrer">
              <Download /> Open original
            </a>
          </Button>
        </div>
      </div>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{filename ?? "Resume"}</DialogTitle>
          <DialogDescription>
            Text exactly as extracted from the file. Formatting is not preserved.
          </DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="text">Extracted text</TabsTrigger>
            <TabsTrigger value="meta">Extraction details</TabsTrigger>
          </TabsList>
          <TabsContent value="text">
            <div className="max-h-[55vh] overflow-y-auto rounded-md border border-border bg-muted/30 p-3">
              <pre className="prose-resume">{text || "No text stored."}</pre>
            </div>
          </TabsContent>
          <TabsContent value="meta">
            <div className="space-y-1 text-[13px]">
              <p>Characters: {text.length}</p>
              <p className="text-muted-foreground">
                Extracted text is shown as plain text and never rendered as HTML, so resume content cannot inject
                markup.
              </p>
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Open the original file <ExternalLink className="size-3" />
              </a>
            </div>
          </TabsContent>
        </Tabs>
        <p className="mt-2 text-2xs text-muted-foreground">
          The original file stays in the app's private upload directory and is served only through the API.
        </p>
      </DialogContent>
    </Dialog>
  );
}
