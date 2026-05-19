import Anthropic from '@anthropic-ai/sdk';
import type { DraftEmailResult, EnrichmentResult } from './types.js';

let _client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export async function enrichContact(
  client: Anthropic,
  context: string
): Promise<EnrichmentResult> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 400,
    messages: [
      {
        role: 'user',
        content: `Given this contact information, provide enrichment data. If you cannot determine something, omit it. Respond in JSON only.

Contact info:
${context}

JSON format:
{
  "company_summary": "1-2 sentence description of their company",
  "role_category": "executive | manager | individual-contributor | unknown",
  "estimated_company_size": "1-10 | 10-50 | 50-200 | 200-1000 | 1000+",
  "industry": "industry name"
}`,
      },
    ],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return {};

  try {
    return JSON.parse(jsonMatch[0]) as EnrichmentResult;
  } catch {
    return {};
  }
}

export async function draftFirstTouchEmail(
  client: Anthropic,
  context: string,
  lob: string
): Promise<DraftEmailResult> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    messages: [
      {
        role: 'user',
        content: `You are drafting a first-touch email for Blackdeer Investment Group (BIG), a Midwest commercial real estate firm.

Tone: Professional, warm, Midwestern. Not salesy — consultative. Short (under 150 words).

Line of business: ${lob}

Lead context:
${context}

Write the email. Respond in JSON:
{
  "subject": "email subject line",
  "body": "full email body with greeting and sign-off from Joe Wagner, CEO"
}`,
      },
    ],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      subject: 'Blackdeer Investment Group — Introduction',
      body: 'Thank you for your interest in Blackdeer Investment Group. We would love to learn more about how we can help. Please let us know a good time to connect.\n\nBest,\nJoe Wagner\nCEO, Blackdeer Investment Group',
    };
  }

  try {
    return JSON.parse(jsonMatch[0]) as DraftEmailResult;
  } catch {
    return {
      subject: 'Blackdeer Investment Group — Introduction',
      body: 'Thank you for your interest in Blackdeer Investment Group. We would love to learn more about how we can help.\n\nBest,\nJoe Wagner\nCEO, Blackdeer Investment Group',
    };
  }
}
