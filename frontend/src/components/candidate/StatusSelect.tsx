import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import type { CandidateStatus } from "@/types";
import { titleCase } from "@/lib/utils";

export const CANDIDATE_STATUSES: CandidateStatus[] = [
  "new",
  "reviewing",
  "shortlisted",
  "interview",
  "rejected",
];

export function StatusSelect({
  candidateId,
  value,
  onChange,
  className,
}: {
  candidateId: number;
  value: CandidateStatus;
  onChange: (status: CandidateStatus) => void;
  className?: string;
}) {
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function handleChange(next: string) {
    if (next === value) return;
    setSaving(true);
    try {
      const updated = await api.updateStatus(candidateId, next as CandidateStatus);
      onChange(updated.status);
      toast.success("Status updated", `Candidate moved to ${titleCase(updated.status)}.`);
    } catch (error) {
      toast.error("Could not update status", error instanceof Error ? error.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={className}>
      <Select value={value} onValueChange={handleChange} disabled={saving}>
        <SelectTrigger className="h-7 w-[130px] text-2xs" aria-label="Recruiter status">
          {saving ? <Loader2 className="size-3 animate-spin" /> : <SelectValue />}
        </SelectTrigger>
        <SelectContent>
          {CANDIDATE_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {titleCase(status)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
