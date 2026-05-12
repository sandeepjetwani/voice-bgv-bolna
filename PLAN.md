# Voice BGV — Plan, Agent Prompt, Webhook Schema

## Problem statement

Background Verification (BGV) companies like Equal Identity, OnGrid, AuthBridge run thousands of employment-verification calls per day. Today this is done by human agents — they phone the HR of a candidate's previous employer and ask structured questions to confirm employment history.

This process is:
- **Slow** — 2 to 5 day turnaround per candidate
- **Expensive** — ₹150–200 per verification (agent time + telephony)
- **English-biased** — HRs in tier-2/3 Indian cities often don't speak English fluently
- **Low-throughput** — one agent handles 5–7 verifications per day

## Solution

A voice AI agent on **Bolna** that calls HRs at scale, in their preferred language, runs a structured verification script, and posts each captured field to a backend webhook for real-time scoring.

## Workflow

```
1. BGV operator submits a verification case (candidate, ex-employer, claimed details)
       │
       ▼
2. Backend creates case + calls Bolna API to initiate outbound call
       │
       ▼
3. Bolna agent calls HR phone number
       │
       ├─── HR picks up
       │    ├─ Agent confirms HR identity → webhook: hr_contact_confirmed
       │    ├─ Agent asks employment confirmation → webhook: employment_confirmed
       │    ├─ Agent asks dates → webhook: dates_captured
       │    ├─ Agent asks designation → webhook: designation_captured
       │    ├─ Agent asks exit details → webhook: exit_details_captured
       │    └─ Agent closes call → webhook: call_completed
       │
       └─── HR doesn't pick up / refuses
            └─ webhook: call_timeout / verification_declined / wrong_number
       │
       ▼
4. Backend computes verification status (VERIFIED / DISCREPANCY / UNVERIFIABLE)
       │
       ▼
5. Admin dashboard updates in real-time; case detail shows events timeline
```

## Outcome metric

**Primary:** Average cost per verification (target: ₹15–30 vs ₹150–200 baseline = ~85% reduction).

**Secondary:**
- Turnaround time (target: < 1 hr vs 2–5 days)
- Verifications/day/agent (target: 30–50 vs 5–7)
- Language coverage (target: 10+ Indian languages vs English-only)

## Architecture

```
┌────────────────┐    POST /api/trigger     ┌──────────────┐
│ Admin Web App  │ ───────────────────────▶ │ Bolna Agent  │
│ (React + Vite) │                          │ (voice call) │
└────────────────┘                          └──────┬───────┘
        ▲                                          │ webhooks per event
        │ poll /api/cases (every 2s)               ▼
        │                                  ┌──────────────────────┐
        └─────────────────────────────────▶│  Express Backend     │
                                           │  POST /api/trigger   │
                                           │  POST /webhook/bolna │
                                           │  GET  /api/cases     │
                                           │  GET  /api/cases/:id │
                                           │  In-memory store     │
                                           └──────────────────────┘
```

## Bolna agent prompt

Drop this into Bolna's agent builder (or equivalent).

```
You are a polite, professional employment verification agent calling on behalf of {bgv_company}.

CONTEXT (passed as call variables):
- Candidate name: {candidate_name}
- Claimed employer: {ex_employer}
- Claimed designation: {claimed_designation}
- Claimed dates: {claimed_start} to {claimed_end}

CALL SCRIPT (one question at a time, conversational):

1. OPENING
   "Namaste, this is calling from {bgv_company}. I'm doing a quick employment verification.
   Am I speaking with someone from HR or admin at {ex_employer}?"
   - If not HR/admin: politely ask to be transferred.
   - If HR/admin: continue.

2. IDENTIFY CONTACT
   "May I have your name and designation, please?"
   → CAPTURE: hr_name, hr_designation
   → WEBHOOK EVENT: hr_contact_confirmed

3. CONFIRM EMPLOYMENT
   "I'm calling regarding {candidate_name}. Can you confirm if they worked at {ex_employer}?"
   → CAPTURE: confirmed (yes / no / unsure)
   → WEBHOOK EVENT: employment_confirmed
   - If no/unsure → skip to step 7

4. DATES
   "Could you confirm their joining date and last working date?"
   → CAPTURE: joining_date, exit_date
   → WEBHOOK EVENT: dates_captured

5. DESIGNATION
   "What was their last designation at the company?"
   → CAPTURE: actual_designation
   → WEBHOOK EVENT: designation_captured

6. EXIT DETAILS
   "Was their exit voluntary? And would they be eligible for rehire?"
   → CAPTURE: exit_type (voluntary / terminated / other), rehire_eligible (yes / no)
   → WEBHOOK EVENT: exit_details_captured

7. CLOSING
   "Thank you for your time. Have a good day."
   → WEBHOOK EVENT: call_completed

LANGUAGE: Default to English. If HR responds in Hindi/Tamil/Kannada/etc., switch.

TONE: Polite, brief, respectful of their time. One question at a time. No robotic phrasing.

ERROR HANDLING:
- HR refuses → thank politely, end → WEBHOOK: verification_declined
- Wrong number → apologize, end → WEBHOOK: wrong_number
- 30s of silence → end → WEBHOOK: call_timeout
```

## Webhook event schema

All events POST to `/webhook/bolna` with this envelope:

```json
{
  "event": "<event_name>",
  "case_id": "<uuid>",
  "call_id": "<bolna_call_id>",
  "timestamp": "2026-05-11T10:30:00Z",
  "data": { /* event-specific fields */ }
}
```

| event | data payload |
|---|---|
| `call_started` | `{}` |
| `hr_contact_confirmed` | `{ hr_name, hr_designation }` |
| `employment_confirmed` | `{ confirmed: "yes" \| "no" \| "unsure" }` |
| `dates_captured` | `{ joining_date, exit_date }` |
| `designation_captured` | `{ actual_designation }` |
| `exit_details_captured` | `{ exit_type, rehire_eligible }` |
| `call_completed` | `{ duration_seconds, transcript_url? }` |
| `verification_declined` | `{ reason }` |
| `wrong_number` | `{}` |
| `call_timeout` | `{}` |

## Verification scoring (backend logic after `call_completed`)

```
status = "VERIFIED" if:
  - confirmed === "yes"
  - joining_date within ±30 days of claimed_start
  - exit_date within ±30 days of claimed_end
  - actual_designation overlaps with claimed_designation (string match)

status = "DISCREPANCY" if:
  - any of the above mismatch but call completed

status = "UNVERIFIABLE" if:
  - confirmed === "unsure" OR
  - verification_declined / wrong_number / call_timeout fired
```

## Time budget (7 hours total)

| Hour | Task |
|---|---|
| 0:00–0:30 | Problem statement + deck slide 1 |
| 0:30–2:30 | Bolna agent setup + test calls (2 hrs) |
| 2:30–4:30 | Backend: Express + webhook + DB + scoring (2 hrs) |
| 4:30–6:30 | Frontend: Vite + React dashboard (2 hrs) |
| 6:30–7:00 | E2E test, screen recording, README polish, deck slides 2–5 |
