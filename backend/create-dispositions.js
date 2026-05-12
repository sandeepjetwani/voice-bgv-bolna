// Creates Bolna dispositions (post-call extractions) for the BGV agent.
//
// Bolna runs each disposition's prompt against the call transcript after every
// call and returns the result under `extracted_data[category][name]` in the
// webhook payload.
//
// Run: npm run create-dispositions
// (requires BOLNA_API_KEY in .env)

const BOLNA_API_HOST = process.env.BOLNA_API_HOST || "https://api.bolna.ai";
const BOLNA_API_KEY = process.env.BOLNA_API_KEY;

if (!BOLNA_API_KEY) {
  console.error("Missing BOLNA_API_KEY in env");
  process.exit(1);
}

const CATEGORY = "BGV Verification";

const dispositions = [
  {
    name: "Employment Confirmed",
    category: CATEGORY,
    question: "Did the HR confirm that the candidate worked at the company mentioned in the call?",
    model: "gpt-4.1-mini",
    is_subjective: false,
    is_objective: true,
    objective_options: [
      { value: "yes", condition: "HR clearly confirmed the candidate worked at the company" },
      { value: "no", condition: "HR clearly stated the candidate did not work at the company" },
      { value: "unsure", condition: "HR could not confirm or expressed uncertainty about the candidate" },
    ],
  },
  {
    name: "Joining Date",
    category: CATEGORY,
    question: "When did the candidate join the company? Return the date in YYYY-MM-DD format if mentioned, or empty if not provided.",
    model: "gpt-4.1-mini",
    is_subjective: true,
    is_objective: false,
    subjective_type: "text",
  },
  {
    name: "Exit Date",
    category: CATEGORY,
    question: "When did the candidate leave the company? Return the date in YYYY-MM-DD format if mentioned, or empty if not provided.",
    model: "gpt-4.1-mini",
    is_subjective: true,
    is_objective: false,
    subjective_type: "text",
  },
  {
    name: "Actual Designation",
    category: CATEGORY,
    question: "What was the candidate's last designation or job title at the company according to the HR? Return just the title text, or empty if not mentioned.",
    model: "gpt-4.1-mini",
    is_subjective: true,
    is_objective: false,
    subjective_type: "text",
  },
  {
    name: "Exit Type",
    category: CATEGORY,
    question: "How did the candidate exit the company?",
    model: "gpt-4.1-mini",
    is_subjective: false,
    is_objective: true,
    objective_options: [
      { value: "voluntary", condition: "HR mentioned the candidate resigned or left voluntarily" },
      { value: "terminated", condition: "HR mentioned the candidate was terminated or fired" },
      { value: "unknown", condition: "Exit type was not discussed or unclear" },
    ],
  },
  {
    name: "Rehire Eligible",
    category: CATEGORY,
    question: "Would the candidate be eligible for rehire according to the HR?",
    model: "gpt-4.1-mini",
    is_subjective: false,
    is_objective: true,
    objective_options: [
      { value: "yes", condition: "HR indicated candidate is eligible for rehire" },
      { value: "no", condition: "HR indicated candidate is not eligible for rehire" },
      { value: "unknown", condition: "Rehire eligibility not discussed" },
    ],
  },
];

async function createOne(d) {
  const res = await fetch(`${BOLNA_API_HOST}/dispositions/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${BOLNA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(d),
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`Failed to create "${d.name}": ${res.status} ${body}`);
    return null;
  }
  const parsed = JSON.parse(body);
  console.log(`Created disposition: ${d.name}  id=${parsed.id || parsed.disposition_id || "?"}`);
  return parsed;
}

async function main() {
  console.log(`Creating ${dispositions.length} dispositions on ${BOLNA_API_HOST}...\n`);
  for (const d of dispositions) {
    await createOne(d);
  }
  console.log("\nDone. Next call will have extracted_data populated under category 'BGV Verification'.");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
