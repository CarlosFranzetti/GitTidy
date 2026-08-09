# Getting a Gemini API key (from your phone)

GitTidy now tries **Google Gemini first** and falls back to OpenRouter. You need
a free Gemini key for that first path. It takes about two minutes on a phone,
needs no credit card, and costs nothing.

If you skip this entirely, GitTidy still works — it just uses OpenRouter, as
before.

---

## Step 1 — Get the key

1. Open **<https://aistudio.google.com/apikey>** in your phone browser.
2. Sign in with a Google account.
3. Accept the terms if prompted.
4. Tap **Create API key**.
5. If it asks which project, pick any existing one, or tap **Create API key in
   new project**.
6. Tap the **copy** icon next to the key. It looks like `AIzaSy…` and is about
   39 characters.

**Copy it now — Google will not show the full key again.** Paste it somewhere
safe (a note or password manager) before moving on.

Do not put the key in a GitHub issue, a commit, or a screenshot. It is a
password.

---

## Step 2 — Add it to Vercel

1. Open **<https://vercel.com/dashboard>** and sign in.
2. Tap the **git-tidy** project.
3. Tap **Settings** (you may need the **⋯** menu on a narrow screen).
4. Tap **Environment Variables**.
5. Add:
   - **Key:** `GEMINI_API_KEY`
   - **Value:** paste the key
   - **Environments:** tick **Production**, **Preview** and **Development**
6. Tap **Save**.

---

## Step 3 — Redeploy

Environment variables only apply to **new** deployments.

1. Tap **Deployments** in the project.
2. On the most recent one, tap **⋯** → **Redeploy** → **Redeploy**.

Wait for it to finish, then open the app and generate a README. Under the
preview it will say **"Drafted by gemini/gemini-2.5-flash"** — that confirms
Gemini is being used. If it names an OpenRouter model instead, Gemini was
skipped or failed and the fallback took over.

---

## Optional settings

| Variable | Purpose |
| --- | --- |
| `GEMINI_MODEL` | Override the model, e.g. `gemini-2.0-flash` |
| `GEMINI_FALLBACK_MODELS` | Comma-separated models to try if the first fails |

Model names change over time. If every generation falls through to OpenRouter,
the configured Gemini model probably no longer exists — check the current list
at <https://ai.google.dev/gemini-api/docs/models> and set `GEMINI_MODEL`.

---

## Free tier

Roughly **1,500 requests/day** and ~15/minute on Flash models, with no card
required. That is far more than GitTidy needs — vastly more headroom than
OpenRouter's shared free pool.

Google reduced free quotas in late 2025, so confirm current limits at
<https://ai.google.dev/gemini-api/docs/rate-limits> before depending on exact
numbers.

---

## Why Gemini is the default now

Gemini supports **schema-enforced JSON**: GitTidy sends a `responseSchema` and
the model is structurally constrained to match it. It cannot reply with prose,
an apology, or a markdown code fence.

That removes the entire failure class the old code was built around — the
triple-repeated "return ONLY JSON" instruction and the three-tier fallback
parser existed because free OpenRouter models routinely ignored the format.
Those defences are still in place for the fallback path, but on Gemini they
should never fire.

## If something goes wrong

| Symptom | Cause | Fix |
| --- | --- | --- |
| Still says "Drafted by …:free" | Key missing or not redeployed | Re-check step 2, then redeploy |
| "Gemini rejected … (400)" | Invalid model name | Set `GEMINI_MODEL` to a current model |
| "Gemini rejected … (403)" | Key invalid or API not enabled | Create a fresh key in AI Studio |
| "Gemini rejected … (429)" | Daily quota reached | Wait, or let it fall back to OpenRouter |
| "Gemini stopped early (SAFETY)" | Repo content tripped a filter | Use "description + topics only", or edit the README manually |
