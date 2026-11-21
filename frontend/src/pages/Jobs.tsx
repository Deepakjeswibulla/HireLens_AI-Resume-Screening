import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Briefcase, Plus, Sparkles, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Skeleton, TBody, TD, TH, THead, TR, Table, TableWrap } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { useFetch } from "@/hooks/useFetch";
import { formatDate, formatScore } from "@/lib/utils";
import type { ScreeningSummary } from "@/types";

const STATUS_TONE: Record<string, "muted" | "primary" | "success" | "warning" | "danger"> = {
  draft: "muted",
  uploading: "primary",
  analyzing: "warning",
  completed: "success",
  failed: "danger",
};

export function Jobs() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => api.listScreenings(), []);
  const [toDelete, setToDelete] = useState<ScreeningSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.deleteScreening(toDelete.id);
      toast.success("Screening deleted", `${toDelete.job_title} and its candidates were removed.`);
      setToDelete(null);
      reload();
    } catch (err) {
      toast.error("Could not delete screening", err instanceof Error ? err.message : undefined);
    } finally {
      setDeleting(false);
    }
  }

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

  const screenings = data ?? [];

  return (
    <div>
      <PageHeader
        title="Jobs / Screenings"
        subtitle="Every screening you have created, with its resume count and match results."
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

      {loading && !data ? (
        <Skeleton className="h-64" />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : screenings.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="size-5" />}
          title="No screenings yet"
          description="Create a screening to upload resumes and rank candidates against a job description."
          action={
            <Button asChild>
              <Link to="/screenings/new">
                <Plus /> Create a screening
              </Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="px-0 pb-0 pt-0">
            <TableWrap>
              <Table>
                <THead>
                  <tr>
                    <TH>Job title</TH>
                    <TH>Company</TH>
                    <TH>Created</TH>
                    <TH className="text-right">Resumes</TH>
                    <TH className="text-right">Analysed</TH>
                    <TH className="text-right">Avg score</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Actions</TH>
                  </tr>
                </THead>
                <TBody>
                  {screenings.map((screening) => (
                    <TR key={screening.id}>
                      <TD>
                        <Link
                          to={`/screenings/${screening.id}`}
                          className="font-medium hover:text-primary hover:underline"
                        >
                          {screening.job_title}
                        </Link>
                        {screening.is_demo ? (
                          <Badge tone="outline" className="ml-1.5">
                            demo
                          </Badge>
                        ) : null}
                        {screening.required_skill_count ? (
                          <p className="text-2xs text-muted-foreground">
                            {screening.required_skill_count} required skills
                          </p>
                        ) : null}
                      </TD>
                      <TD className="text-muted-foreground">{screening.company ?? "—"}</TD>
                      <TD className="whitespace-nowrap text-muted-foreground">{formatDate(screening.created_at)}</TD>
                      <TD className="text-right tabular-nums">{screening.candidate_count}</TD>
                      <TD className="text-right tabular-nums">
                        {screening.analyzed_count}
                        {screening.failed_count ? (
                          <span className="ml-1 text-2xs text-destructive">({screening.failed_count} failed)</span>
                        ) : null}
                      </TD>
                      <TD className="text-right font-medium tabular-nums">{formatScore(screening.average_score)}</TD>
                      <TD>
                        <Badge tone={STATUS_TONE[screening.status] ?? "muted"}>{screening.status}</Badge>
                      </TD>
                      <TD>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/screenings/${screening.id}`}>Rankings</Link>
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/screenings/${screening.id}/analytics`}>Analytics</Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setToDelete(screening)}
                            aria-label={`Delete ${screening.job_title}`}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          </CardContent>
        </Card>
      )}

      <Dialog open={Boolean(toDelete)} onOpenChange={(open) => (!open ? setToDelete(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this screening?</DialogTitle>
            <DialogDescription>
              {toDelete
                ? `"${toDelete.job_title}" and its ${toDelete.candidate_count} candidate(s), stored files and analyses will be permanently removed. This cannot be undone.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} loading={deleting}>
              <Trash2 /> Delete screening
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
