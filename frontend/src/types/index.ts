export type ScreeningStatus = "draft" | "uploading" | "analyzing" | "completed" | "failed";
export type CandidateStatus = "new" | "shortlisted" | "reviewing" | "interview" | "rejected";
export type ParseStatus = "pending" | "parsed" | "failed";
export type MatchType = "exact" | "alias" | "related" | "semantic" | "none";

export interface JobRequirements {
  required_skills: string[];
  preferred_skills: string[];
  responsibilities: string[];
  minimum_experience: number | null;
  education_requirements: string[];
  domain_requirements: string[];
  raw_text: string;
}

export interface AnalyzeJdResponse {
  requirements: JobRequirements;
  job_title_guess: string | null;
  detected_skills: { skill: string; in_required: boolean }[];
  warnings: string[];
}

export interface ScreeningSummary {
  id: number;
  job_title: string;
  company: string | null;
  status: ScreeningStatus;
  is_demo: boolean;
  created_at: string;
  updated_at: string | null;
  analyzed_at: string | null;
  candidate_count: number;
  analyzed_count: number;
  failed_count: number;
  average_score: number | null;
  top_score: number | null;
  strong_matches: number;
  required_skill_count: number;
}

export interface ScreeningDetail extends ScreeningSummary {
  job_description: string;
  requirements: JobRequirements;
  score_version: string | null;
}

export interface CandidateListItem {
  id: number;
  screening_id: number;
  name: string | null;
  email: string | null;
  resume_filename: string | null;
  parse_status: ParseStatus;
  parse_error: string | null;
  status: CandidateStatus;
  overall_score: number | null;
  match_label: string | null;
  rank: number | null;
  skill_score: number | null;
  semantic_score: number | null;
  experience_score: number | null;
  education_score: number | null;
  total_experience_years: number | null;
  relevant_experience_years: number | null;
  matched_skill_count: number;
  required_matched: string[];
  required_missing: string[];
  data_completeness: number;
}

export interface SkillEvidence {
  skill: string;
  canonical: string;
  requirement: "required" | "preferred";
  match_type: MatchType;
  credit: number;
  weight: number;
  evidence_zones: string[];
  related_via: string[];
  similarity: number | null;
}

export interface ExperienceRole {
  title: string | null;
  company: string | null;
  start: string | null;
  end: string | null;
  months: number;
  dates_confident: boolean;
  relevance: "high" | "partial" | "low" | "none";
  relevance_factor: number;
  matched_required_skills: string[];
  semantic_similarity: number | null;
  description: string;
}

export interface ExperienceEntry {
  title: string | null;
  company: string | null;
  start: string | null;
  end: string | null;
  start_label?: string;
  months: number;
  description: string;
  dates_confident: boolean;
}

export interface EducationEntry {
  degree: string;
  level: number;
  level_name: string;
  field: string | null;
  institution: string | null;
  year: number | null;
}

export interface ProjectEntry {
  name: string;
  description: string;
}

export interface ParsedProfile {
  name: string | null;
  email: string | null;
  phone: string | null;
  links: string[];
  summary: string;
  skills: string[];
  skill_evidence: Record<string, string[]>;
  experience_entries: ExperienceEntry[];
  total_experience_months: number;
  total_experience_years: number | null;
  education: EducationEntry[];
  highest_education_level: number;
  projects: ProjectEntry[];
  certifications: string[];
  awards: string[];
  resume_filename: string | null;
  sections_found: string[];
  warnings: string[];
  char_count: number;
  extraction?: {
    method: string;
    pages: number | null;
    char_count: number;
    ocr_suspected: boolean;
    warnings: string[];
  };
}

export interface SemanticPassage {
  requirement: string;
  requirement_text: string;
  best_passage: string;
  best_passage_label: string;
  similarity: number;
  calibrated: number;
}

export interface AnalysisDetail {
  overall_score: number;
  match_label: string;
  skill_score: number | null;
  semantic_score: number | null;
  experience_score: number | null;
  education_score: number | null;
  weights: Record<string, number>;
  effective_weights: Record<string, number>;
  unavailable_components: string[];
  data_completeness: number;
  score_version: string;
  matched_skills: SkillEvidence[];
  missing_skills: { required: string[]; preferred: string[]; uncertain: string[] };
  coverage: {
    required: { matched: number; total: number; matched_skills: string[] };
    preferred: { matched: number; total: number; matched_skills: string[] };
  };
  related_only: string[];
  semantic_only: string[];
  components: {
    skills: {
      score: number | null;
      coverage: AnalysisDetail["coverage"];
      missing_required: string[];
      missing_preferred: string[];
      related_only: string[];
      semantic_only: string[];
    };
    semantic: {
      available: boolean;
      score: number | null;
      method: string;
      mean_similarity: number | null;
      passages_compared: number;
      top_passages: SemanticPassage[];
      all_passages: SemanticPassage[];
      note: string;
    };
    experience: {
      available: boolean;
      score: number | null;
      required_years: number | null;
      total_years: number | null;
      relevant_years: number | null;
      roles: ExperienceRole[];
      note: string;
    };
    education: {
      available: boolean;
      score: number | null;
      required: string[];
      candidate: EducationEntry[];
      note: string;
      level_required: number;
      level_candidate: number;
      field_match?: boolean | null;
    };
  };
  explanation: {
    headline: string;
    summary: string;
    coverage_line: string;
    strengths: string[];
    gaps: string[];
    notes: string[];
    disclaimer: string;
  };
}

