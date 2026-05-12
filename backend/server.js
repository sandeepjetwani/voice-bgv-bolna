import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";

const PORT = process.env.PORT || 3001;
const BOLNA_API_KEY = process.env.BOLNA_API_KEY;
const BOLNA_AGENT_ID = process.env.BOLNA_AGENT_ID;
const BOLNA_API_URL = process.env.BOLNA_API_URL || "https://api.bolna.dev/v1/call";
const BGV_COMPANY_NAME = process.env.BGV_COMPANY_NAME || "Equal Identity";

const app = express();
app.use(cors());
app.use(express.json());

// In-memory store
const cases = new Map();        // caseId -> caseData
const events = new Map();       // caseId -> [event, ...]

// Seed with one demo case so the dashboard isn't empty
seedDemoCase();

function seedDemoCase() {
  const caseId = "demo-case-1";
  cases.set(caseId, {
    id: caseId,
    candidate_name: "Priya Iyer",
    ex_employer: "Sunrise Logistics Pvt Ltd",
    hr_phone: "+91 98765 12345",
    claimed: {
      designation: "Operations Lead",
      start_date: "2021-09-01",
      end_date: "2024-03-30",
    },
    status: "VERIFIED",
    created_at: new Date(Date.now() - 3600_000).toISOString(),
    call_id: "demo_call_1",
  });
  events.set(caseId, [
    evt("call_started", caseId),
    evt("hr_contact_confirmed", caseId, { hr_name: "Anita Desai", hr_designation: "HR Manager" }),
    evt("employment_confirmed", caseId, { confirmed: "yes" }),
    evt("dates_captured", caseId, { joining_date: "2021-09-06", exit_date: "2024-04-02" }),
    evt("designation_captured", caseId, { actual_designation: "Operations Lead" }),
    evt("exit_details_captured", caseId, { exit_type: "voluntary", rehire_eligible: "yes" }),
    evt("call_completed", caseId, { duration_seconds: 187 }),
  ]);
}

function evt(event, caseId, data = {}) {
  return {
    event,
    case_id: caseId,
    call_id: cases.get(caseId)?.call_id || null,
    timestamp: new Date().toISOString(),
    data,
  };
}

function withinDays(a, b, days) {
  if (!a || !b) return false;
  const diff = Math.abs(new Date(a) - new Date(b));
  return diff <= days * 24 * 60 * 60 * 1000;
}

function stringOverlap(a, b) {
  if (!a || !b) return false;
  const x = String(a).toLowerCase();
  const y = String(b).toLowerCase();
  return x.includes(y) || y.includes(x);
}

// Verification scoring logic — runs whenever events change
function computeStatus(caseData, eventList) {
  const names = eventList.map((e) => e.event);

  if (
    names.includes("verification_declined") ||
    names.includes("wrong_number") ||
    names.includes("call_timeout")
  ) {
    return "UNVERIFIABLE";
  }

  if (!names.includes("call_completed")) {
    return names.includes("call_started") ? "IN_PROGRESS" : "INITIATED";
  }

  // Merge all captured data from events
  const captured = {};
  for (const e of eventList) {
    Object.assign(captured, e.data);
  }

  if (captured.confirmed === "no") return "DISCREPANCY";
  if (captured.confirmed === "unsure") return "UNVERIFIABLE";

  const claimed = caseData.claimed || {};
  const datesOk =
    withinDays(captured.joining_date, claimed.start_date, 30) &&
    withinDays(captured.exit_date, claimed.end_date, 30);
  const designationOk = stringOverlap(captured.actual_designation, claimed.designation);

  return datesOk && designationOk ? "VERIFIED" : "DISCREPANCY";
}

