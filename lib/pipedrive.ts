import type { LOB, PipedrivePerson, PipedriveDeal, PipedriveNote } from './types.js';

const BASE_URL = 'https://api.pipedrive.com/v1';

function apiToken(): string {
  const token = process.env.PIPEDRIVE_API_TOKEN;
  if (!token) throw new Error('PIPEDRIVE_API_TOKEN not set');
  return token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${BASE_URL}${path}${sep}api_token=${apiToken()}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Pipedrive ${res.status}: ${body}`);
  }

  const json = await res.json() as { success: boolean; data: T };
  if (!json.success) {
    throw new Error(`Pipedrive error: ${JSON.stringify(json)}`);
  }
  return json.data;
}

// ── Pipeline mapping ──────────────────────────────────────────────
// These IDs are set via env vars after Pipedrive pipelines are created.
// Format: PIPEDRIVE_PIPELINE_<LOB>=<pipeline_id>

export function getPipelineId(lob: LOB): number | undefined {
  const envMap: Record<LOB, string> = {
    'commercial-pm': 'PIPEDRIVE_PIPELINE_COMMERCIAL_PM',
    'development': 'PIPEDRIVE_PIPELINE_DEVELOPMENT',
    'investor': 'PIPEDRIVE_PIPELINE_INVESTOR',
    'senior-housing': 'PIPEDRIVE_PIPELINE_SENIOR_HOUSING',
    'residential': 'PIPEDRIVE_PIPELINE_RESIDENTIAL',
  };
  const val = process.env[envMap[lob]];
  return val ? parseInt(val, 10) : undefined;
}

// ── Person CRUD ───────────────────────────────────────────────────

interface SearchResult {
  items: Array<{ result_score: number; item: PipedrivePerson }>;
}

export async function findPersonByEmail(email: string): Promise<PipedrivePerson | null> {
  const results = await request<SearchResult>(
    `/persons/search?term=${encodeURIComponent(email)}&fields=email&limit=1`
  );
  return results?.items?.[0]?.item ?? null;
}

export async function createPerson(person: {
  name: string;
  email?: string;
  phone?: string;
}): Promise<PipedrivePerson> {
  return request<PipedrivePerson>('/persons', {
    method: 'POST',
    body: JSON.stringify({
      name: person.name,
      email: person.email ? [person.email] : undefined,
      phone: person.phone ? [person.phone] : undefined,
    }),
  });
}

export async function findOrCreatePerson(person: {
  name: string;
  email?: string;
  phone?: string;
}): Promise<PipedrivePerson> {
  if (person.email) {
    const existing = await findPersonByEmail(person.email);
    if (existing) return existing;
  }
  return createPerson(person);
}

// ── Deal CRUD ─────────────────────────────────────────────────────

export async function createDeal(deal: {
  title: string;
  person_id?: number;
  pipeline_id?: number;
  value?: number;
}): Promise<PipedriveDeal> {
  return request<PipedriveDeal>('/deals', {
    method: 'POST',
    body: JSON.stringify({
      title: deal.title,
      person_id: deal.person_id,
      pipeline_id: deal.pipeline_id,
      value: deal.value,
      status: 'open',
    }),
  });
}

export async function getDeal(dealId: number): Promise<PipedriveDeal> {
  return request<PipedriveDeal>(`/deals/${dealId}`);
}

export async function updateDealField(
  dealId: number,
  fields: Record<string, unknown>
): Promise<PipedriveDeal> {
  return request<PipedriveDeal>(`/deals/${dealId}`, {
    method: 'PUT',
    body: JSON.stringify(fields),
  });
}

// ── Notes ─────────────────────────────────────────────────────────

export async function addNote(note: PipedriveNote): Promise<unknown> {
  return request('/notes', {
    method: 'POST',
    body: JSON.stringify({
      deal_id: note.deal_id,
      content: note.content,
      pinned_to_deal_flag: note.pinned_to_deal_flag ? 1 : 0,
    }),
  });
}
