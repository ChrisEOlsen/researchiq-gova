# App Specification

> Fill this in before running `/build`. The AI will use this as the source of truth for brainstorming and implementation.

## App Name
ResearchIQ

## What Does It Do?
ResearchIQ is an evidence-based health and wellness research tool for personal trainers, nutritionists, and health coaches. A user types any health question (e.g. "Is the sauna good for your heart?"), and the app runs a multi-phase AI pipeline: an LLM with tool-calling searches PubMed for peer-reviewed studies, filters for relevance, then synthesizes a plain-language summary, key takeaways, follow-up Q&A, and a self-contained HTML visual explainer — all stored as a research result the user can revisit and share.

**Why we're migrating off GOTHA:** The current live version (`~/Desktop/repos/researchiq-gotha`, Go + Templ + HTMX + Alpine.js) turned out over-engineered and bug-prone in practice — three templating/interactivity layers (Templ, HTMX, Alpine) doing overlapping jobs, most pages actually styled with inline `style=""` attributes rather than the Tailwind setup that's nominally present, and several real inconsistencies found in a full code audit (listed under **Known Bugs to Fix** below). GOVA's plain JSON API + vanilla JS + `api.js`/`auth.js` model is a strict simplification: one rendering approach, one way to call the backend, no templating engine to keep in sync with hand-rolled HTML fragments.

**This is a live product.** Treat `~/Desktop/repos/researchiq-gotha` as **read-only** — copy and read from it freely, but never edit or delete anything in that repo or its `data/app.db`. Its SQLite database holds real users, credits, and research history that must be migrated into the new app (see **Data Migration** below).

---

## Source Reference — Read-Only GOTHA Implementation

> Canonical source of truth for business logic, prompts, schema, and edge cases. Adapt to GOVA's JSON-API/vanilla-JS architecture — do not port HTMX/Templ/Alpine mechanics literally. **Read-only — copy, never edit.**

| What | GOTHA Source Path |
|---|---|
| Research pipeline orchestration | `~/Desktop/repos/researchiq-gotha/src/app/pipeline/pipeline.go` |
| PubMed search + XML parsing | `~/Desktop/repos/researchiq-gotha/src/app/pipeline/pubmed.go` |
| PubMed 30-day local abstract cache | `~/Desktop/repos/researchiq-gotha/src/app/pipeline/pubmed_cache.go` |
| OpenRouter client | `~/Desktop/repos/researchiq-gotha/src/app/pipeline/openrouter.go` |
| Question validation (moderation gate) | `~/Desktop/repos/researchiq-gotha/src/app/pipeline/validate.go` |
| Visual explainer — template render engine | `~/Desktop/repos/researchiq-gotha/src/app/pipeline/visual_render.go` |
| Visual explainer — Go template files | `~/Desktop/repos/researchiq-gotha/src/app/pipeline/visual_templates/*.html` |
| Visual explainer — Sonnet fallback design guide | `~/Desktop/repos/researchiq-gotha/src/app/pipeline/visual_explainer.md` |
| HTML sanitization + markdown-fence stripping | `~/Desktop/repos/researchiq-gotha/src/app/pipeline/sanitize.go` |
| Prompts | `~/Desktop/repos/researchiq-gotha/src/app/pipeline/prompts.go` |
| Submit + credit gate + guest logic | `~/Desktop/repos/researchiq-gotha/src/app/handlers/research.go` |
| Guest cookie signing/tracking | `~/Desktop/repos/researchiq-gotha/src/app/handlers/guest.go` |
| History + delete | `~/Desktop/repos/researchiq-gotha/src/app/handlers/history.go` |
| Result page logic | `~/Desktop/repos/researchiq-gotha/src/app/handlers/result.go` |
| Share (public) | `~/Desktop/repos/researchiq-gotha/src/app/handlers/share.go` |
| Settings + credit packs | `~/Desktop/repos/researchiq-gotha/src/app/handlers/settings.go` |
| Stripe checkout + webhook | `~/Desktop/repos/researchiq-gotha/src/app/handlers/payments.go` |
| Auth (login/logout, rate limiting) | `~/Desktop/repos/researchiq-gotha/src/app/handlers/auth.go` |
| Register | `~/Desktop/repos/researchiq-gotha/src/app/handlers/register.go` |
| User model | `~/Desktop/repos/researchiq-gotha/src/app/models/user.go` |
| ResearchJob model | `~/Desktop/repos/researchiq-gotha/src/app/models/research_job.go` |
| ResearchResult model | `~/Desktop/repos/researchiq-gotha/src/app/models/research_result.go` |
| CreditTransaction model | `~/Desktop/repos/researchiq-gotha/src/app/models/credit_transaction.go` |
| Live database (read-only, for migration) | `~/Desktop/repos/researchiq-gotha/data/app.db` |
| Legacy static asset to carry forward | `~/Desktop/repos/researchiq-gotha/src/app/static/inbody570-guide.html` |

