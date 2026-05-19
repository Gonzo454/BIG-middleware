// ── Lines of Business ──────────────────────────────────────────────
export type LOB =
  | 'commercial-pm'
  | 'development'
  | 'investor'
  | 'senior-housing'
  | 'residential';

export const LOB_LABELS: Record<LOB, string> = {
  'commercial-pm': 'Commercial Property Management',
  'development': 'Development Deals',
  'investor': 'Investor Pipeline',
  'senior-housing': 'Senior Housing',
  'residential': 'Residential Sales',
};

export const LOB_ASSIGNEES: Record<LOB, string> = {
  'commercial-pm': 'kevin@blackdeerig.com',
  'development': 'joe@blackdeerig.com',
  'investor': 'joe@blackdeerig.com',
  'senior-housing': 'denise@blackdeerig.com',
  'residential': 'joe@blackdeerig.com', // routes to Y Realty
};

// ── Inbound payloads ──────────────────────────────────────────────

export interface RB2BVisitor {
  email?: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  title?: string;
  linkedin_url?: string;
  page_url?: string;
  visit_count?: number;
  city?: string;
  state?: string;
  country?: string;
}

export interface AlloCallSummary {
  caller_name?: string;
  caller_phone?: string;
  caller_email?: string;
  call_summary?: string;
  call_transcript?: string;
  call_duration_seconds?: number;
  intent?: string;
  qualification_notes?: string;
  booked_meeting?: boolean;
}

export interface EmailPayload {
  from_name?: string;
  from_email?: string;
  subject?: string;
  body_text?: string;
  body_html?: string;
}

// ── Enrichment result from Claude ─────────────────────────────────

export interface ClassificationResult {
  lob: LOB;
  confidence: number;
  reasoning: string;
  lead_score: number;
  is_hot: boolean;
  suggested_subject?: string;
}

export interface EnrichmentResult {
  company_summary?: string;
  role_category?: string;
  linkedin_url?: string;
  estimated_company_size?: string;
  industry?: string;
}

export interface DraftEmailResult {
  subject: string;
  body: string;
}

// ── Pipedrive types ───────────────────────────────────────────────

export interface PipedrivePerson {
  id?: number;
  name: string;
  email?: string[];
  phone?: string[];
  org_id?: number;
}

export interface PipedriveDeal {
  id?: number;
  title: string;
  person_id?: number;
  org_id?: number;
  pipeline_id?: number;
  stage_id?: number;
  value?: number;
  currency?: string;
  status?: 'open' | 'won' | 'lost' | 'deleted';
}

export interface PipedriveNote {
  deal_id: number;
  content: string;
  pinned_to_deal_flag?: boolean;
}
