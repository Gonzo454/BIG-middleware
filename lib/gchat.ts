interface ChatMessage {
  space: string;
  text: string;
  cards?: unknown[];
}

export async function sendChatNotification(message: ChatMessage): Promise<void> {
  const webhookUrl = process.env.GCHAT_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('GCHAT_WEBHOOK_URL not set — skipping Google Chat notification');
    return;
  }

  const hotWebhookUrl = process.env.GCHAT_WEBHOOK_URL_HOT;
  const targetUrl = message.space === 'bd-leads-hot' && hotWebhookUrl
    ? hotWebhookUrl
    : webhookUrl;

  await fetch(targetUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      text: message.text,
      cardsV2: message.cards,
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
}): ChatMessage {
  const emoji = opts.isHot ? '🔥' : '📩';
  const space = opts.isHot ? 'bd-leads-hot' : 'bd-leads-all';

  const lines = [
    `${emoji} *New ${opts.source} Lead*`,
    `*Name:* ${opts.name}${opts.company ? ` (${opts.company})` : ''}`,
    `*LOB:* ${opts.lob}`,
    `*Score:* ${opts.score}/10${opts.isHot ? ' 🔥 HOT' : ''}`,
    `*Summary:* ${opts.summary}`,
    opts.dealUrl ? `<${opts.dealUrl}|View in Pipedrive>` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    space,
    text: lines,
  };
}