---

## Known Bugs to Fix During the Port

These were found in the GOTHA audit and should **not** be replicated — fix them as part of the rewrite:

1. **Ownership-check inconsistency.** GOTHA has two different implementations of "does this requester own this job" (`ownsJob` in `research.go` vs. inline logic in `result.go`) that disagree on guest-job handling — one requires guest-cookie membership, the other passes by default when a job has no `user_id`. GOVA must have exactly **one** ownership-check function, used by every handler that touches a job (status, result, visual, share-generation, delete).
2. **Dead auth middleware.** GOTHA defines `middleware.RequireAuth` but never wires it into any route — every handler does its own ad hoc `if userID == 0` check. GOVA already has the right pattern for this per `CLAUDE.md`: protect API endpoints with `middleware.RequireAuth`, protect pages client-side with `requireAuth()`. Use it consistently, don't leave it dead.
3. **Session TTL inconsistency.** GOTHA sets a 30-day session on login but only 24 hours on register. Use **30 days** for both.
4. **Unused DB column.** `research_jobs.guest_token` exists in GOTHA's schema but is never populated — actual guest tracking is 100% via the signed `riq_guest`-style cookie. Don't carry this dead column forward.
5. **Cache janitor runs once.** GOTHA's PubMed-cache pruning (`DELETE FROM pubmed_cache WHERE fetched_at < now-30days`) runs once at process startup only, never again for the life of a long-running container. Run it on a periodic ticker (e.g. every 24h) instead.
6. **Missing indexes.** No index on `research_jobs.user_id`, `research_jobs.share_token`, or `credit_transactions.user_id` despite being queried by those columns constantly. Add them.

---

## Data Migration (one-time, run during build)

GOTHA's live SQLite DB (`~/Desktop/repos/researchiq-gotha/data/app.db`, read-only) has real data at time of writing: 6 users, 93 research_jobs, 88 research_results, 15 credit_transactions, 52 cached PubMed abstracts. Write a one-time Go migration script (run manually during the build, not a scaffolded feature) that:

- Opens the GOTHA DB **read-only** (`file:...?mode=ro`) and the new GOVA DB read-write.
- Copies `users`, `research_jobs` (dropping `guest_token`), `research_results`, `credit_transactions`, and `pubmed_cache` rows across, preserving primary key IDs so foreign keys stay consistent.
- Skips `rate_limits` (transient, empty in source anyway).
- Is idempotent / safe to re-run (e.g. `INSERT OR IGNORE`, or check target is empty first).
- Never writes to the GOTHA source DB under any circumstance.

---

