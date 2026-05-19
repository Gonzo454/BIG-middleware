import Anthropic from '@anthropic-ai/sdk';
import type { LOB, ClassificationResult } from './types.js';

const CLASSIFICATION_PROMPT = `You are a lead classifier for Blackdeer Investment Group (BIG), a Midwest commercial real estate firm.

BIG has 5 lines of business:
1. commercial-pm — Commercial Property Management (leasing, tenant relations, maintenance, financial reporting for office/retail/industrial)
2. development — Real Estate Development (ground-up, renovation, adaptive reuse projects)
3. investor — Investor Relations (accredited investors deploying capital into BIG's real estate deals)
4. senior-housing — Senior Housing / Park Vista (assisted living, memory care, independent living)
5. residential — Residential Sales / Y Realty (home buying, selling, residential advisory)

Given the following lead information, classify into the correct LOB and score the lead 1-10.

Scoring guidelines:
- 1-3: Low intent (browsing, general curiosity, unqualified)
- 4-6: Medium intent (specific interest, some qualification signals)
- 7-9: High intent (clear need, decision-maker, ready to engage)
- 10: Extremely hot (C-suite, explicit request, high value)

Hot lead signals (score 7+):
- C-suite titles: CEO, CFO, COO, VP, Director, Partner, Owner, President, Managing Director
- Visited /#investors or /#contact pages
- Mentions "invest", "fund", "capital", "portfolio"
- Repeat visitor (3+ visits)
- Explicit property management or development inquiry

Respond in JSON only:
{
  "lob": "commercial-pm" | "development" | "investor" | "senior-housing" | "residential",
  "confidence": 0.0-1.0,
  "reasoning": "one sentence",
  "lead_score": 1-10,
  "is_hot": true/false,
  "suggested_subject": "email subject line for first touch"
}`;

export async function classifyLead(
  client: Anthropic,
  context: string
): Promise<ClassificationResult> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    messages: [
      { role: 'user', content: `${CLASSIFICATION_PROMPT}\n\nLead information:\n${context}` },
    ],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      lob: 'commercial-pm',
      confidence: 0.3,
      reasoning: 'Could not parse classification — defaulting to Commercial PM',
      lead_score: 3,
      is_hot: false,
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      lob: parsed.lob as LOB,
      confidence: parsed.confidence ?? 0.5,
      reasoning: parsed.reasoning ?? '',
      lead_score: parsed.lead_score ?? 5,
      is_hot: parsed.is_hot ?? false,
      suggested_subject: parsed.suggested_subject,
    };
  } catch {
    return {
      lob: 'commercial-pm',
      confidence: 0.3,
      reasoning: 'Could not parse classification — defaulting to Commercial PM',
      lead_score: 3,
      is_hot: false,
    };
  }
}