// POST /api/trigger — create case + initiate Bolna call (or mock)
app.post("/api/trigger", async (req, res) => {
  const { candidate_name, ex_employer, hr_phone, claimed } = req.body;

  if (!candidate_name || !ex_employer || !hr_phone) {
    return res.status(400).json({ error: "missing required fields: candidate_name, ex_employer, hr_phone" });
  }

  const caseId = uuidv4();
  const caseData = {
    id: caseId,
    candidate_name,
    ex_employer,
    hr_phone,
    claimed: claimed || {},
    status: "INITIATED",
    created_at: new Date().toISOString(),
    call_id: null,
  };

  cases.set(caseId, caseData);
  events.set(caseId, [evt("call_started", caseId)]);

  // Trigger the real Bolna call if configured, otherwise stay in mock mode
  try {
    if (BOLNA_API_KEY && BOLNA_AGENT_ID) {
      const response = await fetch(BOLNA_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${BOLNA_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agent_id: BOLNA_AGENT_ID,
          recipient_phone_number: hr_phone,
          user_data: {
            case_id: caseId,
            bgv_company: BGV_COMPANY_NAME,
            candidate_name,
            ex_employer,
            claimed_designation: claimed?.designation || "",
            claimed_start: claimed?.start_date || "",
            claimed_end: claimed?.end_date || "",
          },
        }),
      });

      const bolnaBody = await response.text();
      if (!response.ok) {
        console.error(`Bolna call API ${response.status}:`, bolnaBody);
        throw new Error(`Bolna API ${response.status}: ${bolnaBody}`);
      }
      const data = JSON.parse(bolnaBody);
      caseData.call_id = data.execution_id || data.call_id || null;
    } else {
      caseData.call_id = `mock_${caseId.slice(0, 8)}`;
      console.log(`[MOCK MODE] Would have called ${hr_phone} via Bolna agent`);
    }

    caseData.status = "IN_PROGRESS";
    cases.set(caseId, caseData);
    res.json(caseData);
  } catch (err) {
    console.error("Bolna trigger failed:", err);
    caseData.status = "TRIGGER_FAILED";
    cases.set(caseId, caseData);
    res.status(502).json({ error: "failed to initiate call", case: caseData });
  }
});

