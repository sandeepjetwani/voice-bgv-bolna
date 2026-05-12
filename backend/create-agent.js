// Creates the BGV voice agent on Bolna via their API.
//
// Usage:
//   1. Set BOLNA_API_KEY and BACKEND_WEBHOOK_URL in .env
//      (BACKEND_WEBHOOK_URL = your deployed backend + /webhook/bolna)
//   2. Run: node create-agent.js
//   3. Copy the printed agent_id into your .env as BOLNA_AGENT_ID
//
// Reference: https://www.bolna.ai/docs/api-reference/agent/v2/create

const BOLNA_API_HOST = process.env.BOLNA_API_HOST || "https://api.bolna.dev";
const BOLNA_API_KEY = process.env.BOLNA_API_KEY;
const BACKEND_WEBHOOK_URL = process.env.BACKEND_WEBHOOK_URL;
const BGV_COMPANY_NAME = process.env.BGV_COMPANY_NAME || "Equal Identity";

if (!BOLNA_API_KEY) {
  console.error("Missing BOLNA_API_KEY in env");
  process.exit(1);
}
if (!BACKEND_WEBHOOK_URL) {
  console.error("Missing BACKEND_WEBHOOK_URL in env (e.g. https://your-app.onrender.com/webhook/bolna)");
  process.exit(1);
}

const systemPrompt = `You are a polite, professional employment verification agent calling on behalf of ${BGV_COMPANY_NAME}.

CONTEXT (passed as call variables):
- Candidate name: {candidate_name}
- Claimed employer: {ex_employer}
- Claimed designation: {claimed_designation}
- Claimed dates: {claimed_start} to {claimed_end}

CALL SCRIPT — ask ONE question at a time, conversationally. Never sound robotic.

1. OPENING
   "Namaste, this is calling from ${BGV_COMPANY_NAME}. I'm doing a quick employment verification. Am I speaking with someone from HR or admin at {ex_employer}?"
   - If not HR/admin: politely ask to be transferred.
   - If HR/admin: continue.

2. IDENTIFY CONTACT
   "May I have your name and designation, please?"
   → Capture hr_name and hr_designation, then fire webhook event "hr_contact_confirmed" with that data.

3. CONFIRM EMPLOYMENT
   "I'm calling regarding {candidate_name}. Can you confirm if they worked at {ex_employer}?"
   → Capture confirmed (yes / no / unsure), fire webhook event "employment_confirmed" with { confirmed }.
   - If confirmed is "no" or "unsure", skip to step 7.

4. DATES
   "Could you confirm their joining date and last working date?"
   → Capture joining_date and exit_date in YYYY-MM-DD format, fire webhook event "dates_captured".

5. DESIGNATION
   "What was their last designation at the company?"
   → Capture actual_designation, fire webhook event "designation_captured".

6. EXIT DETAILS
   "Was their exit voluntary? And would they be eligible for rehire?"
   → Capture exit_type (voluntary / terminated / other) and rehire_eligible (yes / no), fire webhook event "exit_details_captured".

7. CLOSING
   "Thank you for your time. Have a good day."
   → Fire webhook event "call_completed".

LANGUAGE: Default to English. If HR responds in Hindi, Tamil, Kannada, Bengali or any other Indian language, switch to that language and continue the script naturally.

TONE: Polite, brief, respectful of their time. One question at a time. No robotic phrasing.

ERROR HANDLING:
- If HR refuses to verify: thank them politely, end the call, fire webhook event "verification_declined" with { reason }.
- If wrong number / no one by that name: apologize, end the call, fire webhook event "wrong_number".
- If 30 seconds of silence: end the call, fire webhook event "call_timeout".

EVERY webhook event payload must include: { event, case_id (passed in context), call_id, timestamp, data }.`;

// Disposition IDs created by create-dispositions.js — these run extraction on
// the call transcript and return structured fields in extracted_data.
const DISPOSITION_IDS = [
  "3ac47e01-5377-4423-b18a-23ffe9ec8605", // Employment Confirmed
  "a0ad1562-5462-4478-9338-59a40e928e1f", // Joining Date
  "c0268e82-da2c-4ca7-b645-a6e127f4a9b5", // Exit Date
  "8dbb1a30-4e9f-498c-8960-fee9303be24e", // Actual Designation
  "99d28b8c-4fe3-403a-9d71-0ebcd91452b5", // Exit Type
  "3c2f6eeb-9293-4fde-9943-283b2b8c6e50", // Rehire Eligible
  "67f3c293-57ab-472f-8eec-da69b59d9ab1", // HR Name
  "00a1a290-0d7d-4314-b7a9-e95f1b26a78f", // HR Designation
];

const agentConfig = {
  agent_config: {
    agent_name: "BGV Employment Verifier",
    agent_welcome_message: `Namaste, this is calling from ${BGV_COMPANY_NAME} for an employment verification. Do you have a quick minute?`,
    agent_type: "other",
    webhook_url: BACKEND_WEBHOOK_URL,
    dispositions: DISPOSITION_IDS,
    tasks: [
      {
        task_type: "conversation",
        toolchain: {
          execution: "sequential",
          pipelines: [["transcriber", "llm", "synthesizer"]],
        },
        tools_config: {
          llm_agent: {
            agent_type: "simple_llm_agent",
            agent_flow_type: "streaming",
            llm_config: {
              provider: "openai",
              model: "gpt-4.1-mini",
              temperature: 0.2,
              max_tokens: 150,
              top_p: 0.9,
            },
          },
          synthesizer: {
            provider: "elevenlabs",
            provider_config: {
              voice: "Anika - Customer Care Agent",
              voice_id: "90ipbRoKi4CpHXvKVtl0",
              model: "eleven_turbo_v2_5",
            },
            stream: true,
            buffer_size: 250,
            audio_format: "wav",
          },
          transcriber: {
            provider: "deepgram",
            model: "nova-3",
            language: "en",
            stream: true,
            sampling_rate: 16000,
          },
          input: { provider: "plivo", format: "wav" },
          output: { provider: "plivo", format: "wav" },
        },
        task_config: {
          hangup_after_silence: 10,
          incremental_delay: 400,
          number_of_words_for_interruption: 2,
          call_terminate: 180,
          voicemail: false,
          backchanneling: false,
        },
      },
    ],
  },
  agent_prompts: {
    task_1: { system_prompt: systemPrompt },
  },
};

async function main() {
  console.log(`Creating agent on ${BOLNA_API_HOST}/v2/agent...`);
  const res = await fetch(`${BOLNA_API_HOST}/v2/agent`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${BOLNA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(agentConfig),
  });

  const body = await res.text();
  if (!res.ok) {
    console.error(`Bolna API ${res.status}:`, body);
    process.exit(1);
  }

  const data = JSON.parse(body);
  console.log("\nAgent created successfully.");
  console.log("agent_id:", data.agent_id || data.id || JSON.stringify(data));
  console.log("\nNext steps:");
  console.log("  1. Copy the agent_id above into your .env as BOLNA_AGENT_ID");
  console.log("  2. Restart the backend (npm run dev) so it picks up the new env var");
  console.log("  3. Trigger a verification from the dashboard — Bolna will now make a real call");
}

main().catch((err) => {
  console.error("Failed to create agent:", err);
  process.exit(1);
});
