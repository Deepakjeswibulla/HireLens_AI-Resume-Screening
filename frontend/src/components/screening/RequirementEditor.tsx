import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { JobRequirements } from "@/types";

interface RequirementEditorProps {
  value: JobRequirements;
  onChange: (value: JobRequirements) => void;
}

/**
 * Extracted requirements are a draft, not the truth: everything here is
 * editable, and skills can be moved between required and preferred.
 */
export function RequirementEditor({ value, onChange }: RequirementEditorProps) {
  const [newSkill, setNewSkill] = useState("");
  const [newKind, setNewKind] = useState<"required" | "preferred">("required");
  const [newEducation, setNewEducation] = useState("");

  function update(patch: Partial<JobRequirements>) {
    onChange({ ...value, ...patch });
  }

  function addSkill() {
    const skill = newSkill.trim();
    if (!skill) return;
    const exists =
      value.required_skills.some((s) => s.toLowerCase() === skill.toLowerCase()) ||
      value.preferred_skills.some((s) => s.toLowerCase() === skill.toLowerCase());
    if (exists) {
      setNewSkill("");
      return;
    }
    if (newKind === "required") {
      update({ required_skills: [...value.required_skills, skill] });
    } else {
      update({ preferred_skills: [...value.preferred_skills, skill] });
    }
    setNewSkill("");
  }

  function removeSkill(skill: string, kind: "required" | "preferred") {
    if (kind === "required") {
      update({ required_skills: value.required_skills.filter((s) => s !== skill) });
    } else {
      update({ preferred_skills: value.preferred_skills.filter((s) => s !== skill) });
    }
  }

  function toggleSkillKind(skill: string, kind: "required" | "preferred") {
    if (kind === "required") {
      update({
        required_skills: value.required_skills.filter((s) => s !== skill),
        preferred_skills: [...value.preferred_skills, skill],
      });
    } else {
      update({
        preferred_skills: value.preferred_skills.filter((s) => s !== skill),
        required_skills: [...value.required_skills, skill],
      });
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <Label>Skills</Label>
          <p className="text-2xs text-muted-foreground">Click a skill to move it between required and preferred.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {(["required", "preferred"] as const).map((kind) => {
            const skills = kind === "required" ? value.required_skills : value.preferred_skills;
            return (
              <div key={kind} className="rounded-md border border-border bg-surface p-2.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {kind} · {skills.length}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {skills.length === 0 ? (
                    <p className="text-2xs text-muted-foreground">None</p>
                  ) : (
                    skills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-2xs font-medium"
                      >
                        <button
                          type="button"
                          onClick={() => toggleSkillKind(skill, kind)}
                          className="hover:text-primary hover:underline"
                          title={`Move to ${kind === "required" ? "preferred" : "required"}`}
                        >
                          {skill}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSkill(skill, kind)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Remove ${skill}`}
                        >
                          <X className="size-2.5" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input
            value={newSkill}
            onChange={(event) => setNewSkill(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addSkill();
              }
            }}
            placeholder="Add a skill (e.g. PostgreSQL)"
            className="h-8 max-w-xs text-[13px]"
            aria-label="Add a skill"
          />
          <div className="inline-flex rounded-md border border-border p-0.5">
            {(["required", "preferred"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setNewKind(kind)}
                className={`rounded px-2 py-1 text-2xs font-medium capitalize ${
                  newKind === kind ? "bg-primary-subtle text-accent-foreground" : "text-muted-foreground"
                }`}
              >
                {kind}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={addSkill} type="button">
            <Plus /> Add
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="min-experience">Minimum experience (years)</Label>
          <Input
            id="min-experience"
            type="number"
            min={0}
            max={40}
            step={0.5}
            className="mt-1 h-8 max-w-[140px]"
            value={value.minimum_experience ?? ""}
            placeholder="Not specified"
            onChange={(event) => {
              const raw = event.target.value;
              update({ minimum_experience: raw === "" ? null : Number(raw) });
            }}
          />
          <p className="mt-1 text-2xs text-muted-foreground">
            Leave empty if the job description does not state a requirement.
          </p>
        </div>

        <div>
          <Label>Education requirements</Label>
          <div className="mt-1 flex flex-wrap gap-1">
            {value.education_requirements.length === 0 ? (
              <p className="text-2xs text-muted-foreground">None detected</p>
            ) : (
              value.education_requirements.map((item) => (
                <Badge key={item} tone="neutral" className="gap-1">
                  {item}
                  <button
                    type="button"
                    onClick={() =>
                      update({
                        education_requirements: value.education_requirements.filter((entry) => entry !== item),
                      })
                    }
                    aria-label={`Remove ${item}`}
                  >
                    <X className="size-2.5" />
                  </button>
                </Badge>
              ))
            )}
          </div>
          <div className="mt-1.5 flex gap-2">
            <Input
              value={newEducation}
              onChange={(event) => setNewEducation(event.target.value)}
              placeholder="e.g. Bachelor's degree in Computer Science"
              className="h-8 text-[13px]"
              aria-label="Add an education requirement"
            />
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                const item = newEducation.trim();
                if (!item) return;
                update({ education_requirements: [...value.education_requirements, item] });
                setNewEducation("");
              }}
            >
              <Plus />
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="responsibilities">
        <TabsList>
          <TabsTrigger value="responsibilities">
            Responsibilities ({value.responsibilities.length})
          </TabsTrigger>
          <TabsTrigger value="domains">Domains ({value.domain_requirements.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="responsibilities">
          <ul className="space-y-1">
            {value.responsibilities.length === 0 ? (
              <li className="text-2xs text-muted-foreground">
                No responsibilities were extracted. Semantic matching will rely on skills only.
              </li>
            ) : (
              value.responsibilities.map((item, index) => (
                <li
                  key={`${item}-${index}`}
                  className="flex items-start gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px]"
                >
                  <span className="mt-1 size-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
                  <span className="flex-1 leading-relaxed">{item}</span>
                  <button
                    type="button"
                    onClick={() =>
                      update({ responsibilities: value.responsibilities.filter((_, i) => i !== index) })
                    }
                    className="mt-0.5 text-muted-foreground hover:text-destructive"
                    aria-label="Remove responsibility"
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))
            )}
          </ul>
        </TabsContent>
        <TabsContent value="domains">
          <div className="flex flex-wrap gap-1">
            {value.domain_requirements.length === 0 ? (
              <p className="text-2xs text-muted-foreground">No industry/domain requirements detected.</p>
            ) : (
              value.domain_requirements.map((domain) => (
                <Badge key={domain} tone="primary" className="gap-1">
                  {domain}
                  <button
                    type="button"
                    onClick={() =>
                      update({ domain_requirements: value.domain_requirements.filter((d) => d !== domain) })
                    }
                    aria-label={`Remove ${domain}`}
                  >
                    <X className="size-2.5" />
                  </button>
                </Badge>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
