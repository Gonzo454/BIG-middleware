import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getClient } from '../../lib/claude.js';
import { classifyLead } from '../../lib/classifier.js';
import { scoreAlloCall, isHotLead } from '../../lib/scoring.js';
import {
  findOrCreatePerson,
  createDeal,
  addNote,
  getPipelineId,
} from '../../lib/pipedrive.js';
import { sendSlackNotification, formatLeadAlert } from '../../lib/slack.js';
import { LOB_LABELS } from '../../lib/types.js';
import type { AlloCallSummary } from '../../lib/types.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers['x-webhook-secret'];
  if (process.env.WEBHOOK_SECRET && authHeader !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const call: AlloCallSummary = req.body;
    const name = call.caller_name || 'Unknown Caller';

    // Build context for classification
    const context = [
      `Name: ${name}`,
      call.caller_phone && `Phone: ${call.caller_phone}`,
      call.caller_email && `Email: ${call.caller_email}`,
      call.intent && `Intent: ${call.intent}`,
      call.call_summary && `Call summary: ${call.call_summary}`,
      call.qualification_notes && `Qualification: ${call.qualification_notes}`,
      call.booked_meeting && `Booked meeting: yes`,
      `Source: Allo phone call`,
    ]
      .filter(Boolean)
      .join('\n');

    // Classify and score
    const claude = getClient();
    const classification = await classifyLead(claude, context);
    const heuristicScore = scoreAlloCall(call);
    const finalScore = Math.round((classification.lead_score + heuristicScore) / 2);
    const hot = isHotLead(finalScore);

    // Create Pipedrive person + deal
    const person = await findOrCreatePerson({
      name,
      email: call.caller_email,
      phone: call.caller_phone,
    });

    const pipelineId = getPipelineId(classification.lob);
    const deal = await createDeal({
      title: `${name} — ${LOB_LABELS[classification.lob]} (Allo Call)`,
      person_id: person.id,
      pipeline_id: pipelineId,
    });

    // Attach call details as note
    if (deal.id) {
      await addNote({
        deal_id: deal.id,
        content: [
          `<b>Source:</b> Allo Phone Call`,
          `<b>LOB:</b> ${LOB_LABELS[classification.lob]}`,
          `<b>Score:</b> ${finalScore}/10${hot ? ' 🔥 HOT' : ''}`,
          `<b>Classification:</b> ${classification.reasoning}`,
          call.call_summary && `<b>Call Summary:</b> ${call.call_summary}`,
          call.intent && `<b>Intent:</b> ${call.intent}`,
          call.qualification_notes && `<b>Qualification:</b> ${call.qualification_notes}`,
          call.call_duration_seconds && `<b>Duration:</b> ${Math.round(call.call_duration_seconds / 60)}min`,
          call.booked_meeting && `<b>Meeting booked:</b> Yes`,
          call.call_transcript && `<hr/><b>Transcript:</b><br/>${call.call_transcript}`,
        ]
          .filter(Boolean)
          .join('<br/>'),
        pinned_to_deal_flag: hot,
      });
    }

    // Slack notification
    await sendSlackNotification(
      formatLeadAlert({
        source: 'Allo Call',
        name,
        lob: LOB_LABELS[classification.lob],
        score: finalScore,
        isHot: hot,
        summary: call.call_summary || classification.reasoning,
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
    console.error('Allo webhook error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
