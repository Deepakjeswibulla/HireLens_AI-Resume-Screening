import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastProvider } from "@/components/ui/toast";
import { CandidateTable } from "@/components/candidate/CandidateTable";
import type { CandidateListItem } from "@/types";

function candidate(overrides: Partial<CandidateListItem>): CandidateListItem {
  return {
    id: 1,
    screening_id: 1,
    name: "Candidate One",
    email: "one@example.com",
    resume_filename: "one.pdf",
    parse_status: "parsed",
    parse_error: null,
    status: "new",
    overall_score: 80,
    match_label: "Good Match",
    rank: 1,
    skill_score: 80,
    semantic_score: 70,
    experience_score: 90,
    education_score: 100,
    total_experience_years: 5,
    relevant_experience_years: 4,
    matched_skill_count: 2,
    required_matched: ["Python", "FastAPI"],
    required_missing: ["PostgreSQL"],
    data_completeness: 100,
    ...overrides,
  };
}

const CANDIDATES: CandidateListItem[] = [
  candidate({ id: 1, name: "Priya Sharma", rank: 1, overall_score: 88, match_label: "Strong Match" }),
  candidate({
    id: 2,
    name: "Rahul Verma",
    rank: 2,
    overall_score: 62,
    match_label: "Partial Match",
    required_matched: ["Python"],
    required_missing: ["FastAPI", "PostgreSQL"],
    status: "reviewing",
  }),
  candidate({
    id: 3,
    name: "Arjun Pillai",
    rank: 3,
    overall_score: 41,
    match_label: "Low Match",
    required_matched: [],
    required_missing: ["Python", "FastAPI", "PostgreSQL"],
  }),
];

function renderTable(selected: number[] = [], onSelectedChange = vi.fn()) {
  render(
    <MemoryRouter>
      <ToastProvider>
        <TooltipProvider>
          <CandidateTable
            candidates={CANDIDATES}
            requiredSkills={["Python", "FastAPI", "PostgreSQL"]}
            selected={selected}
            onSelectedChange={onSelectedChange}
            onStatusChange={vi.fn()}
          />
        </TooltipProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
  return { onSelectedChange };
}

describe("CandidateTable", () => {
  it("renders every candidate with rank and score", () => {
    renderTable();
    expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
    expect(screen.getByText("Rahul Verma")).toBeInTheDocument();
    expect(screen.getByText("Arjun Pillai")).toBeInTheDocument();
    expect(screen.getByText("88.0")).toBeInTheDocument();
    expect(screen.getByText("3 of 3 candidates")).toBeInTheDocument();
  });

  it("filters candidates by the search box", async () => {
    const user = userEvent.setup();
    renderTable();
    await user.type(screen.getByLabelText("Search candidates"), "rahul");
    expect(screen.getByText("Rahul Verma")).toBeInTheDocument();
    expect(screen.queryByText("Priya Sharma")).not.toBeInTheDocument();
    expect(screen.getByText("1 of 3 candidates")).toBeInTheDocument();
  });

  it("shows an empty state when nothing matches and can reset", async () => {
    const user = userEvent.setup();
    renderTable();
    await user.type(screen.getByLabelText("Search candidates"), "zzz");
    expect(screen.getByText("No candidates match these filters")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
  });

  it("selects candidates for comparison", async () => {
    const user = userEvent.setup();
    const { onSelectedChange } = renderTable();
    await user.click(screen.getByLabelText("Select Priya Sharma for comparison"));
    expect(onSelectedChange).toHaveBeenCalledWith([1]);
  });

  it("disables further selection once four candidates are chosen", () => {
    renderTable([1, 2, 4, 5]);
    const checkbox = screen.getByLabelText("Select Arjun Pillai for comparison");
    expect(checkbox).toBeDisabled();
  });

  it("shows missing required skills per candidate", () => {
    renderTable();
    const row = screen.getByText("Arjun Pillai").closest("tr");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText("Python")).toBeInTheDocument();
  });
});
