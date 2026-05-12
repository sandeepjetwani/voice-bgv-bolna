# Deck Outline — 5 slides

Build in Google Slides (or any tool). Keep visual, minimal text per slide.

---

## Slide 1 — The Problem

**Title:** BGV is a phone-call problem at scale

**Body:**
- BGV (background verification) companies make **thousands of HR phone calls per day** to verify candidates' employment history
- Today: human agents. **5–7 verifications / agent / day. ₹150–200 per call. 2–5 day turnaround. English only.**
- HR contacts are often in **tier-2/3 Indian cities** — language is a real barrier
- This is the kind of high-volume, repetitive, multilingual voice workflow Bolna was built for

**Visual:** Photo or icon of a stack of folders / a call-center floor

---

## Slide 2 — The Solution

**Title:** Voice AI agent that makes the verification call itself

**Body:**
- Operator submits candidate + ex-employer details
- Bolna agent calls HR in their preferred language
- Runs structured employment-verification script
- Captures answers via webhooks → backend → scoring engine
- Result: VERIFIED / DISCREPANCY / UNVERIFIABLE — in under an hour

**Visual:** 3-step flow icon: Operator → Voice agent → Verified result

---

## Slide 3 — Architecture

**Title:** How it's built

Paste the architecture diagram from `PLAN.md` — the box-and-arrow showing:
- Admin web app (React)
- Bolna agent
- Express backend with webhook receiver
- In-memory store

Annotate the 3 webhooks the agent fires:
1. `hr_contact_confirmed`
2. `dates_captured` / `designation_captured` / `exit_details_captured`
3. `call_completed`

---

## Slide 4 — Demo

**Title:** End-to-end demo

**Body:**
- Screen-record link
- 3 screenshots:
  1. Admin dashboard with "New Verification" form
  2. Case detail showing events timeline mid-call
  3. Final status: VERIFIED with all captured fields

Add GitHub repo link + deployed URL (if deployed)

---

## Slide 5 — Outcome metrics & what's next

**Title:** What this unlocks

| Metric | Manual BGV | Voice AI BGV |
|---|---|---|
| Verifications / day / agent | 5–7 | 30–50 (auto-scale) |
| Cost per verification | ₹150–200 | ₹15–30 |
| Turnaround time | 2–5 days | < 1 hour |
| Language coverage | English | 10+ Indian languages |

**Next:**
- Voice biometric verification (anti-fraud)
- Reference check calls (adjacent workflow, same agent shape)
- Address verification calls (call neighbors/landlords)
- WhatsApp document collection during call (multi-channel)

**Why this matters for Bolna:**
- BGV is a $500M+ Indian market; today's vendors are voice-call heavy by default
- One verticalized agent template → can be sold to every BGV vendor in India
- High call volume, high willingness to pay, regulatory tailwind (DPDPA)
