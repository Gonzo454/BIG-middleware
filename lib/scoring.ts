import type { RB2BVisitor, AlloCallSummary, EmailPayload } from './types.js';

const HOT_TITLES = new Set([
  'ceo', 'cfo', 'coo', 'cto', 'vp', 'vice president',
  'director', 'partner', 'owner', 'president',
  'managing director', 'fund manager', 'portfolio manager',
  'principal', 'chairman', 'founder',
]);

const HOT_PAGES = new Set([
  '/#investors', '/#contact', '/investors', '/contact',
]);

const INVESTOR_KEYWORDS = [
  'invest', 'fund', 'capital', 'portfolio', 'accredited',
  'returns', 'equity', 'deploy', 'allocation',
];

const PM_KEYWORDS = [
  'property management', 'tenant', 'lease', 'maintenance',
  'commercial', 'manage my property', 'vacancies',
];

const SENIOR_KEYWORDS = [
  'park vista', 'assisted living', 'memory care', 'senior',
  'mom', 'dad', 'parent', 'elderly', 'independent living',
];

const RESIDENTIAL_KEYWORDS = [
  'buying a home', 'selling my house', 'realtor', 'residential',
  'home for sale', 'listing', 'mls',
];

function titleIsHot(title?: string): boolean {
  if (!title) return false;
  const lower = title.toLowerCase();
  return Array.from(HOT_TITLES).some(t => lower.includes(t));
}

function pageIsHot(url?: string): boolean {
  if (!url) return false;
  return Array.from(HOT_PAGES).some(p => url.includes(p));
}

function containsKeywords(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.filter(k => lower.includes(k)).length;
}

export function scoreRB2BVisitor(visitor: RB2BVisitor): number {
  let score = 2; // baseline for an identified visitor

  if (titleIsHot(visitor.title)) score += 3;
  if (pageIsHot(visitor.page_url)) score += 2;
  if ((visitor.visit_count ?? 0) >= 3) score += 2;
  if (visitor.email) score += 1; // having email is a signal

  return Math.min(score, 10);
}

export function scoreAlloCall(call: AlloCallSummary): number {
  let score = 4; // baseline for someone who called

  const text = [call.call_summary, call.intent, call.qualification_notes]
    .filter(Boolean)
    .join(' ');

  if (containsKeywords(text, INVESTOR_KEYWORDS) > 0) score += 2;
  if (containsKeywords(text, PM_KEYWORDS) > 0) score += 1;
  if (call.booked_meeting) score += 2;
  if (call.caller_email) score += 1;
  if ((call.call_duration_seconds ?? 0) > 180) score += 1;

  return Math.min(score, 10);
}

export function scoreEmail(email: EmailPayload): number {
  let score = 3; // baseline for email inquiry

  const text = [email.subject, email.body_text].filter(Boolean).join(' ');

  if (containsKeywords(text, INVESTOR_KEYWORDS) > 0) score += 3;
  if (containsKeywords(text, PM_KEYWORDS) > 0) score += 2;
  if (containsKeywords(text, SENIOR_KEYWORDS) > 0) score += 1;
  if (containsKeywords(text, RESIDENTIAL_KEYWORDS) > 0) score += 1;

  return Math.min(score, 10);
}

export function isHotLead(score: number): boolean {
  return score >= 7;
}
