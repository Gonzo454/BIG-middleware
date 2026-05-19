# Blackdeer Middleware

AI-native CRM middleware for Blackdeer Investment Group. Routes leads from RB2B, Allo, and email into Pipedrive with Claude-powered classification, scoring, and email drafting.

## Architecture

```
RB2B (web visitors) ──→ POST /webhooks/rb2b ──┐
Allo (phone calls)  ──→ POST /webhooks/allo ──┤──→ Claude (classify + score + draft)
Email (forwarded)   ──→ POST /webhooks/email ──┤──→ Pipedrive (person + deal + notes)
Manual re-enrich    ──→ POST /enrich/:dealId ──┘──→ Google Chat (bd-leads-all / bd-leads-hot)
```

## What it does

1. **Classifies** every inbound lead into one of 5 lines of business (Commercial PM, Development, Investor, Senior Housing, Residential)
2. **Scores** leads 1–10 using both heuristic rules and Claude analysis
3. **Creates** a Pipedrive Person + Deal in the correct pipeline
4. **Enriches** contact info (company, role, industry) via Claude
5. **Drafts** a first-touch email for human review
6. **Notifies** Google Chat with a formatted alert (hot leads go to bd-leads-hot space)

## Setup

### 1. Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key from console.anthropic.com |
| `PIPEDRIVE_API_TOKEN` | Yes | Pipedrive API token from Settings → Personal preferences → API |
| `PIPEDRIVE_PIPELINE_*` | Yes | Pipeline IDs for each LOB (see below) |
| `WEBHOOK_SECRET` | No | Shared secret for webhook authentication (recommended) |
| `GCHAT_WEBHOOK_URL` | No | Google Chat incoming webhook URL for lead notifications |
| `GCHAT_WEBHOOK_URL_HOT` | No | Separate Google Chat webhook for hot leads (optional) |

### 2. Get Pipedrive pipeline IDs

After creating the 5 pipelines in Pipedrive:
1. Go to each pipeline's settings
2. Note the pipeline ID from the URL: `https://app.pipedrive.com/pipeline/settings/{id}`
3. Set the corresponding env var

### 3. Deploy to Vercel

```bash
npm install
npx vercel --prod
```

Set environment variables in Vercel dashboard → Settings → Environment Variables.

### 4. Configure webhooks

**RB2B (Pro tier):** Settings → Integrations → Webhooks → Add your Vercel URL:
```
https://your-app.vercel.app/webhooks/rb2b
```

**Allo:** Configure webhook in Allo dashboard pointing to:
```
https://your-app.vercel.app/webhooks/allo
```

**Email:** Set up email forwarding from info@blackdeerig.com to a service that POSTs to:
```
https://your-app.vercel.app/webhooks/email
```
(Options: Mailgun routes, SendGrid Inbound Parse, or Zapier Email Parser)

## Local development

```bash
npm install
cp .env.example .env  # fill in values
npx vercel dev
```

Test with curl:
```bash
curl -X POST http://localhost:3000/webhooks/rb2b \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Jane","last_name":"Smith","company":"Acme Corp","title":"VP Operations","page_url":"/#investors","email":"jane@acme.com"}'
```

## Endpoints

### POST /webhooks/rb2b
Receives RB2B identified visitor data. Classifies LOB, scores, creates Pipedrive deal.

### POST /webhooks/allo
Receives Allo call summary after AI receptionist handles a call. Creates deal with full transcript.

### POST /webhooks/email
Receives forwarded email payload. Classifies, creates deal, drafts first-touch reply.

### POST /enrich/:dealId
Manual re-enrichment trigger. Fetches deal from Pipedrive, runs Claude enrichment, attaches updated notes + draft email.

## Cost estimate

At BIG's expected volume (20–50 leads/month):
- Claude API: ~$5–15/month (classification + drafting)
- Vercel hosting: $0 (free tier)
- **Total: ~$10–20/month**
