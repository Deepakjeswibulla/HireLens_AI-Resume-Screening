import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "@/components/ui/toast";
import { Dashboard } from "@/pages/Dashboard";
import { ApiError, api } from "@/lib/api";
import type { OverviewData } from "@/types";

const EMPTY_OVERVIEW: OverviewData = {
  metrics: {
    active_jobs: 0,
    total_screenings: 0,
    total_candidates: 0,
    analyzed_candidates: 0,
    average_score: null,
    strong_matches: 0,
    shortlisted: 0,
  },
  recent_screenings: [],
  top_candidates: [],
  has_data: false,
  semantic: {
    state: "ready",
    model: "sentence-transformers/all-MiniLM-L6-v2",
    method: "sentence-transformers",
    error: null,
    calibration: { low: 0.15, high: 0.58 },
    evidence_threshold: 0.28,
    requirement_weights: { required: 2, preferred: 1 },
    match_credit: {},
    max_upload_mb: 10,
    max_resumes: 60,
    accepted_types: [".pdf"],
  },
};

const POPULATED_OVERVIEW: OverviewData = {
  ...EMPTY_OVERVIEW,
  has_data: true,
  metrics: {
    active_jobs: 1,
    total_screenings: 2,
    total_candidates: 12,
    analyzed_candidates: 11,
    average_score: 63.4,
    strong_matches: 1,
    shortlisted: 3,
  },
  recent_screenings: [
    {
      id: 5,
      job_title: "Senior Backend Engineer",
      company: "Northwind Labs",
      status: "completed",
      is_demo: true,
      created_at: "2026-11-01T10:00:00Z",
      updated_at: "2026-11-01T10:05:00Z",
      analyzed_at: "2026-11-01T10:05:00Z",
      candidate_count: 12,
      analyzed_count: 11,
      failed_count: 1,
      average_score: 63.4,
      top_score: 88.2,
      strong_matches: 1,
      required_skill_count: 5,
    },
  ],
  top_candidates: [
    {
      id: 9,
      screening_id: 5,
      name: "Priya Sharma",
      job_title: "Senior Backend Engineer",
      overall_score: 88.2,
      match_label: "Strong Match",
      status: "shortlisted",
      is_demo: true,
    },
  ],
};

function renderDashboard() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <Dashboard />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("Dashboard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows an empty state with a call to action when there is no data", async () => {
    vi.spyOn(api, "overview").mockResolvedValue(EMPTY_OVERVIEW);
    renderDashboard();
    expect(await screen.findByText("No screenings yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Create your first screening/i })).toBeInTheDocument();
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
  });

  it("renders real metrics and recent activity from the API", async () => {
    vi.spyOn(api, "overview").mockResolvedValue(POPULATED_OVERVIEW);
    renderDashboard();
    expect((await screen.findAllByText("Senior Backend Engineer")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("63.4").length).toBeGreaterThan(0);
    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
    expect(screen.getByText("demo")).toBeInTheDocument();
  });

  it("surfaces an API failure with a retry action", async () => {
    vi.spyOn(api, "overview").mockRejectedValue(
      new ApiError("Cannot reach the HireLens API.", 0),
    );
    renderDashboard();
    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot reach the HireLens API.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("warns when the semantic model is not the transformer backend", async () => {
    vi.spyOn(api, "overview").mockResolvedValue({
      ...EMPTY_OVERVIEW,
      semantic: { ...EMPTY_OVERVIEW.semantic, state: "fallback", method: "tfidf-svd" },
    });
    renderDashboard();
    await waitFor(() =>
      expect(screen.getByText(/running on the tfidf-svd fallback backend/i)).toBeInTheDocument(),
    );
  });

  it("starts demo mode when Load demo data is clicked", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "overview").mockResolvedValue(EMPTY_OVERVIEW);
    const loadDemo = vi.spyOn(api, "loadDemo").mockResolvedValue({
      screening_id: 7,
      job_title: "Senior Backend Engineer (demo)",
      candidates: 12,
      message: "Demo screening created.",
    });
    renderDashboard();
    await user.click(await screen.findByRole("button", { name: /Load demo data/i }));
    expect(loadDemo).toHaveBeenCalledTimes(1);
  });
});
