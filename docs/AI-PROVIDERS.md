# Free AI providers for GitTidy

**Status: implemented.** GitTidy now calls **Gemini first** and falls back to
OpenRouter. This document explains why, and what the remaining options are.

Setup instructions live in [`GEMINI-SETUP.md`](./GEMINI-SETUP.md). Removing
`GEMINI_API_KEY` restores the previous OpenRouter-only behaviour exactly.

## Why OpenRouter alone was flaky

The original code sent one request to whatever `OPENROUTER_MODEL` named,
defaulting to `baidu/cobuddy:free`. OpenRouter's `:free` tier is a **shared pool**
across every OpenRouter user, which produces three distinct failure modes:

| Failure | What the user saw before | What happens now |
| --- | --- | --- |
| Pool is rate limited (429) | Hard failure, generic error banner | Retried with backoff, then the next free model in the chain |
| Model is offline / swapped out (5xx) | Hard failure | Falls through to the next model |
| Model ignores "JSON only" and adds prose | "Could not parse the AI response" + a raw dump | `response_format: json_object` requested; three-tier lenient parser retained |

The old system prompt repeated "return ONLY JSON, no backticks, no markdown"
three separate times, and the parser had a three-stage fallback. That is strong
evidence the free model routinely disobeyed the format — the code was written
around observed flakiness, not a hypothetical one.

## What changed (still zero cost)

Gemini's free tier replaced OpenRouter as the first choice, and the retry
machinery below now applies across both providers:

- **Retry with backoff** on 429/408/5xx and timeouts.
- **Fallback chain** via `OPENROUTER_FALLBACK_MODELS` (comma-separated). Every
  entry should be a `:free` model, so the chain never costs money.
- **`response_format: { type: 'json_object' }`** — honoured by models that
  support it, harmlessly ignored by those that do not.
- **Metadata-only mode** — "Suggest description + topics only" skips README
  generation. Far fewer output tokens, so it succeeds when a full README call
  would be throttled. This is the single biggest practical reliability win.
- **Distinct error messages** — a timeout, an unreachable host and a rate limit
  now read differently instead of all claiming "did not respond before the
  timeout".

Suggested fallback `.env` values:

```env
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free
OPENROUTER_FALLBACK_MODELS=google/gemma-2-9b-it:free,mistralai/mistral-7b-instruct:free
```

Check <https://openrouter.ai/models?max_price=0> for models currently free —
the list changes without notice, which is the core problem with relying on it.

## Ranked free alternatives

### 1. Google AI Studio (Gemini) — **now the default**

The strongest free tier available. Roughly **1,500 requests/day** and ~15/min on
Flash models, a 1M-token context window, no credit card, and first-class
structured output via `responseSchema` — the model is constrained to your schema
rather than asked politely to comply. That single feature removes the entire
class of "model returned prose instead of JSON" bugs.

- **Why it fits GitTidy:** README generation is a single-shot, schema-shaped
  task. Guaranteed-valid JSON means the three-tier parser becomes a safety net
  rather than a load-bearing component.
- **Caveat:** Google cut free quotas in late 2025. Confirm current limits at
  <https://ai.google.dev> before depending on the numbers above.
- **Implemented in** `api/_lib/providers.ts`. GitTidy sends a `responseSchema`
  with `responseMimeType: application/json`, so the model is structurally
  constrained to the expected object.

### 2. Groq — best when latency matters

~30 requests/min, ~1,000/day on Llama 3.3 70B, served at 300+ tokens/second —
by far the fastest option, so a README appears near-instantly. Structured
Outputs are supported and **enabled by default**, using the same OpenAI-shaped
`response_format: { type: 'json_schema' }` GitTidy already sends.

- **Why it fits:** the API is OpenAI-compatible, so switching is largely a base
  URL and key change.
- **Caveat:** the daily cap is lower than Gemini's. Best as the *second* link in
  a chain rather than the primary.

### 3. Cerebras — best raw daily volume

**1M tokens/day** free, no credit card, up to ~2,000 tokens/second. Structured
Outputs supported via `response_format: { type: 'json_schema', strict: true }`.

- **Caveat:** from **21 July 2026**, Cerebras enforces strict schema validation
  and rejects non-conforming schemas outright. Any schema must be written to the
  supported JSON Schema subset.

### Not recommended: GitHub Models

Superficially attractive — users are already authenticated with GitHub, so it
looks like a free ride on an existing token. Rule it out:

- **It closed to new customers in June 2026 and is being retired**, with users
  pushed to Azure AI Foundry or Copilot's metered API.
- Limits were tight anyway: ~50 requests/day on high-tier models, ~10/min, with
  an 8K input / 4K output ceiling that a 7,000-character README would strain.

## Current chain

```
Gemini (schema-enforced)           ← GEMINI_API_KEY
  └─ 429/5xx/timeout → next Gemini model
       └─ still failing → OpenRouter free pool   ← OPENROUTER_API_KEY
            └─ 429/5xx → next free OpenRouter model
```

Each provider exposes a list of models; `createCompletion` in `api/generate.ts`
walks providers, then models within each, retrying transient failures once with
backoff. A parse failure skips straight to the next model, since the same model
will not suddenly learn the format.

The UI reports which model answered, so a silent fallback is visible.

## The remaining endgame

Free tiers have **independent** rate limits, so routing across providers
multiplies free capacity. The most robust zero-cost architecture is a provider
chain, not a model chain:

```
Gemini Flash (schema-enforced)
  └─ 429/5xx → Groq (schema-enforced, very fast)
       └─ 429/5xx → Cerebras (high daily volume)
            └─ 429/5xx → OpenRouter free pool (current behaviour)
```

The retry-and-fallback scaffolding for this already exists in
`createCompletion()` in `api/generate.ts`; it currently walks a list of model
names against one provider. Generalising it to walk a list of *providers* — each
with its own base URL, key and schema dialect — is a contained change to that
one function.

Step 1 of that chain is done. Adding Groq or Cerebras now means writing one
more `Provider` object in `api/_lib/providers.ts` and appending it to
`resolveProviders()` — no changes to `generate.ts` at all.

**Do this only if Gemini's quota turns out to be a real constraint.** Two
providers is already ample for a personal tool, and each extra link is another
API surface to keep working.

## Sources

- [Free LLM API in 2026: 13 Options Ranked and Compared — OpenRouter](https://openrouter.ai/blog/tutorials/free-llm-apis-compared/)
- [Best Free LLM API Tiers in 2026: Groq, Cerebras, GitHub Models & More](https://wetheflywheel.com/en/ai-model-access/free-llm-api-tiers-2026/)
- [Free LLM API Tiers in 2026: Groq, Cerebras, Mistral & More](https://ianlpaterson.com/blog/free-llm-api-2026/)
- [Structured Outputs — Cerebras Inference](https://inference-docs.cerebras.ai/capabilities/structured-outputs)
- [Structured Outputs — GroqDocs](https://console.groq.com/docs/structured-outputs)
- [GitHub Models Free API — Status, Models & Rate Limits](https://free-llm-apis.pages.dev/providers/github-models/)
