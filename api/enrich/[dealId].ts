import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getClient, enrichContact, draftFirstTouchEmail } from '../../lib/claude.js';
import { getDeal, updateDealField, addNote } from '../../lib/pipedrive.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers['x-webhook-secret'];
  if (process.env.WEBHOOK_SECRET && authHeader !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const dealId = parseInt(req.query.dealId as string, 10);
    if (isNaN(dealId)) {
      return res.status(400).json({ error: 'Invalid dealId' });
    }

    // Fetch existing deal
    const deal = await getDeal(dealId);
    if (!deal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    // Build context from deal data
    const context = [
      `Deal: ${deal.title}`,
      deal.person_id && `Person ID: ${deal.person_id}`,
    ]
      .filter(Boolean)
      .join('\n');

    // Enrich and draft
    const claude = getClient();
    const enrichment = await enrichContact(claude, context);
    const draft = await draftFirstTouchEmail(claude, context, deal.title);

    // Update deal with enrichment
    await updateDealField(dealId, {
      // Store enrichment in deal notes since custom fields need IDs
    });

    // Attach enrichment note
    await addNote({
      deal_id: dealId,
      content: [
        `<b>🔍 AI Enrichment (re-run)</b>`,
        enrichment.company_summary && `<b>Company:</b> ${enrichment.company_summary}`,
        enrichment.role_category && `<b>Role:</b> ${enrichment.role_category}`,
        enrichment.industry && `<b>Industry:</b> ${enrichment.industry}`,
        enrichment.estimated_company_size && `<b>Company Size:</b> ${enrichment.estimated_company_size}`,
        `<hr/>`,
        `<b>📝 AI-Drafted Email (REVIEW BEFORE SENDING)</b>`,
        `<b>Subject:</b> ${draft.subject}`,
        `<br/>${draft.body.replace(/\n/g, '<br/>')}`,
      ]
        .filter(Boolean)
        .join('<br/>'),
      pinned_to_deal_flag: true,
    });

    return res.status(200).json({
      ok: true,
      deal_id: dealId,
      enrichment,
      draft_subject: draft.subject,
    });
  } catch (err) {
    console.error('Enrich endpoint error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
