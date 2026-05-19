import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getClient } from '../../lib/claude.js';
import { classifyLead } from '../../lib/classifier.js';
import { scoreRB2BVisitor, isHotLead } from '../../lib/scoring.js';
import {
  findOrCreatePerson,
  createDeal,
  addNote,
  getPipelineId,
} from '../../lib/pipedrive.js';
import { sendSlackNotification, formatLeadAlert } from '../../lib/slack.js';
import { LOB_LABELS } from '../../lib/types.js';
import type { RB2BVisitor } from '../../lib/types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers['x-webhook-secret'];
  if (process.env.WEBHOOK_SECRET && authHeader !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const visitor: RB2BVisitor = req.body;
    const name = [visitor.first_name, visitor.last_name].filter(Boolean).join(' ') || 'Unknown Visitor';

    // Build context string for Claude classification
    const context = [
      `Name: ${name}`,
      visitor.email && `Email: ${visitor.email}`,
      visitor.company && `Company: ${visitor.company}`,
      visitor.title && `Title: ${visitor.title}`,
      visitor.linkedin_url && `LinkedIn: ${visitor.linkedin_url}`,
      visitor.page_url && `Page visited: ${visitor.page_url}`,
      visitor.visit_count && `Visit count: ${visitor.visit_count}`,
      visitor.city && visitor.state && `Location: ${visitor.city}, ${visitor.state}`,
    ]
      .filter(Boolean)
      .join('\n');

    // Classify and score
    const claude = getClient();
    const classification = await classifyLead(claude, context);
    const heuristicScore = scoreRB2BVisitor(visitor);
    const finalScore = Math.round((classification.lead_score + heuristicScore) / 2);
    const hot = isHotLead(finalScore);

    // Create Pipedrive person + deal
    const person = await findOrCreatePerson({
      name,
      email: visitor.email,
    });

    const pipelineId = getPipelineId(classification.lob);
    const deal = await createDeal({
      title: `${name} — ${LOB_LABELS[classification.lob]} (RB2B)`,
      person_id: person.id,
      pipeline_id: pipelineId,
    });

    // Attach enrichment note
    if (deal.id) {
      await addNote({
        deal_id: deal.id,
        content: [
          `<b>Source:</b> RB2B Web Visitor`,
          `<b>LOB:</b> ${LOB_LABELS[classification.lob]}`,
          `<b>Score:</b> ${finalScore}/10${hot ? ' 🔥 HOT' : ''}`,
          `<b>Classification:</b> ${classification.reasoning}`,
          visitor.company && `<b>Company:</b> ${visitor.company}`,
          visitor.title && `<b>Title:</b> ${visitor.title}`,
          visitor.page_url && `<b>Page:</b> ${visitor.page_url}`,
          visitor.linkedin_url && `<b>LinkedIn:</b> <a href="${visitor.linkedin_url}">${visitor.linkedin_url}</a>`,
          visitor.visit_count && `<b>Visits:</b> ${visitor.visit_count}`,
        ]
          .filter(Boolean)
          .join('<br/>'),
        pinned_to_deal_flag: hot,
      });
    }

    // Slack notification
    await sendSlackNotification(
      formatLeadAlert({
        source: 'RB2B',
        name,
        company: visitor.company,
        lob: LOB_LABELS[classification.lob],
        score: finalScore,
        isHot: hot,
        summary: classification.reasoning,
      })
    );

    return res.status(200).json({
      ok: true,
      person_id: person.id,
      deal_id: deal.id,
      lob: classification.lob,
      score: finalScore,
      is_hot: hot,
    });
  } catch (err) {
    console.error('RB2B webhook error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