// POST /webhook/bolna — receive call-status updates from Bolna
//
// Bolna posts the full execution object here at every status change:
// scheduled → queued → in-progress → completed.
// Schema: see GET /executions/{id}.
//
// We also keep backward-compat with our simulator payload
// ({ event, case_id, data }) so Path A still works.
app.post("/webhook/bolna", (req, res) => {
  const body = req.body || {};
  console.log(`[webhook] received: status=${body.status || body.event || "?"} call_id=${body.id || body.call_id || "?"}`);

  // ---- Simulator path (Path A) ----
  if (body.event && body.case_id) {
    const { event, case_id, call_id, timestamp, data } = body;
    const list = events.get(case_id) || [];
    list.push({
      event,
      case_id,
      call_id: call_id || null,
      timestamp: timestamp || new Date().toISOString(),
      data: data || {},
    });
    events.set(case_id, list);
    const c = cases.get(case_id);
    if (c) {
      c.status = computeStatus(c, list);
      cases.set(case_id, c);
    }
    return res.json({ ok: true });
  }

  // ---- Real Bolna path (Path B) ----
  // Bolna's execution payload — find the case by call_id (execution_id)
  const callId = body.id || body.execution_id;
  if (!callId) return res.status(200).json({ ok: true, note: "no call_id" });

  const caseEntry = Array.from(cases.values()).find((c) => c.call_id === callId);
  if (!caseEntry) {
    console.log(`[webhook] no case for call_id ${callId}`);
    return res.status(200).json({ ok: true, note: "case not found" });
  }

  const list = events.get(caseEntry.id) || [];

  // Map Bolna status → our event names so the timeline reads nicely
  const status = body.status; // scheduled | queued | in-progress | completed
  const eventName = status === "in-progress" ? "call_started"
    : status === "completed" ? "call_completed"
    : status === "queued" ? "call_queued"
    : status === "scheduled" ? "call_scheduled"
    : `bolna_${status}`;

  list.push({
    event: eventName,
    case_id: caseEntry.id,
    call_id: callId,
    timestamp: new Date().toISOString(),
    data: {
      duration_seconds: body.conversation_duration,
      transcript: body.transcript,
      summary: body.summary,
      extracted_data: body.extracted_data || body.agent_extraction || body.custom_extractions,
      total_cost: body.total_cost,
    },
  });
  events.set(caseEntry.id, list);

  // Update case status based on Bolna lifecycle
  if (status === "completed") {
    // Bolna's extracted_data is nested as: { category: { fieldName: { objective, subjective, confidence } } }
    const bucket = (body.extracted_data || {})["BGV Verification"] || {};
    const fieldValue = (key) => {
      const cell = bucket[key];
      if (!cell) return undefined;
      return cell.objective || cell.subjective || undefined;
    };

    const confirmed = fieldValue("Employment Confirmed") || "yes";
    const joining_date = fieldValue("Joining Date");
    const exit_date = fieldValue("Exit Date");
    const actual_designation = fieldValue("Actual Designation");
    const exit_type = fieldValue("Exit Type");
    const rehire_eligible = fieldValue("Rehire Eligible");
    const hr_name = fieldValue("HR Name");
    const hr_designation = fieldValue("HR Designation");

    if (hr_name || hr_designation) {
      list.push({
        event: "hr_contact_confirmed",
        case_id: caseEntry.id,
        call_id: callId,
        timestamp: new Date().toISOString(),
        data: { hr_name, hr_designation },
      });
    }

    list.push({
      event: "employment_confirmed",
      case_id: caseEntry.id,
      call_id: callId,
      timestamp: new Date().toISOString(),
      data: { confirmed },
    });
    if (joining_date || exit_date) {
      list.push({
        event: "dates_captured",
        case_id: caseEntry.id,
        call_id: callId,
        timestamp: new Date().toISOString(),
        data: { joining_date, exit_date },
      });
    }
    if (actual_designation) {
      list.push({
        event: "designation_captured",
        case_id: caseEntry.id,
        call_id: callId,
        timestamp: new Date().toISOString(),
        data: { actual_designation },
      });
    }
    if (exit_type || rehire_eligible) {
      list.push({
        event: "exit_details_captured",
        case_id: caseEntry.id,
        call_id: callId,
        timestamp: new Date().toISOString(),
        data: { exit_type, rehire_eligible },
      });
    }
    caseEntry.status = computeStatus(caseEntry, list);
  } else if (status === "in-progress") {
    caseEntry.status = "IN_PROGRESS";
  }

  cases.set(caseEntry.id, caseEntry);
  events.set(caseEntry.id, list);
  res.json({ ok: true });
});

// POST /api/simulate/:caseId/:event — fire a synthetic webhook (for demo without Bolna)
app.post("/api/simulate/:caseId/:event", (req, res) => {
  const { caseId, event } = req.params;
  if (!cases.has(caseId)) return res.status(404).json({ error: "case not found" });

  const list = events.get(caseId) || [];
  list.push({
    event,
    case_id: caseId,
    call_id: cases.get(caseId).call_id,
    timestamp: new Date().toISOString(),
    data: req.body || {},
  });
  events.set(caseId, list);

  const caseData = cases.get(caseId);
  caseData.status = computeStatus(caseData, list);
  cases.set(caseId, caseData);

  res.json({ ok: true, status: caseData.status });
});

// GET /api/cases — list all cases (newest first)
app.get("/api/cases", (req, res) => {
  const list = Array.from(cases.values()).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
  res.json(list);
});

// GET /api/cases/:id — single case with events timeline
app.get("/api/cases/:id", (req, res) => {
  const caseData = cases.get(req.params.id);
  if (!caseData) return res.status(404).json({ error: "case not found" });
  res.json({ ...caseData, events: events.get(req.params.id) || [] });
});

// Healthcheck
app.get("/", (req, res) => {
  res.json({
    service: "voice-bgv-backend",
    mode: BOLNA_API_KEY ? "live" : "mock",
    cases_count: cases.size,
  });
});

app.listen(PORT, () => {
  console.log(`Voice BGV backend running on http://localhost:${PORT}`);
  console.log(`Mode: ${BOLNA_API_KEY ? "live (Bolna API connected)" : "mock (no Bolna API key)"}`);
});
