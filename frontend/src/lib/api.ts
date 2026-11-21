/**
 * API service layer. Every backend call in the app goes through this module so
 * that the base URL, error shape and JSON handling live in one place.
 */

import type {
  AnalyzeJdResponse,
  AnalyticsData,
  CandidateDetail,
  CandidateListItem,
  CandidateStatus,
  ComparisonResponse,
  JobRequirements,
  OverviewData,
  ProgressResponse,
  ScoreConfig,
  ScreeningDetail,
  ScreeningSummary,
  UploadResult,
} from "@/types";

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

export class ApiError extends Error {
  status: number;
  details?: { field: string; message: string }[];

  constructor(message: string, status: number, details?: { field: string; message: string }[]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function parseError(response: Response): Promise<never> {
  let message = `Request failed (${response.status}).`;
  let details: { field: string; message: string }[] | undefined;
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") message = body.detail;
    if (Array.isArray(body?.errors)) details = body.errors;
  } catch {
    if (response.status === 0) message = "Cannot reach the HireLens API. Is the backend running?";
  }
  if (response.status === 502 || response.status === 503) {
    message = "The HireLens API is unavailable. Start the backend and try again.";
  }
  throw new ApiError(message, response.status, details);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: init?.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    throw new ApiError("Cannot reach the HireLens API. Check that the backend is running.", 0);
  }
  if (!response.ok) await parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  // ---- meta -------------------------------------------------------------
  health: () => request<{ status: string; version: string }>("/health"),
  config: () => request<ScoreConfig>("/meta/config"),
  semanticStatus: () => request<ScoreConfig["semantic"]>("/meta/semantic-status"),
  overview: () => request<OverviewData>("/overview"),

  // ---- jobs -------------------------------------------------------------
  analyzeJd: (jobDescription: string, jobTitle?: string) =>
    request<AnalyzeJdResponse>("/jobs/analyze-jd", {
      method: "POST",
      body: JSON.stringify({ job_description: jobDescription, job_title: jobTitle || null }),
    }),

  extractJdText: (file: File) => {
    const form = new FormData();
    form.append("file", file, file.name);
    return request<{ filename: string; text: string; char_count: number | null; warnings: string[] }>(
      "/jobs/extract-jd-text",
      { method: "POST", body: form },
    );
  },

  createScreening: (payload: {
    job_title: string;
    company?: string | null;
    job_description: string;
    requirements: JobRequirements;
  }) =>
    request<ScreeningDetail>("/jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateScreening: (
    id: number,
    payload: { job_title: string; company?: string | null; job_description: string; requirements: JobRequirements },
  ) =>
    request<ScreeningDetail>(`/jobs/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  listScreenings: (includeDemo = true) =>
    request<ScreeningSummary[]>(`/jobs?include_demo=${includeDemo ? "true" : "false"}`),

  getScreening: (id: number) => request<ScreeningDetail>(`/jobs/${id}`),

  deleteScreening: (id: number) => request<void>(`/jobs/${id}`, { method: "DELETE" }),

  uploadResumes: (id: number, files: File[]) => {
    const form = new FormData();
    files.forEach((file) => form.append("files", file, file.name));
    return request<UploadResult>(`/jobs/${id}/resumes`, { method: "POST", body: form });
  },

  startAnalysis: (id: number) =>
    request<{ screening_id: number; status: string; total_candidates: number; message: string }>(
      `/jobs/${id}/analyze`,
      { method: "POST" },
    ),

  progress: (id: number) => request<ProgressResponse>(`/jobs/${id}/progress`),

  candidates: (id: number) => request<CandidateListItem[]>(`/jobs/${id}/candidates`),

  analytics: (id: number) => request<AnalyticsData>(`/jobs/${id}/analytics`),

  exportCsv: async (id: number): Promise<Blob> => {
    const response = await fetch(`${BASE_URL}/jobs/${id}/export`);
    if (!response.ok) await parseError(response);
    return response.blob();
  },

  // ---- candidates -------------------------------------------------------
  candidate: (id: number) => request<CandidateDetail>(`/candidates/${id}`),

  updateStatus: (id: number, status: CandidateStatus) =>
    request<CandidateDetail>(`/candidates/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  compare: (ids: number[]) =>
    request<ComparisonResponse>(`/candidates/compare?${ids.map((id) => `ids=${id}`).join("&")}`, {
      method: "POST",
    }),

  resumeText: (id: number) =>
    request<{ candidate_id: number; filename: string; text: string }>(
      `/candidates/${id}/resume-text`,
    ),

  resumeFileUrl: (id: number) => `${BASE_URL}/candidates/${id}/resume`,

  // ---- demo -------------------------------------------------------------
  loadDemo: () =>
    request<{ screening_id: number; job_title: string; candidates: number; message: string }>(
      "/demo/load",
      { method: "POST" },
    ),
};
