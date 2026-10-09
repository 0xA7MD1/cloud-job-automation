// أنواع صفوف الجداول. مصدرها الوحيد migrations/*.sql: أي تعديل هناك ينعكس هنا.
// التواريخ ترجع من PostgREST كنص ISO.

type Timestamp = string;
type Json = Record<string, unknown>;

export const PROVIDERS = [
  "groq",
  "openrouter",
  "openai",
  "anthropic",
  "google",
  "exa",
  "tavily",
  "steel",
] as const;
export type Provider = (typeof PROVIDERS)[number];

export const FILE_KINDS = ["cv", "cover_letter", "document", "evidence", "other"] as const;
export type FileKind = (typeof FILE_KINDS)[number];

export type ApplicationStatus =
  | "draft"
  | "preparing"
  | "ready"
  | "queued"
  | "running"
  | "needs_user"
  | "submitted"
  | "failed"
  | "cancelled";

export type ApplicationEventType =
  | "created"
  | "prepared"
  | "queued"
  | "started"
  | "needs_user"
  | "submit_attempted"
  | "submitted"
  | "failed"
  | "cancelled"
  | "evidence_saved";

export type JobSource = "greenhouse" | "lever" | "ashby" | "careers_page" | "manual";
export type Ats = "greenhouse" | "lever" | "ashby" | "workday" | "other" | "unknown";

export interface Profile {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  headline: string | null;
  summary: string | null;
  years_experience: number | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  answers: Json;
  preferences: Json;
  default_cv_file_id: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface Entitlement {
  user_id: string;
  plan: "free" | "paid" | "owner";
  monthly_apply_limit: number;
  updated_at: Timestamp;
}

/** الأعمدة الي يقدر المستخدم يقرأها. ciphertext/iv/auth_tag مو هنا عمدًا. */
export interface ProviderKeyPublic {
  id: string;
  user_id: string;
  provider: Provider;
  key_version: number;
  last4: string;
  settings: Json;
  status: "unverified" | "valid" | "invalid";
  verified_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}
export const PROVIDER_KEY_PUBLIC_COLUMNS =
  "id, user_id, provider, key_version, last4, settings, status, verified_at, created_at, updated_at";

export interface FileRow {
  id: string;
  user_id: string;
  kind: FileKind;
  bucket: string;
  object_key: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: Timestamp;
}

export interface Company {
  id: string;
  name: string;
  domain: string | null;
  website_url: string | null;
  careers_url: string | null;
  ats: Ats;
  ats_slug: string | null;
  country: string | null;
  city: string | null;
  description: string | null;
  source: "exa" | "tavily" | "ats" | "places" | "manual";
  place_id: string | null;
  last_scanned_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface UserCompany {
  user_id: string;
  company_id: string;
  keywords: string[];
  created_at: Timestamp;
}

export interface Job {
  id: string;
  company_id: string | null;
  source: JobSource;
  external_id: string;
  title: string;
  location: string | null;
  workplace_type: "onsite" | "remote" | "hybrid" | null;
  employment_type: string | null;
  department: string | null;
  description: string | null;
  url: string;
  apply_url: string | null;
  posted_at: Timestamp | null;
  first_seen_at: Timestamp;
  last_seen_at: Timestamp;
  closed_at: Timestamp | null;
  raw: Json | null;
}

export interface Chat {
  id: string;
  user_id: string;
  title: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface MessageRow {
  id: string;
  chat_id: string;
  user_id: string;
  role: "system" | "user" | "assistant";
  parts: unknown[];
  metadata: Json | null;
  created_at: Timestamp;
}

export interface Search {
  id: string;
  user_id: string;
  chat_id: string | null;
  kind: "companies" | "jobs";
  provider: string;
  query: string;
  params: Json;
  results: unknown[];
  result_count: number;
  created_at: Timestamp;
}

export interface UserJob {
  user_id: string;
  job_id: string;
  status: "new" | "saved" | "dismissed";
  match_score: number | null;
  match_reason: string | null;
  search_id: string | null;
  notes: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface Application {
  id: string;
  user_id: string;
  job_id: string;
  status: ApplicationStatus;
  answers: Json;
  cv_file_id: string | null;
  cover_letter_file_id: string | null;
  browser_provider: string | null;
  trigger_run_id: string | null;
  submit_attempted_at: Timestamp | null;
  submitted_at: Timestamp | null;
  confirmation_ref: string | null;
  evidence_file_id: string | null;
  error: string | null;
  /** ApplicationForm (src/lib/apply/form.ts) */
  form: Json;
  cover_letter_text: string | null;
  cover_letter_docx_file_id: string | null;
  /** { subject, email, message } */
  outreach: Json;
  status_detail: string | null;
  prepared_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ApplicationEvent {
  id: number;
  application_id: string;
  user_id: string;
  type: ApplicationEventType;
  data: Json;
  created_at: Timestamp;
}

export interface MonthlyApplyUsage {
  used: number;
  apply_limit: number;
  period_start: Timestamp;
}
