# Voice BGV — Employment Verification via Bolna AI

Take-home assignment for Bolna AI (FSE role). A voice AI agent calls HRs of ex-employers to verify a candidate's employment history.

## What this is

Replaces manual BGV call-center work with a **multilingual voice agent** that:
1. Calls the HR of a candidate's claimed previous employer
2. Asks structured employment-verification questions
3. Posts each captured answer to a webhook
4. Backend scores the verification (verified / discrepancy / unverifiable)
5. Admin dashboard updates in real-time

## Project structure

```
bolna-bgv-assignment/
├── PLAN.md                — architecture, agent prompt, webhook schema
├── DECK_OUTLINE.md        — 5-slide submission deck
├── DEMO_SCRIPT.md         — what to show in the screen recording
├── backend/               — Express webhook server + verification engine
│   ├── server.js
│   ├── package.json
│   └── .env.example
└── frontend/              — Vite + React admin dashboard
    ├── src/
    └── package.json
```

## Setup (5 minutes)

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env if you have Bolna API keys; otherwise mock mode works for the demo
npm run dev
# Backend on http://localhost:3001
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Frontend on http://localhost:5173
```

## Running the demo without real Bolna calls

The backend has a built-in event simulator. From the admin dashboard:
1. Click "New Verification" → fill out candidate + ex-employer + claimed details
2. Click "Trigger Call"
3. Use the "Simulate Event" buttons in the case detail panel to fire webhook events one at a time
4. Watch status update from `INITIATED` → `IN_PROGRESS` → `VERIFIED` (or `DISCREPANCY`)

## Connecting to real Bolna (one-shot script)

You don't have to click around Bolna's UI. There's a script that creates the agent for you via Bolna's `POST /v2/agent` API.

```bash
cd backend
# 1. Fill in these two values in .env:
#    BOLNA_API_KEY=<your bolna key>
#    BACKEND_WEBHOOK_URL=<https url where Bolna posts events>
#       - For local dev: use ngrok (ngrok http 3001) and use its https URL + /webhook/bolna
#       - For deployed: https://your-backend.onrender.com/webhook/bolna

# 2. Create the agent on Bolna:
npm run create-agent

# 3. The script prints an agent_id. Copy it into .env as BOLNA_AGENT_ID.
# 4. Restart the backend (npm run dev) and trigger verifications — real calls now go out.
```

If you'd rather configure manually in Bolna's playground, the full prompt + tools/synthesizer/transcriber config is in `create-agent.js` — copy from there.

## Deployment

- **Backend:** Railway / Render / Fly.io (one-click deploy from GitHub)
- **Frontend:** Vercel (set `VITE_API_URL` to your backend URL)

## Outcome metrics (for the deck)

| Metric | Manual BGV | Voice AI BGV |
|---|---|---|
| Verifications/day per agent | 5–7 | 30–50 (auto-scale) |
| Cost per verification | ₹150–200 | ₹15–30 |
| Turnaround time | 2–5 days | < 1 hour |
| Languages | English only | 10+ Indian languages |
