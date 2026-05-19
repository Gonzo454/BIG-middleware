import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getClient } from '../../lib/claude.js';
import { classifyLead } from '../../lib/classifier.js';
import { draftFirstTouchEmail } from '../../lib/claude.js';
import { scoreEmail, isHotLead } from '../../lib/scoring.js';
import {
  findOrCreatePerson,
  createDeal,
  addNote,
  getPipelineId,
} from '../../lib/pipedrive.js';
import { sendChatNotification, formatLeadAlert } from '../../lib/gchat.js';
import { LOB_LABELS } from '../../lib/types.js';
import type { EmailPayload } from '../../lib/types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers['x-webhook-secret'];
  if (process.env.WEBHOOK_SECRET && authHeader !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const email: EmailPayload = req.body;
    const name = email.from_name || email.from_email || 'Unknown Sender';

    // Build context for classification
    const context = [
      `Sender: ${name}`,
      email.from_email && `Email: ${email.from_email}`,
      email.subject && `Subject: ${email.subject}`,
      email.body_text && `Body: ${email.body_text.slice(0, 1000)}`,
      `Source: Email to info@blackdeerig.com`,
    ]
      .filter(Boolean)
      .join('\n');

    // Classify and score
    const claude = getClient();
    const classification = await classifyLead(claude, context);
    const heuristicScore = scoreEmail(email);
    const finalScore = Math.round((classification.lead_score + heuristicScore) / 2);
    const hot = isHotLead(finalScore);

    // Create Pipedrive person + deal
    const person = await findOrCreatePerson({
      name,
      email: email.from_email,
    });

    const pipelineId = getPipelineId(classification.lob);
    const deal = await createDeal({
      title: `${name} — ${LOB_LABELS[classification.lob]} (Email)`,
      person_id: person.id,
      pipeline_id: pipelineId,
    });

    // Draft first-touch reply
    const draft = await draftFirstTouchEmail(claude, context, LOB_LABELS[classification.lob]);

    // Attach email + draft as notes
    if (deal.id) {
      await addNote({
        deal_id: deal.id,
        content: [
          `<b>Source:</b> Email`,
          `<b>LOB:</b> ${LOB_LABELS[classification.lob]}`,
          `<b>Score:</b> ${finalScore}/10${hot ? ' 🔥 HOT' : ''}`,
          `<b>Classification:</b> ${classification.reasoning}`,
          `<hr/><b>Original Email:</b>`,
          `<b>From:</b> ${name} (${email.from_email || 'no email'})`,
          `<b>Subject:</b> ${email.subject || '(no subject)'}`,
          `<br/>${email.body_text || email.body_html || '(empty body)'}`,
        ]
          .filter(Boolean)
          .join('<br/>'),
        pinned_to_deal_flag: hot,
      });

      // Attach draft reply as separate note
      await addNote({
        deal_id: deal.id,
        content: [
          `<b>📝 AI-Drafted Reply (REVIEW BEFORE SENDING)</b>`,
          `<b>Subject:</b> ${draft.subject}`,
          `<hr/>`,
          draft.body.replace(/\n/g, '<br/>'),
        ].join('<br/>'),
      });
    }

    // Google Chat notification
    await sendChatNotification(
      formatLeadAlert({
        source: 'Email',
        name,
        lob: LOB_LABELS[classification.lob],
        score: finalScore,
        isHot: hot,
        summary: `Subject: ${email.subject || '(none)'} — ${classification.reasoning}`,
      })
    );

    return res.status(200).json({
      ok: true,
      person_id: person.id,
      deal_id: deal.id,
      lob: classification.lob,
      score: finalScore,
      is_hot: hot,
      draft_subject: draft.subject,
    });
  } catch (err) {
    console.error('Email webhook error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
