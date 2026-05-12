# Deployment Guide — Render (backend) + Vercel (frontend)

Both free tier. ~10 minutes end-to-end.

---

## Step 1 — Deploy the backend on Render

1. Open [render.com](https://render.com) → **Sign up with GitHub** (use your personal `sandeepjetwani` account)
2. After signup, click **New** → **Blueprint**
3. Select the **`voice-bgv-bolna`** repo
4. Render auto-detects `render.yaml` → click **Apply**
5. Service created. Now click into the service → **Environment** tab → set these 2 secrets:
   - `BOLNA_API_KEY` = `<your bolna key from local .env>`
   - `BOLNA_API_KEY` is needed first; the other two (`BOLNA_AGENT_ID` and `BACKEND_WEBHOOK_URL`) we set after we know the URL
6. Wait for the first deploy to finish (~2 min). You'll see a URL like `https://voice-bgv-backend.onrender.com`
7. **Copy that URL** — that's your permanent backend URL.

### Step 1.5 — Point the Bolna agent at the new URL

The agent's webhook still points at the (now dead) cloudflare tunnel. Recreate locally:

```bash
cd /Users/sandeepjetwani/equal/study/bolna-bgv-assignment/backend

# Update .env: set BACKEND_WEBHOOK_URL to the Render URL + /webhook/bolna
# e.g.  BACKEND_WEBHOOK_URL=https://voice-bgv-backend.onrender.com/webhook/bolna

npm run create-agent
# Copy the new agent_id
```

Now in Render Environment tab, set:
- `BOLNA_AGENT_ID` = `<new agent_id from above>`
- `BACKEND_WEBHOOK_URL` = `https://voice-bgv-backend.onrender.com/webhook/bolna`

Render auto-redeploys when env vars change.

---

## Step 2 — Deploy the frontend on Vercel

1. Open [vercel.com](https://vercel.com) → **Sign up with GitHub** (same personal account)
2. Click **Add New** → **Project**
3. Import the **`voice-bgv-bolna`** repo
4. In the import screen:
   - **Root directory:** `frontend`
   - **Framework preset:** Vite (auto-detected from `vercel.json`)
5. Click **Environment Variables** and add:
   - `VITE_API_URL` = `https://voice-bgv-backend.onrender.com` (your Render URL, NO trailing slash, NO /api)
6. Click **Deploy**
7. ~1 min later you have a URL like `https://voice-bgv-bolna.vercel.app`

---

## Step 3 — Verify end-to-end

1. Open `https://voice-bgv-bolna.vercel.app` (your Vercel URL)
2. You should see the dashboard with the pre-seeded "Priya Iyer" case
3. Click **New Verification**, use your verified phone, trigger
4. The call should ring → agent → extraction → dashboard updates in real-time

If the demo case shows but no live updates: the `VITE_API_URL` env var in Vercel is wrong or the Render backend is sleeping (free tier sleeps after 15 min idle — first request wakes it up, may take 30 sec).

---

## Step 4 — Use the deployed URLs in your submission

- **Deployed link (frontend):** `https://voice-bgv-bolna.vercel.app`
- **GitHub repo:** `https://github.com/sandeepjetwani/voice-bgv-bolna`
- Both go into the Bolna submission form.

---

## Notes on the Render free tier

- Backend sleeps after 15 minutes of inactivity. First request after sleep takes ~30 seconds to wake up.
- During the demo recording, hit the backend URL once at the start to wake it up before showing the dashboard.
- 750 free hours/month — plenty for a demo.

## Notes on the Vercel free tier

- No sleep, always-on.
- Auto-deploys when you push to `main` on GitHub.
