import { useEffect, useState } from "react";
import {
  listCases,
  getCase,
  triggerVerification,
  simulateEvent,
  STATUS_COLORS,
} from "./api.js";

export default function App() {
  const [cases, setCases] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);

  // Poll cases list every 2s
  useEffect(() => {
    const tick = async () => setCases(await listCases());
    tick();
    const i = setInterval(tick, 2000);
    return () => clearInterval(i);
  }, []);

  // Poll selected case detail every 2s
  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }
    const tick = async () => setSelected(await getCase(selectedId));
    tick();
    const i = setInterval(tick, 2000);
    return () => clearInterval(i);
  }, [selectedId]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Voice BGV</h1>
          <p className="text-xs text-gray-500">Employment verification powered by Bolna AI</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-black text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800"
        >
          + New Verification
        </button>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-12 gap-6">
        <section className="col-span-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-700">
              Cases ({cases.length})
            </h2>
          </div>
          <CaseList cases={cases} selectedId={selectedId} onSelect={setSelectedId} />
        </section>

        <section className="col-span-7">
          {selected ? (
            <CaseDetail caseData={selected} />
          ) : (
            <div className="text-gray-400 text-center py-20 border border-dashed border-gray-200 rounded-lg">
              Select a case to view details
            </div>
          )}
        </section>
      </main>

      {showForm && (
        <TriggerModal
          onClose={() => setShowForm(false)}
          onCreated={async (c) => {
            setShowForm(false);
            setSelectedId(c.id);
          }}
        />
      )}
    </div>
  );
}