## Database Schema (SQLite) — GOVA target

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    credits INTEGER NOT NULL DEFAULT 5,
    lifetime_access INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE research_jobs (
    id INTEGER PRIMARY KEY,
    question TEXT NOT NULL,
    title TEXT,
    status TEXT NOT NULL DEFAULT 'pending',        -- pending|processing|done|failed
    pipeline_stage TEXT,                           -- searching|filtering|synthesizing|visualizing
    studies_found INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    user_id INTEGER REFERENCES users(id),
    share_token TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_research_jobs_user_id ON research_jobs(user_id);
CREATE INDEX idx_research_jobs_share_token ON research_jobs(share_token);

CREATE TABLE research_results (
    id INTEGER PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES research_jobs(id),
    summary TEXT NOT NULL,
    key_takeaways TEXT NOT NULL DEFAULT '[]',       -- JSON array of strings
    follow_up_questions TEXT NOT NULL DEFAULT '[]', -- JSON: [{"question","answer"}]
    visual_html TEXT NOT NULL DEFAULT '',
    studies TEXT NOT NULL DEFAULT '[]',             -- JSON: [{"title","authors","year","journal","pubmed_id","abstract","url"}]
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE credit_transactions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,                            -- free|purchase|usage
    amount INTEGER NOT NULL,
    description TEXT,
    stripe_payment_intent_id TEXT,
    job_id INTEGER REFERENCES research_jobs(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);

CREATE TABLE pubmed_cache (
    pmid TEXT PRIMARY KEY,
    abstract_json TEXT NOT NULL,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE rate_limits (
    ip TEXT PRIMARY KEY,
    attempts INTEGER NOT NULL DEFAULT 0,
    locked_until DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Concurrency Architecture

Same approach as GOTHA — this part was never the problem:

```go
// After inserting the job row:
go runResearchPipeline(jobID, db)
```

- No Redis, no queue, no worker processes.
- The goroutine updates `pipeline_stage` and `status` directly in SQLite as it progresses; SQLite WAL mode lets the HTTP server read while goroutines write.
- Global concurrency cap: buffered channel, 10 concurrent pipeline runs. Acquire at goroutine start, release at end.
- `defer recover()` around the pipeline body — a panic mid-pipeline marks the job `failed`, never crashes the goroutine silently.
- Per-user/guest cap: max 3 active (pending/processing) jobs, enforced at submit time via DB query.

---

## AI Pipeline — Model Selection

Verify exact OpenRouter model slugs against current OpenRouter docs at build time (use `context7` MCP) — the app has moved to the current Sonnet family since GOTHA was built:

| Phase | Task | Model tier | Rationale |
|---|---|---|---|
| Validation | Health-topic moderation gate (fails open on error) | Haiku (fast/cheap) | Simple binary classification |
| Phase 1 | Agentic PubMed tool-calling loop | Haiku (fast/cheap) | MeSH query writing doesn't need deep reasoning |
| Phase 1.5 | Relevance filter | Haiku (fast/cheap) | Simple keep/discard JSON output |
| Phase 2a | Text synthesis (summary + takeaways + Q&A) | Sonnet (current gen, quality) | Quality-critical user-visible output |
| Phase 2b | Visual explainer — structured JSON fill | Haiku (fast/cheap) | Only emits JSON; a Go template renders the actual HTML (see below) |
| Phase 2b fallback | Visual explainer — freeform HTML | Sonnet (current gen, quality) | Used only if the structured-JSON template path fails validation |

All OpenRouter calls: `Authorization: Bearer $OPENROUTER_API_KEY`, `Content-Type: application/json`, `HTTP-Referer: $APP_URL`, `X-Title: ResearchIQ`. Retry once after a short sleep on transport/empty-response error.

---

## AI Pipeline — Implementation Detail

Port the logic in the GOTHA `pipeline/` files listed above. Key points:

### Phase 1 — Research Agent (tool-calling loop)
- Tool: `pubmed_search(query: string, max_results: int)`.
- esearch: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=QUERY&retmax=N&sort=relevance&retmode=json`
- efetch: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=PMID1,PMID2&rettype=abstract&retmode=xml`
- Max 5 agent turns. Within a turn, multiple tool calls fetch **concurrently** (goroutines + mutex-guarded dedup by PMID). **Early exit**: if collected studies reach 40, stop immediately; if they reach 5, stop the loop without waiting for the model to naturally end.
- Update `studies_found` on the job row after every turn (drives live UI progress).
- Local cache-first: check `pubmed_cache` (30-day TTL) before hitting NCBI; only fetch misses live, write fresh fetches back to the cache. Preserve the caller's PMID ordering when merging cache hits + fresh fetches.
- Parse XML: title, authors (max 3 + "et al."), abstract (join labelled `AbstractText` sections as `LABEL: text\n`), year, journal ISOAbbreviation, PMID. Skip empty abstracts. URL: `https://pubmed.ncbi.nlm.nih.gov/PMID/`.
- Optional `NCBI_API_KEY` env var raises the rate limit from 3 to 10 req/s.

### Phase 1.5 — Relevance Filter
- Stage → `filtering`. Returns `{"keep":[1,3,5]}` (1-based indices). **Fails open** (keep all) on parse/API error or empty studies ≤3 (skip filter entirely). If zero studies survive filtering, fail the job with `"no relevant studies found"`. Cap surviving studies to 12.

### Phase 2a — Text Synthesis
- Stage → `synthesizing`. Returns JSON: `{title, summary, key_takeaways[], follow_up_questions[{question,answer}]}`. Strip markdown fences before parsing. Retry once on failure.

### Phase 2b — Visual Explainer (template-fill architecture)
- Stage → `visualizing`.
- **Primary path**: the model (Haiku) emits only structured JSON — `{title, subtitle, sections[]}` where each section is one of 5 typed shapes: `bar-chart`, `step-list`, `html-table`, `editorial-cards`, `timeline`. Model picks 3–5 sections, no repeated type, only emits `bar-chart` with real numeric data pre-scaled to 0–100. A Go `text/template` set (one template per section type + a page shell) renders this into the final HTML — **the AI never writes HTML or CSS**, only labels/values/text. Port the 5 templates + shell from `pipeline/visual_templates/*.html` (`//go:embed`).
- **Fallback path**: if the structured-JSON path errors (bad JSON, unknown section type, missing doctype after render), fall back to a Sonnet call that freely generates HTML guided by the design-guide markdown (`visual_explainer.md`, embedded). Keep both paths — the fallback is a deliberate safety net, not dead code.
- After rendering (either path): strip `<script>`/`<canvas>` tags, sanity-check for a doctype/`<html`.

### Goroutine Stage Updates
```
pending → processing (pipeline_stage='searching')
         → pipeline_stage='filtering'  (after phase 1, studies_found already live-updated)
         → pipeline_stage='synthesizing'
         → pipeline_stage='visualizing'
         → done (clear pipeline_stage, store result, deduct credit)
  OR     → failed (store error_message, no credit deducted)
```

---

## Status Polling UI (GOVA JSON/JS — no HTMX)

GOTHA used HTMX polling fragments; GOVA has no HTMX. Same UX outcome, different mechanism:

- `GET /api/research_status?job_id=X` returns **JSON** (ownership-checked): `{status, pipeline_stage, studies_found, error_message}`.
- The History page's JS module polls this endpoint every 3s (`setInterval` or recursive `setTimeout`) for any job not yet `done`/`failed`, and updates that row's DOM via `textContent` (never `innerHTML`) with a stage-aware label:

| pipeline_stage | Display |
|---|---|
| `searching` | Pulse-dot + "Searching PubMed…" (+ "Found N studies so far…" if `studies_found > 0`) |
| `filtering` | Pulse-dot + "Reviewing N studies for relevance…" |
| `synthesizing` | Pulse-dot + "Writing summary…" |
| `visualizing` | Pulse-dot + "Generating visual explainer…" |
| `failed` | Red badge, error message shown (e.g. as a title attribute or inline text) |
| `done` | Green badge; `window.location.href = '/result?id=X'` |

- Pulse-dot: small circle, pure CSS `@keyframes` (scale + opacity) in the primary red — no JS animation needed.
- Submit button: disable + inline SVG spinner while the fetch is in flight (via `api.js`'s `post()`), then redirect to `/history` on success.

---

## Core Features

### Research Pipeline (background goroutine)
- [ ] `POST /api/research_submit` — trims/validates question (≥10 chars), runs `ValidateQuestion` moderation gate (fails open), credit gate (registered: `lifetime_access || credits > 0`; guest: <5 tracked jobs via signed cookie), max-3-active-jobs check, inserts job row, `go runResearchPipeline(jobID, db)`, returns JSON `{job_id}` (client redirects to `/history`).
- [ ] Phase 1 — agentic PubMed sourcing (cache-first, concurrent fetch, early exit, live `studies_found`)
- [ ] Phase 1.5 — relevance filter (fails open)
- [ ] Phase 2a — text synthesis (JSON output)
- [ ] Phase 2b — visual explainer (template-fill primary, freeform-HTML fallback)
- [ ] On success: store result, mark `done`, deduct 1 credit (registered non-lifetime only; guests and lifetime users never charged)
- [ ] On error: mark `failed` + store `error_message`, no credit deducted

### Pages & Routes
- [ ] `GET /` — Home: centered layout, hero heading, textarea, example-question chips (click prefills textarea), full-width submit button, guest/low-credit banners. Requires no auth.
- [ ] `GET /history` — My Research: newest-first job list, JS-polled stage cards for in-progress jobs (see polling section), delete action per row (calls `POST /api/research_delete`, removes row from DOM on success). Registered users see their jobs; guests see jobs tracked in their signed cookie.
- [ ] `GET /result?id=X` — title, original question, timestamp, share control, visual-explainer callout linking to `/api/research_visual?job_id=X`, Summary, Key Takeaways, Q&A, Studies list. Ownership enforced via the single shared ownership-check helper (see Known Bugs #1).
- [ ] `GET /share?t=TOKEN` — public result view, no auth, same content sections minus share control, CTA for guests to try the app.
- [ ] `GET /api/research_visual?job_id=X` **or** `?share_token=T` — serves stored `visual_html` as `text/html` (documented exception to the "handlers return JSON" rule — this endpoint serves a pre-generated, sanitized HTML document, not a template). `job_id` requires ownership; `share_token` is public.
- [ ] `POST /api/research_share` — ownership-checked, generates a 48-char hex share token if none exists, returns JSON `{share_url}`.
- [ ] `GET /api/research_status?job_id=X` — JSON status poll, ownership-checked (see polling section).
- [ ] `POST /api/research_delete` — auth required, deletes job scoped by `id AND user_id` at the SQL level (ownership enforced in the query itself, not just app logic), nullifies `credit_transactions.job_id` for audit-trail preservation, cascades `research_results` delete.
- [ ] `GET /settings` (auth required, `requireAuth()`) — account info, credit balance (or ∞ for lifetime), 3 credit-pack purchase options, transaction history.
- [ ] `POST /api/payments_checkout` (`middleware.RequireAuth`) — Stripe Checkout session for the selected pack, returns JSON `{checkout_url}` for client-side redirect. Packs: starter (10 credits/$4.99), standard (25/$9.99), pro (50/$17.99).
- [ ] `POST /api/payments_webhook` — Stripe signature verification (reject events >5 min old), idempotent on `stripe_payment_intent_id`, handles `checkout.session.completed`, adds credits + logs transaction. Always 200 on business-logic misses to avoid Stripe retry storms; 400/500 only on verification/processing failure.
- [ ] Auth: login/logout/register per `scaffold_auth()` + `scaffold_registration()` — 30-day session on **both** login and register (Known Bug #3).
- [ ] `GET /inbody570-guide.html` — legacy static asset, served as-is (infra route, no scaffold needed).

### Guest Mode
- [ ] 5 free queries per guest, tracked via signed cookie (HMAC-SHA256, `HttpOnly`, `SameSite=Lax`, `Secure` in production, 30-day max-age) containing the guest's job IDs — verified before trusting contents, fails closed (empty list) on any tamper/parse failure.
- [ ] Guest credit count = `5 - count(done jobs in cookie)`; failed jobs are free (don't count against the limit).
- [ ] IP rate limit: max 5 guest submissions per IP per 30 days via `rate_limits` table.
- [ ] Home page shows an accurate out-of-credits gate once a guest hits the limit (this must read the real cookie state — GOTHA had a bug here where the home page showed a hardcoded "5 credits" regardless of actual usage; don't repeat that).

### Credits & Payments
- [ ] `lifetime_access = 1` bypasses all credit checks everywhere.
- [ ] Credits deducted by the goroutine on pipeline success only — never at submit time.
- [ ] Full `credit_transactions` audit log for free/purchase/usage.

---

## Auth
- [x] User login required (history, settings, result/visual/share/delete ownership where applicable)
- [x] Public registration (5 free credits on signup, logged as a `free` credit_transaction)
- Guest mode: 5 free queries, no registration required, tracked via signed cookie only

## External Integrations
- [x] Payments (Stripe)
- [x] AI / LLM (OpenRouter) — current Sonnet-family model for quality-critical phases, Haiku for fast/cheap phases (confirm exact slugs via `context7` at build time)
- [x] Other: PubMed NCBI eUtils API (free; optional `NCBI_API_KEY` for higher rate limit)

## Environment Variables
```
OPENROUTER_API_KEY=
NCBI_API_KEY=               # optional — raises PubMed rate limit from 3 to 10 req/s
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=       # Stripe Price ID for 10-credit pack ($4.99)
STRIPE_PRICE_STANDARD=      # Stripe Price ID for 25-credit pack ($9.99)
STRIPE_PRICE_PRO=           # Stripe Price ID for 50-credit pack ($17.99)
```
(`APP_URL`, `SESSION_SECRET`, `APP_ENV` already exist in GOVA's `env.example`.)

---

## Design Notes

Same established visual identity as the current product — preserve it exactly, but implement it with real Tailwind utility classes per the Uncodixify standard (GOTHA's inline-`style=""`-everywhere approach was itself one of the audit findings — its Tailwind setup existed but was barely used). Run `uncodixify` before UI work; run `build_css()` after any class changes.

**Color palette:**
```css
:root {
    --color-bg:           #faf8f5;
    --color-surface:      #ffffff;
    --color-surface-2:    #f3ede6;
    --color-text:         #292524;
    --color-text-muted:   #78716c;
    --color-border:       #e8e0d8;
    --color-hover:        #f5f0ea;
    --color-primary:      #c0392b;
    --color-primary-hover:#a93226;
}
```
Status badges: done `#dcfce7`/`#166534`, pending `#fef9c3`/`#854d0e`, failed `#fee2e2`/`#991b1b`.

**Typography:** Playfair Display (400/600/700, italic 400) for headings/titles. Inter (300/400/500/600, `font-weight:300` default body) for body text. Load via Google Fonts.

**Key UI patterns:**
- Home: centered ~640px, Playfair hero h1, textarea with border-color focus transition to primary, full-width red submit button, pill-shaped example-question chips.
- History/status cards: surface background, 1px border, 8px radius, ~1–1.5rem padding.
- Pulse-dot: 8px circle, primary red, continuous scale+opacity keyframe while a job is in progress.
- Result page: ~760–900px max-width, sections separated by bottom borders, key takeaways prefixed with `→` in primary color, studies as surface cards, visual-explainer callout with a left border accent + italic text + "Open →" button.
- Settings: three credit-pack rows as cards, pack name + credit count + right-aligned buy button.
- Nav: Home, My Research, Settings (auth only), Sign In/Register (guest) or Sign Out (auth only), responsive hamburger on mobile.
- `prefers-reduced-motion: reduce` disables all animation (pulse-dot, spinners, fade-ins).

**OG meta:** Set `og:title`/`og:description` on result and share pages to the research title / summary excerpt.
