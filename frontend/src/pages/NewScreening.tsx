import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  FileUp,
  Loader2,
  Play,
  Sparkles,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Label, Textarea, FieldError } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { FileDropzone, validateFileClient, type UploadItem } from "@/components/upload/FileDropzone";
import { RequirementEditor } from "@/components/screening/RequirementEditor";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { JobRequirements, ScreeningDetail } from "@/types";

const jobSchema = z.object({
  job_title: z.string().min(2, "Give the role a title.").max(200),
  company: z.string().max(200).optional(),
  job_description: z.string().min(20, "Paste at least a short job description."),
});

type JobForm = z.infer<typeof jobSchema>;

const STEPS = [
  { id: 1, label: "Job description" },
  { id: 2, label: "Resume upload" },
  { id: 3, label: "Review & analyze" },
];

export function NewScreening() {
  const navigate = useNavigate();
  const toast = useToast();
  const jdFileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [requirements, setRequirements] = useState<JobRequirements | null>(null);
  const [screening, setScreening] = useState<ScreeningDetail | null>(null);
  const [analyzingJd, setAnalyzingJd] = useState(false);
  const [jdWarnings, setJdWarnings] = useState<string[]>([]);
  const [readingFile, setReadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [stepError, setStepError] = useState<string | null>(null);
  const [maxMb] = useState(10);

  const form = useForm<JobForm>({
    resolver: zodResolver(jobSchema),
    defaultValues: { job_title: "", company: "", job_description: "" },
    mode: "onTouched",
  });

  const description = form.watch("job_description");
  const uploadedCount = items.filter((item) => item.status === "uploaded").length;
  const failedItems = items.filter((item) => item.status === "failed");

  const canContinueStep1 = useMemo(() => Boolean(requirements), [requirements]);

  async function handleAnalyzeJd() {
    const valid = await form.trigger(["job_description", "job_title"]);
    if (!valid) return;
    setAnalyzingJd(true);
    setStepError(null);
    try {
      const result = await api.analyzeJd(form.getValues("job_description"), form.getValues("job_title"));
      setRequirements({ ...result.requirements });
      setJdWarnings(result.warnings);
      toast.success("Job description analysed", `${result.requirements.required_skills.length} required and ${result.requirements.preferred_skills.length} preferred skills extracted.`);
    } catch (error) {
      setStepError(error instanceof Error ? error.message : "The job description could not be analysed.");
    } finally {
      setAnalyzingJd(false);
    }
  }

  async function handleJdFile(file: File | undefined) {
    if (!file) return;
    setReadingFile(true);
    setStepError(null);
    try {
      const result = await api.extractJdText(file);
      form.setValue("job_description", result.text, { shouldValidate: true });
      if (!form.getValues("job_title")) {
        const firstLine = result.text.split("\n")[0]?.trim();
        if (firstLine && firstLine.length < 80) form.setValue("job_title", firstLine);
      }
      toast.success("Job description file read", result.warnings[0]);
    } catch (error) {
      setStepError(error instanceof Error ? error.message : "That file could not be read.");
    } finally {
      setReadingFile(false);
    }
  }

  async function goToStep2() {
    if (!requirements) {
      setStepError("Analyse the job description before continuing.");
      return;
    }
    const valid = await form.trigger();
    if (!valid) return;
    if (requirements.required_skills.length === 0 && requirements.preferred_skills.length === 0) {
      setStepError("Add at least one required or preferred skill so candidates can be scored.");
      return;
    }

    setSaving(true);
    setStepError(null);
    const values = form.getValues();
    const payload = {
      job_title: values.job_title.trim(),
      company: values.company?.trim() || null,
      job_description: values.job_description,
      requirements: { ...requirements, raw_text: values.job_description },
    };
    try {
      const saved = screening
        ? await api.updateScreening(screening.id, payload)
        : await api.createScreening(payload);
      setScreening(saved);
      setStep(2);
    } catch (error) {
      setStepError(error instanceof Error ? error.message : "The screening could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function addFiles(files: File[]) {
    setStepError(null);
    setItems((current) => {
      const next = [...current];
      for (const file of files) {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (next.some((item) => item.key === key)) {
          continue;
        }
        const error = validateFileClient(file, maxMb);
        if (next.length >= 60) {
          toast.error("Too many files", "A screening can hold at most 60 resumes.");
          break;
        }
        next.push({ key, file, status: error ? "failed" : "pending", error: error ?? undefined });
      }
      return next;
    });
  }

  function removeFile(key: string) {
    setItems((current) => current.filter((item) => item.key !== key));
  }

  async function uploadFiles() {
    if (!screening) return;
    setUploading(true);
    setStepError(null);

    const alreadyUploaded = items.filter((item) => item.status === "uploaded").length;
    let succeeded = 0;
    let failures = 0;

    for (const item of items) {
      if (item.status === "uploaded") continue;
      // Files that already failed client-side validation are not sent.
      if (item.status === "failed" && item.error) {
        failures += 1;
        continue;
      }
      setItems((current) =>
        current.map((entry) => (entry.key === item.key ? { ...entry, status: "uploading", error: undefined } : entry)),
      );
      try {
        const result = await api.uploadResumes(screening.id, [item.file]);
        if (result.rejected.length) {
          failures += 1;
          setItems((current) =>
            current.map((entry) =>
              entry.key === item.key ? { ...entry, status: "failed", error: result.rejected[0].reason } : entry,
            ),
          );
        } else if (result.duplicates.length) {
          failures += 1;
          setItems((current) =>
            current.map((entry) =>
              entry.key === item.key
                ? { ...entry, status: "failed", error: "Already uploaded to this screening." }
                : entry,
            ),
          );
        } else {
          succeeded += 1;
          setItems((current) =>
            current.map((entry) => (entry.key === item.key ? { ...entry, status: "uploaded" } : entry)),
          );
        }
      } catch (error) {
        failures += 1;
        setItems((current) =>
          current.map((entry) =>
            entry.key === item.key
              ? {
                  ...entry,
                  status: "failed",
                  error: error instanceof Error ? error.message : "Upload failed.",
                }
              : entry,
          ),
        );
      }
    }

    setUploading(false);
    if (succeeded + alreadyUploaded === 0) {
      setStepError("No resumes were uploaded. Fix the file errors and try again.");
      return;
    }
    setStep(3);
    if (failures) {
      toast.error(`${failures} file(s) could not be uploaded`, "They will be skipped; you can also remove them.");
    } else {
      toast.success("Resumes uploaded", `${succeeded + alreadyUploaded} file(s) ready for analysis.`);
    }
  }

  async function startAnalysis() {
    if (!screening) return;
    setStarting(true);
    setStepError(null);
    try {
      await api.startAnalysis(screening.id);
      toast.info("Analysis started", "Scoring resumes against the extracted requirements.");
      navigate(`/screenings/${screening.id}/processing`);
    } catch (error) {
      setStepError(error instanceof Error ? error.message : "Analysis could not be started.");
      setStarting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="New screening"
        subtitle="Paste a job description, upload resumes, and let HireLens rank candidates with evidence you can inspect."
      />

      <ol className="mb-6 flex flex-wrap items-center gap-2 text-[13px]">
        {STEPS.map((entry, index) => {
          const active = step === entry.id;
          const done = step > entry.id;
          return (
            <li key={entry.id} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-2xs font-semibold",
                  active ? "bg-primary text-primary-foreground" : done ? "bg-success text-white" : "bg-muted text-muted-foreground",
                )}
                aria-hidden
              >
                {done ? <Check className="size-3" /> : entry.id}
              </span>
              <span className={cn(active ? "font-medium text-foreground" : "text-muted-foreground")}>
                {entry.label}
              </span>
              {index < STEPS.length - 1 ? <ArrowRight className="size-3 text-border" aria-hidden /> : null}
            </li>
          );
        })}
      </ol>

      {stepError ? <ErrorState message={stepError} className="mb-4" /> : null}

      {step === 1 ? (
        <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Job details</CardTitle>
              <CardDescription>
                Paste the description or upload a PDF/DOCX. Extraction is rule-based and fully editable.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="job_title">Job title</Label>
                <Input id="job_title" className="mt-1" placeholder="Senior Backend Engineer" {...form.register("job_title")} />
                <FieldError>{form.formState.errors.job_title?.message}</FieldError>
              </div>
              <div>
                <Label htmlFor="company">Company (optional)</Label>
                <Input id="company" className="mt-1" placeholder="Northwind Labs" {...form.register("company")} />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="job_description">Job description</Label>
                  <span className="text-2xs text-muted-foreground">{description.length} characters</span>
                </div>
                <Textarea
                  id="job_description"
                  className="mt-1 min-h-[220px] text-[13px]"
                  placeholder="Paste the full job description here…"
                  {...form.register("job_description")}
                />
                <FieldError>{form.formState.errors.job_description?.message}</FieldError>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => jdFileRef.current?.click()}
                  loading={readingFile}
                >
                  <FileUp /> Upload JD file
                </Button>
                <input
                  ref={jdFileRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  className="hidden"
                  onChange={(event) => {
                    handleJdFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={() => {
                    form.setValue("job_description", "");
                    setRequirements(null);
                    setJdWarnings([]);
                  }}
                >
                  <Trash2 /> Clear
                </Button>
                <Button className="ml-auto" onClick={handleAnalyzeJd} loading={analyzingJd} type="button">
                  <Sparkles /> Analyse job description
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {requirements ? (
              <Card>
                <CardHeader>
                  <CardTitle>Extracted requirements</CardTitle>
                  <CardDescription>
                    Correct anything the extractor got wrong — these requirements drive the scoring.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {jdWarnings.length ? (
                    <div className="mb-3 space-y-1 rounded-md border border-warning/30 bg-warning-subtle p-2.5 text-2xs text-warning-foreground">
                      {jdWarnings.map((warning) => (
                        <p key={warning} className="flex items-start gap-1.5">
                          <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                          {warning}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  <RequirementEditor value={requirements} onChange={setRequirements} />
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <p className="text-2xs text-muted-foreground">
                      {requirements.required_skills.length} required · {requirements.preferred_skills.length} preferred
                    </p>
                    <Button onClick={goToStep2} loading={saving} disabled={!canContinueStep1}>
                      Continue to resumes <ArrowRight />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>What happens next</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-[13px] text-muted-foreground">
                  <p className="flex gap-2">
                    <span className="font-mono text-2xs">01</span> HireLens extracts required and preferred skills,
                    responsibilities, minimum experience and education asks from the text.
                  </p>
                  <p className="flex gap-2">
                    <span className="font-mono text-2xs">02</span> You review and edit those requirements — extraction
                    is a draft, not a verdict.
                  </p>
                  <p className="flex gap-2">
                    <span className="font-mono text-2xs">03</span> Upload resumes; each one is parsed, matched and scored
                    0–100 with a written explanation.
                  </p>
                  {analyzingJd ? (
                    <p className="flex items-center gap-2 pt-2 text-2xs text-primary">
                      <Loader2 className="size-3 animate-spin" /> Extracting requirements…
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <Card>
          <CardHeader>
            <CardTitle>Upload resumes</CardTitle>
            <CardDescription>
              Upload ten or more at once. Files are validated locally and stored privately; nothing is analysed until
              you confirm.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FileDropzone
              items={items}
              onAdd={addFiles}
              onRemove={removeFile}
              maxMb={maxMb}
              maxFiles={60}
              disabled={uploading}
            />

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <Button variant="ghost" onClick={() => setStep(1)} disabled={uploading}>
                <ArrowLeft /> Back
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-2xs text-muted-foreground">
                  {uploadedCount ? `${uploadedCount} uploaded · ` : ""}
                  {items.length - uploadedCount} pending
                </span>
                <Button onClick={uploadFiles} loading={uploading} disabled={items.length === 0}>
                  Upload {items.length - uploadedCount || ""} file{items.length - uploadedCount === 1 ? "" : "s"}
                  <ArrowRight />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 && screening ? (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Review before analysis</CardTitle>
              <CardDescription>Check that the requirements and resumes are what you expect.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-[13px]">
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="label-muted">Job title</dt>
                  <dd className="mt-0.5 font-medium">{screening.job_title}</dd>
                </div>
                <div>
                  <dt className="label-muted">Company</dt>
                  <dd className="mt-0.5">{screening.company ?? "—"}</dd>
                </div>
                <div>
                  <dt className="label-muted">Resumes uploaded</dt>
                  <dd className="mt-0.5 font-medium">{uploadedCount || items.length}</dd>
                </div>
                <div>
                  <dt className="label-muted">Minimum experience</dt>
                  <dd className="mt-0.5">
                    {screening.requirements.minimum_experience
                      ? `${screening.requirements.minimum_experience} years`
                      : "Not specified"}
                  </dd>
                </div>
              </dl>

              <div>
                <p className="label-muted">Required skills</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {screening.requirements.required_skills.length ? (
                    screening.requirements.required_skills.map((skill) => (
                      <Badge key={skill} tone="success">
                        {skill}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-2xs text-muted-foreground">None</p>
                  )}
                </div>
              </div>
              <div>
                <p className="label-muted">Preferred skills</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {screening.requirements.preferred_skills.length ? (
                    screening.requirements.preferred_skills.map((skill) => (
                      <Badge key={skill} tone="neutral">
                        {skill}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-2xs text-muted-foreground">None</p>
                  )}
                </div>
              </div>
              <div>
                <p className="label-muted">Education</p>
                <p className="mt-1 text-[13px]">
                  {screening.requirements.education_requirements.join(" · ") || "No requirement — not scored"}
                </p>
              </div>

              {failedItems.length ? (
                <div className="rounded-md border border-warning/30 bg-warning-subtle p-2.5 text-2xs text-warning-foreground">
                  {failedItems.length} file(s) failed to upload and will be skipped:{" "}
                  {failedItems.map((item) => item.file.name).join(", ")}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Run the analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-[13px] text-muted-foreground">
              <p>
                Each resume is parsed into a profile, matched against these requirements (skills, semantics,
                experience, education) and scored 0–100. You can review every component and the evidence behind it.
              </p>
              <p className="text-2xs">
                Analysis runs in the background with live stage progress. Nothing is auto-rejected; you stay in control
                of every decision.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button variant="ghost" onClick={() => setStep(2)} disabled={starting}>
                  <ArrowLeft /> Back
                </Button>
                <Button onClick={startAnalysis} loading={starting} className="flex-1">
                  <Play /> Analyse candidates
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
