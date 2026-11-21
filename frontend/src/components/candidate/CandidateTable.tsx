import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, ChevronLeft, ChevronRight, Filter, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/toggles";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TBody, TD, TH, THead, TR, Table, TableWrap } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { ScorePill } from "./ScorePill";
import { SkillTags } from "./SkillTag";
import { StatusSelect } from "./StatusSelect";
import { formatYears, titleCase } from "@/lib/utils";
import type { CandidateListItem, CandidateStatus } from "@/types";

interface CandidateTableProps {
  candidates: CandidateListItem[];
  requiredSkills: string[];
  selected: number[];
  onSelectedChange: (ids: number[]) => void;
  onStatusChange: (id: number, status: CandidateStatus) => void;
  maxSelection?: number;
}

const ALL = "__all__";

export function CandidateTable({
  candidates,
  requiredSkills,
  selected,
  onSelectedChange,
  onStatusChange,
  maxSelection = 4,
}: CandidateTableProps) {
  const [search, setSearch] = useState("");
  const [labelFilter, setLabelFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [missingFilter, setMissingFilter] = useState(ALL);
  const [hasSkillFilter, setHasSkillFilter] = useState(ALL);
  const [experienceFilter, setExperienceFilter] = useState(ALL);
  const [scoreFilter, setScoreFilter] = useState(ALL);
  const [showFilters, setShowFilters] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([{ id: "rank", desc: false }]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return candidates.filter((candidate) => {
      if (term) {
        const haystack = `${candidate.name ?? ""} ${candidate.email ?? ""} ${candidate.resume_filename ?? ""} ${candidate.required_matched.join(" ")}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (labelFilter !== ALL && candidate.match_label !== labelFilter) return false;
      if (statusFilter !== ALL && candidate.status !== statusFilter) return false;
      if (missingFilter !== ALL && !candidate.required_missing.includes(missingFilter)) return false;
      if (hasSkillFilter !== ALL && !candidate.required_matched.includes(hasSkillFilter)) return false;
      if (experienceFilter !== ALL) {
        const min = Number(experienceFilter);
        const value = candidate.relevant_experience_years;
        if (value === null || value === undefined || value < min) return false;
      }
      if (scoreFilter !== ALL) {
        const min = Number(scoreFilter);
        if ((candidate.overall_score ?? -1) < min) return false;
      }
      return true;
    });
  }, [candidates, search, labelFilter, statusFilter, missingFilter, hasSkillFilter, experienceFilter, scoreFilter]);

  const activeFilters =
    [labelFilter, statusFilter, missingFilter, hasSkillFilter, experienceFilter, scoreFilter].filter(
      (value) => value !== ALL,
    ).length + (search ? 1 : 0);

  function resetFilters() {
    setSearch("");
    setLabelFilter(ALL);
    setStatusFilter(ALL);
    setMissingFilter(ALL);
    setHasSkillFilter(ALL);
    setExperienceFilter(ALL);
    setScoreFilter(ALL);
  }

  function toggleSelection(id: number) {
    if (selected.includes(id)) {
      onSelectedChange(selected.filter((value) => value !== id));
      return;
    }
    if (selected.length >= maxSelection) return;
    onSelectedChange([...selected, id]);
  }

  const columns = useMemo<ColumnDef<CandidateListItem>[]>(
    () => [
      {
        id: "select",
        header: () => <span className="sr-only">Select for comparison</span>,
        cell: ({ row }) => {
          const disabled =
            row.original.parse_status === "failed" ||
            (!selected.includes(row.original.id) && selected.length >= maxSelection);
          return (
            <Checkbox
              checked={selected.includes(row.original.id)}
              onCheckedChange={() => toggleSelection(row.original.id)}
              disabled={disabled}
              aria-label={`Select ${row.original.name ?? "candidate"} for comparison`}
            />
          );
        },
        enableSorting: false,
        size: 36,
      },
      {
        accessorKey: "rank",
        header: "Rank",
        cell: ({ row }) => (
          <span className="font-mono text-2xs text-muted-foreground">
            {row.original.rank ?? "—"}
          </span>
        ),
        size: 56,
      },
      {
        accessorKey: "name",
        header: "Candidate",
        cell: ({ row }) => {
          const candidate = row.original;
          const failed = candidate.parse_status === "failed";
          return (
            <div className="min-w-[180px] max-w-[280px]">
              {failed ? (
                <p className="truncate text-[13px] font-medium text-muted-foreground">
                  {candidate.name ?? candidate.resume_filename ?? "Unreadable file"}
                </p>
              ) : (
                <Link
                  to={`/candidates/${candidate.id}`}
                  className="truncate text-[13px] font-medium text-foreground hover:text-primary hover:underline"
                >
                  {candidate.name ?? "Unnamed candidate"}
                </Link>
              )}
              <p className="truncate text-2xs text-muted-foreground">
                {failed ? candidate.parse_error : candidate.email ?? candidate.resume_filename ?? "—"}
              </p>
            </div>
          );
        },
      },
      {
        accessorKey: "overall_score",
        header: "Match score",
        cell: ({ row }) =>
          row.original.parse_status === "failed" ? (
            <Badge tone="danger">Parse failed</Badge>
          ) : (
            <ScorePill score={row.original.overall_score} label={row.original.match_label} />
          ),
        size: 190,
      },
      {
        accessorKey: "relevant_experience_years",
        header: "Relevant exp.",
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            <p className="text-[13px] font-medium">{formatYears(row.original.relevant_experience_years)}</p>
            <p className="text-2xs text-muted-foreground">
              {row.original.total_experience_years !== null
                ? `${formatYears(row.original.total_experience_years)} total`
                : "total unknown"}
            </p>
          </div>
        ),
        size: 130,
      },
      {
        id: "matched",
        header: "Skills matched",
        accessorFn: (row) => row.matched_skill_count,
        cell: ({ row }) => (
          <div className="min-w-[160px] max-w-[240px]">
            <p className="mb-1 text-2xs text-muted-foreground">
              {row.original.matched_skill_count}/{requiredSkills.length} required
            </p>
            <SkillTags skills={row.original.required_matched} state="exact" max={2} />
          </div>
        ),
        size: 200,
      },
      {
        id: "missing",
        header: "Missing",
        accessorFn: (row) => row.required_missing.length,
        cell: ({ row }) => (
          <div className="min-w-[140px] max-w-[220px]">
            <SkillTags skills={row.original.required_missing} state="missing" max={2} emptyLabel="None" />
          </div>
        ),
        size: 170,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusSelect
            candidateId={row.original.id}
            value={row.original.status}
            onChange={(status) => onStatusChange(row.original.id, status)}
          />
        ),
        enableSorting: false,
        size: 140,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, requiredSkills.length],
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 15 } },
  });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search candidates, emails, skills…"
            className="h-8 pl-8 text-[13px]"
            aria-label="Search candidates"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        <Button
          variant={showFilters || activeFilters ? "subtle" : "outline"}
          size="sm"
          onClick={() => setShowFilters((value) => !value)}
          aria-expanded={showFilters}
        >
          <Filter />
          Filters
          {activeFilters ? <Badge tone="primary">{activeFilters}</Badge> : null}
        </Button>
        {activeFilters ? (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Reset
          </Button>
        ) : null}
        <p className="ml-auto text-2xs text-muted-foreground">
          {filtered.length} of {candidates.length} candidates
        </p>
      </div>

      {showFilters ? (
        <div className="mb-3 grid gap-2 rounded-lg border border-border bg-surface p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <FilterSelect
            label="Match label"
            value={labelFilter}
            onChange={setLabelFilter}
            options={["Strong Match", "Good Match", "Partial Match", "Low Match"]}
          />
          <FilterSelect
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={["new", "reviewing", "shortlisted", "interview", "rejected"]}
            format={titleCase}
          />
          <FilterSelect label="Minimum score" value={scoreFilter} onChange={setScoreFilter} options={["50", "70", "85"]} format={(v) => `${v}+`} />
          <FilterSelect
            label="Has skill"
            value={hasSkillFilter}
            onChange={setHasSkillFilter}
            options={requiredSkills}
          />
          <FilterSelect
            label="Missing skill"
            value={missingFilter}
            onChange={setMissingFilter}
            options={requiredSkills}
          />
          <FilterSelect
            label="Relevant experience"
            value={experienceFilter}
            onChange={setExperienceFilter}
            options={["1", "3", "5", "8"]}
            format={(v) => `${v}+ yrs`}
          />
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="size-5" />}
          title="No candidates match these filters"
          description="Adjust or reset the filters to see more candidates."
          compact
          action={
            <Button variant="outline" size="sm" onClick={resetFilters}>
              Reset filters
            </Button>
          }
        />
      ) : (
        <>
          <TableWrap className="rounded-lg border border-border bg-card">
            <Table>
              <THead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      return (
                        <TH key={header.id} style={{ width: header.getSize() }}>
                          {canSort ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="inline-flex items-center gap-1 hover:text-foreground"
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              <ArrowUpDown className="size-2.5 opacity-50" aria-hidden />
                            </button>
                          ) : (
                            flexRender(header.column.columnDef.header, header.getContext())
                          )}
                        </TH>
                      );
                    })}
                  </tr>
                ))}
              </THead>
              <TBody>
                {table.getRowModel().rows.map((row) => (
                  <TR key={row.id} data-selected={selected.includes(row.original.id) || undefined}>
                    {row.getVisibleCells().map((cell) => (
                      <TD key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TD>
                    ))}
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>

          <p className="mt-2 text-2xs text-muted-foreground md:hidden">
            Scroll the table sideways for score, experience, skills and status.
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-2xs text-muted-foreground">
              <span>Rows per page</span>
              <Select
                value={String(table.getState().pagination.pageSize)}
                onValueChange={(value) => table.setPageSize(Number(value))}
              >
                <SelectTrigger className="h-7 w-[70px] text-2xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 15, 25, 50].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xs text-muted-foreground">
                Page {table.getState().pagination.pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                aria-label="Previous page"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                aria-label="Next page"
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  format,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  format?: (value: string) => string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-2xs font-medium text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Any</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {format ? format(option) : option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
