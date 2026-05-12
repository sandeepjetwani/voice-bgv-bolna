# Demo Script — Screen Recording (target: 3–5 minutes)

Use Loom, OBS, or QuickTime. Record at 1080p minimum. Keep narration calm and concrete.

---

## 0:00–0:20 — Setup the problem (talking head or voiceover)

> "Hi, this is Sandeep. I built a voice AI agent on Bolna that solves a real workflow at every BGV company in India — employment verification calls. Today this is done manually: human agents phone HR teams of previous employers to confirm employment history. It's slow, expensive, and English-only. Here's a version that runs the whole thing on a voice agent."

## 0:20–0:50 — Open the admin dashboard

Show the running app at `localhost:5173`.

> "This is the BGV operator's dashboard. On the left I have a list of verification cases — each one represents a candidate whose employment we need to verify. Right now there are a few sample ones already in different states."

Click on an existing case to show the detail panel briefly.

> "Each case shows the candidate, the ex-employer, the claimed designation and dates — and a timeline of events captured during the verification call."

## 0:50–1:30 — Trigger a new verification

Click "New Verification".

> "To trigger a new verification, the operator fills in the candidate's name, the previous employer, the HR phone number, and the claimed employment details. When they click 'Trigger Call', the backend creates a case and calls Bolna's API to initiate the outbound call."

Fill in the form with realistic-sounding data:
- Candidate: Rahul Sharma
- Ex-employer: Acme Logistics Pvt Ltd
- HR phone: +91 98765 12345
- Claimed designation: Senior Operations Manager
- Claimed dates: 2022-06-01 to 2024-08-15

Click Trigger. Show the new case appear in the list with status `IN_PROGRESS`.

## 1:30–2:30 — Simulate the call events

Open the case detail.

> "Now Bolna's agent is on the call. As it asks each question and captures the answer, it fires a webhook to our backend. To simulate this without making a real call, I have a panel here that fires each event in sequence."

Click each simulator button in order, narrating:

> "First — the agent confirms it's speaking with the right HR contact. We capture the HR's name and designation."

→ event: `hr_contact_confirmed`

> "Next — the agent asks if the candidate actually worked there. HR confirms yes."

→ event: `employment_confirmed` with `{ confirmed: "yes" }`

> "Then dates of employment..."

→ event: `dates_captured`

> "Designation..."

→ event: `designation_captured`

> "Exit details — voluntary or terminated, rehire eligible..."

→ event: `exit_details_captured`

> "And finally the call completes."

→ event: `call_completed`

## 2:30–3:00 — Show the verification result

Point at the case status, now `VERIFIED`.

> "After the call completes, the backend scores the case. It compares captured fields against claimed ones — dates within 30 days, designation overlaps — and assigns a final status. Here it's VERIFIED. Had the dates been off or the designation different, it would have flagged DISCREPANCY."

Demonstrate a DISCREPANCY case by triggering another verification, but this time the simulator sends mismatched dates. Show that status updates to `DISCREPANCY` automatically.

## 3:00–3:30 — Architecture recap (optional screen with diagram)

Pull up the architecture diagram from `PLAN.md` (or annotate the dashboard with arrows).

> "Quick recap of the architecture: the dashboard talks to an Express backend over REST. The backend tells Bolna to call the HR. Bolna's agent runs the verification script and posts a webhook to our backend at each captured step. The backend stores events, computes status, and the dashboard polls every 2 seconds for live updates. Everything's in TypeScript / Node — deployable to Railway and Vercel."

## 3:30–4:00 — Wrap with metrics

> "On the impact side: a human agent handles 5–7 verifications a day at around ₹150 per call. A Bolna agent runs unlimited concurrent calls, in 10+ Indian languages, at roughly ₹20 per call — turning a 2–5 day process into under an hour. This is one verticalized agent template; the same pattern extends to reference checks, address verification, and document collection. Thanks for watching."

---

## Production tips

- **Use a real phone number for the demo** if you can — even one real Bolna call recording in the video is a huge bonus
- **Don't read the script verbatim** — sound natural, like you're explaining to a friend
- **Keep narration <50% of the screen time** — the visual is doing the work
- **End with a question** if you want — "Happy to walk through any part in more depth" — invites follow-up

## Recording checklist

- [ ] Backend running on :3001
- [ ] Frontend running on :5173
- [ ] At least 2 sample cases pre-loaded (one VERIFIED, one IN_PROGRESS)
- [ ] Screen recording set to 1080p+
- [ ] Mic level tested (don't use laptop mic if possible)
- [ ] Browser zoom at 100% (don't pixelate the UI)
- [ ] Close all notifications / Slack / extra tabs
- [ ] Final cut < 5 minutes