export interface CandidateDetail extends CandidateListItem {
  parsed_profile: ParsedProfile;
  analysis: AnalysisDetail | null;
  resume_text: string;
  file_available: boolean;
}

export interface ProgressStage {
  key: string;
  label: string;
  status: "pending" | "running" | "done" | "skipped" | "failed";
  detail?: string | null;
}

export interface ProgressResponse {
  screening_id: number;
  state: "idle" | "running" | "completed" | "failed";
  current_stage: string | null;
  percent: number;
  total_files: number;
  processed_files: number;
  succeeded_files: number;
  failed_files: number;
  stages: ProgressStage[];
  errors: { file: string; message: string }[];
  message: string | null;
  started_at?: string | null;
  finished_at?: string | null;
}

export interface UploadResult {
  accepted: { filename: string; size: number; type: string }[];
  rejected: { filename: string; reason: string; code?: string }[];
  duplicates: { filename: string; reason: string }[];
}

export interface ScoreConfig {
  weights: Record<string, number>;
  score_version: string;
  labels: { label: string; min: number; max: number }[];
  semantic: {
    state: string;
    model: string;
    method: string;
    error: string | null;
    calibration: { low: number; high: number };
    calibration_fallback?: { low: number; high: number };
    evidence_threshold: number;
    evidence_threshold_fallback?: number;
    requirement_weights: Record<string, number>;
    match_credit: Record<string, number>;
    max_upload_mb: number;
    max_resumes: number;
    accepted_types: string[];
  };
}

export interface OverviewData {
  metrics: {
    active_jobs: number;
    total_screenings: number;
    total_candidates: number;
    analyzed_candidates: number;
    average_score: number | null;
    strong_matches: number;
    shortlisted: number;
  };
  recent_screenings: ScreeningSummary[];
  top_candidates: {
    id: number;
    screening_id: number;
    name: string;
    job_title: string;
    overall_score: number;
    match_label: string;
    status: CandidateStatus;
    is_demo: boolean;
  }[];
  has_data: boolean;
  semantic: ScoreConfig["semantic"];
}

export interface AnalyticsData {
  has_data: boolean;
  job_title?: string;
  company?: string | null;
  candidate_count: number;
  analyzed_count: number;
  failed_count?: number;
  average_score?: number;
  highest_score?: number;
  lowest_score?: number;
  strong_matches?: number;
  strong_match_percent?: number;
  label_distribution?: { label: string; count: number }[];
  status_distribution?: { status: string; count: number }[];
  score_distribution?: { range: string; count: number }[];
  required_skill_coverage?: { skill: string; matched: number; total: number; percent: number }[];
  preferred_skill_count?: number;
  most_common_gaps?: { skill: string; count: number }[];
  most_matched_skills?: { skill: string; count: number }[];
  experience_distribution?: { range: string; count: number }[];
  minimum_experience?: number | null;
  meeting_experience?: number;
  meeting_experience_percent?: number | null;
  top_candidates?: {
    name: string;
    overall: number;
    skills: number | null;
    semantic: number | null;
    experience: number | null;
    education: number | null;
  }[];
  message?: string;
}

export interface ComparisonCandidate {
  id: number;
  name: string;
  email: string | null;
  resume_filename: string | null;
  status: CandidateStatus;
  overall_score: number | null;
  match_label: string | null;
  rank: number | null;
  skill_score: number | null;
  semantic_score: number | null;
  experience_score: number | null;
  education_score: number | null;
  relevant_experience_years: number | null;
  total_experience_years: number | null;
  coverage: AnalysisDetail["coverage"] | null;
  missing_required: string[];
  matched_required: string[];
  related_only: string[];
  projects: ProjectEntry[];
  experience_roles: ExperienceRole[];
  education: EducationEntry[];
  data_completeness: number;
  headline: string;
}

export interface ComparisonResponse {
  candidates: ComparisonCandidate[];
}