function CaseList({ cases, selectedId, onSelect }) {
  if (!cases.length) {
    return (
      <div className="border border-dashed border-gray-200 rounded-lg p-6 text-center text-gray-400 text-sm">
        No verification cases yet. Click "New Verification" to start.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {cases.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={`w-full text-left p-3 rounded-lg border transition ${
            selectedId === c.id
              ? "border-black bg-white"
              : "border-gray-200 bg-white hover:border-gray-400"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="font-medium text-sm">{c.candidate_name}</div>
            <StatusBadge status={c.status} />
          </div>
          <div className="text-xs text-gray-500">{c.ex_employer}</div>
          <div className="text-xs text-gray-400 mt-1">
            {new Date(c.created_at).toLocaleString()}
          </div>
        </button>
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  const cls = STATUS_COLORS[status] || "bg-gray-100 text-gray-700";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{status}</span>
  );
}

function CaseDetail({ caseData }) {
  const { id, candidate_name, ex_employer, hr_phone, claimed, status, events = [] } = caseData;
  const captured = events.reduce((acc, e) => ({ ...acc, ...e.data }), {});

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">{candidate_name}</h2>
          <p className="text-sm text-gray-500">{ex_employer}</p>
          <p className="text-xs text-gray-400 mt-1">{hr_phone}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <Field label="Claimed designation" value={claimed?.designation} />
        <Field label="Captured designation" value={captured.actual_designation} />
        <Field label="Claimed start" value={claimed?.start_date} />
        <Field label="Captured joining" value={captured.joining_date} />
        <Field label="Claimed end" value={claimed?.end_date} />
        <Field label="Captured exit" value={captured.exit_date} />
        <Field label="HR contact" value={captured.hr_name} />
        <Field label="Exit type" value={captured.exit_type} />
      </div>

      <SimulatorPanel caseId={id} status={status} />

      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Events timeline</h3>
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {events.length === 0 && (
            <div className="text-xs text-gray-400">No events yet.</div>
          )}
          {events.map((e, idx) => (
            <div key={idx} className="text-xs bg-gray-50 border border-gray-100 rounded px-2.5 py-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-gray-800">{e.event}</span>
                <span className="text-gray-400">
                  {new Date(e.timestamp).toLocaleTimeString()}
                </span>
              </div>
              {Object.keys(e.data || {}).length > 0 && (
                <pre className="mt-1 text-gray-500 text-[10px]">
                  {JSON.stringify(e.data, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="font-medium">{value || "—"}</div>
    </div>
  );
}

function SimulatorPanel({ caseId, status }) {
  const fired = (status === "VERIFIED" || status === "DISCREPANCY" || status === "UNVERIFIABLE");

  const simulate = async (event, data = {}) => {
    await simulateEvent(caseId, event, data);
  };

  if (fired) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded p-3">
      <div className="text-xs font-medium text-amber-800 mb-2">
        Simulator (fire webhook events without a real Bolna call)
      </div>
      <div className="flex flex-wrap gap-2">
        <SimBtn onClick={() => simulate("hr_contact_confirmed", { hr_name: "Anita Desai", hr_designation: "HR Manager" })}>
          HR contact
        </SimBtn>
        <SimBtn onClick={() => simulate("employment_confirmed", { confirmed: "yes" })}>
          Confirmed: yes
        </SimBtn>
        <SimBtn onClick={() => simulate("dates_captured", { joining_date: "2021-09-06", exit_date: "2024-04-02" })}>
          Dates match
        </SimBtn>
        <SimBtn onClick={() => simulate("dates_captured", { joining_date: "2019-01-15", exit_date: "2020-06-30" })}>
          Dates mismatch
        </SimBtn>
        <SimBtn onClick={() => simulate("designation_captured", { actual_designation: "Operations Lead" })}>
          Designation match
        </SimBtn>
        <SimBtn onClick={() => simulate("exit_details_captured", { exit_type: "voluntary", rehire_eligible: "yes" })}>
          Exit details
        </SimBtn>
        <SimBtn onClick={() => simulate("call_completed", { duration_seconds: 180 })}>
          Call completed
        </SimBtn>
        <SimBtn onClick={() => simulate("verification_declined", { reason: "policy" })}>
          Declined
        </SimBtn>
        <SimBtn onClick={() => simulate("call_timeout")}>Timeout</SimBtn>
      </div>
    </div>
  );
}

function SimBtn({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-xs bg-white border border-amber-300 text-amber-900 px-2.5 py-1 rounded hover:bg-amber-100"
    >
      {children}
    </button>
  );
}

function TriggerModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    candidate_name: "Rahul Sharma",
    ex_employer: "Acme Logistics Pvt Ltd",
    hr_phone: "+91 98765 12345",
    designation: "Senior Operations Manager",
    start_date: "2022-06-01",
    end_date: "2024-08-15",
  });
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      candidate_name: form.candidate_name,
      ex_employer: form.ex_employer,
      hr_phone: form.hr_phone,
      claimed: {
        designation: form.designation,
        start_date: form.start_date,
        end_date: form.end_date,
      },
    };
    const created = await triggerVerification(payload);
    setSubmitting(false);
    onCreated(created);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <form onSubmit={submit} className="bg-white rounded-lg w-full max-w-md p-6 space-y-3">
        <h2 className="text-lg font-semibold">New verification</h2>
        <Input label="Candidate name" value={form.candidate_name} onChange={(v) => setForm({ ...form, candidate_name: v })} />
        <Input label="Ex-employer" value={form.ex_employer} onChange={(v) => setForm({ ...form, ex_employer: v })} />
        <Input label="HR phone" value={form.hr_phone} onChange={(v) => setForm({ ...form, hr_phone: v })} />
        <Input label="Claimed designation" value={form.designation} onChange={(v) => setForm({ ...form, designation: v })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Start date" value={form.start_date} onChange={(v) => setForm({ ...form, start_date: v })} type="date" />
          <Input label="End date" value={form.end_date} onChange={(v) => setForm({ ...form, end_date: v })} type="date" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-sm rounded border border-gray-200">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-sm rounded bg-black text-white disabled:opacity-50"
          >
            {submitting ? "Triggering…" : "Trigger Call"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Input({ label, value, onChange, type = "text" }) {
  return (
    <div>
      <label className="text-xs text-gray-500">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-black"
      />
    </div>
  );
}
