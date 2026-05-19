interface SlackMessage {
  channel: string;
  text: string;
  blocks?: unknown[];
}

export async function sendSlackNotification(message: SlackMessage): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('SLACK_WEBHOOK_URL not set — skipping Slack notification');
    return;
  }

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel: message.channel,
      text: message.text,
      blocks: message.blocks,
    }),
  });
}

export function formatLeadAlert(opts: {
  source: string;
  name: string;
  company?: string;
  lob: string;
  score: number;
  isHot: boolean;
  summary: string;
  dealUrl?: string;
}): SlackMessage {
  const emoji = opts.isHot ? ':fire:' : ':incoming_envelope:';
  const channel = opts.isHot ? '#bd-leads-hot' : '#bd-leads-all';

  return {
    channel,
    text: `${emoji} New ${opts.source} lead: ${opts.name}${opts.company ? ` (${opts.company})` : ''} — ${opts.lob} — Score: ${opts.score}/10`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            `${emoji} *New ${opts.source} Lead*`,
            `*Name:* ${opts.name}${opts.company ? ` (${opts.company})` : ''}`,
            `*LOB:* ${opts.lob}`,
            `*Score:* ${opts.score}/10${opts.isHot ? ' :fire: HOT' : ''}`,
            `*Summary:* ${opts.summary}`,
            opts.dealUrl ? `<${opts.dealUrl}|View in Pipedrive>` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        },
      },
    ],
  };
}
