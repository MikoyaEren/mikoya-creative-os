# Mikoya Creative OS

Internal creative generation platform. Enter a product once and get up to 20
creative concepts across static, video, UGC and experimental mechanisms. Every
concept is delivered in both mandatory formats, **1:1 and 9:16**, so a Full
Creative Drop is 20 concepts, which makes 40 outputs.

The engine is **product- and brand-agnostic**. Mikoya is the first brand
workspace; a second demo brand (Lumen Skin, a premium face serum) runs through
exactly the same pipeline to prove it.

> **Status:** Foundation V1 (architecture, UI, strategy layers, 1:1 + 9:16
> variants) plus **Phase 2: real AI product analysis**. The **Analyze
> Product** step calls Claude server-side and produces a validated Product
> Truth Pack. Concept and asset generation are still simulated with mock data.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

Other scripts:

| Script              | What it does                         |
| ------------------- | ------------------------------------ |
| `npm run build`     | Production build                     |
| `npm run start`     | Serve the production build           |
| `npm run lint`      | ESLint (Next.js config)              |
| `npm run typecheck` | Generate route types + `tsc`         |
| `npm test`          | Unit tests (Vitest): strategy, provenance, URL safety, page extraction, analysis, API route |

Requires Node 20.9+.

### Environment

```bash
cp .env.example .env.local
# then set:
CREATIVE_OS_ANTHROPIC_API_KEY=sk-ant-...
```

| Variable | Required | Purpose |
| -------- | -------- | ------- |
| `CREATIVE_OS_ANTHROPIC_API_KEY` | For **Analyze Product** | Server-side only. Without it the app still works; analysis shows a clear "not configured" error and offers demo data. |
| `ANTHROPIC_ANALYSIS_MODEL` | No | Overrides the analysis model (default `claude-opus-5-5`). |
| `ANTHROPIC_ANALYSIS_EFFORT` | No | `low` / `medium` (default) / `high` / `xhigh` / `max`. |

The model is configured in exactly one place: `lib/server/ai/config.ts`.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Lucide.
UI primitives are small, shadcn-style components in `components/ui` (no
component library dependency). Runtime dependencies beyond Next/React:
`@anthropic-ai/sdk` (server-only), `zod` (validation), `lucide-react`, `clsx`
and `tailwind-merge`.

## Pages

| Route                | Status      | Purpose                                              |
| -------------------- | ----------- | ---------------------------------------------------- |
| `/new`               | Full UI     | Create Ads: brand workspace, product, **Analyze Product + fact review**, brand context, creative strategy, output mix, mechanisms |
| `POST /api/analyze-product` | Internal API | Product input + page + images → validated `ProductTruthPack` |
| `/generations`       | Full UI     | History of batches                                   |
| `/generations/[id]`  | Full UI     | Concept gallery (1:1 + 9:16 per card), filters, sort, detail drawer with format switcher |
| `/recipes`           | Read-only   | Recipe cards + the creative architecture             |
| `/brand`             | Read-only   | Brand workspaces with their strategy layers          |
| `/library`, `/settings` | Placeholder | Roadmap for each area                             |

## Architecture

### Creative architecture

```
PRODUCT INPUT
↓
PRODUCT TRUTH PACK            What is factually true about the product?
↓
BRAND STRATEGY PROFILE        What does the brand explicitly want to represent?
↓
STRATEGY HYPOTHESES           What does AI think may be strategically relevant?
↓
DYNAMIC CREATIVE STRATEGY     What should this specific batch communicate?
↓
GLOBAL CREATIVE CONSTITUTION  What makes strong advertising, for any product?
↓
CREATIVE RECIPE               How does this creative mechanism work?
↓
CREATIVE CONCEPT              What is the specific idea?
↓
CREATIVE VARIANTS             How does the same idea adapt to each format?
   ├── 1:1
   └── 9:16
↓
RENDERER INSTRUCTIONS         How should this asset technically be produced?
↓
FINAL GENERATION PROMPT
```

| Layer                        | Type                          | Code                                        | Brand-specific? |
| ---------------------------- | ----------------------------- | ------------------------------------------- | --------------- |
| Global creative constitution | `GlobalCreativeConstitution`  | `lib/prompts/global-creative-constitution.ts` | Never         |
| Product truth pack           | `ProductTruthPack`            | `lib/strategy/product-truth-pack.ts`        | Data only       |
| Brand strategy profile       | `BrandStrategyProfile`        | `lib/strategy/brand-strategy.ts`            | Data only       |
| Strategy hypotheses          | `StrategyHypothesis`          | `lib/strategy/strategy-hypotheses.ts`       | Data only       |
| Dynamic creative strategy    | `DynamicCreativeStrategy`     | `lib/strategy/dynamic-creative-strategy.ts` | Data only       |
| Creative recipe              | `CreativeRecipe`              | `lib/recipes/`                              | Never           |
| Creative concept / variants  | `CreativeConcept`, `CreativeVariant` | `lib/types/index.ts`                 | Output          |
| Format instructions          | `FormatSpec`                  | `lib/pipeline/formats.ts`                   | Never           |
| Renderer instructions        | `RendererSpec`                | `lib/prompts/renderer-instructions.ts`      | Never           |
| Prompt composition           | —                             | `lib/prompts/prompt-builder.ts`             | Never           |

Two prompts, two responsibilities:

- `buildConceptPrompt({ productTruthPack, brandStrategyProfile, strategyHypotheses, dynamicCreativeStrategy, globalCreativeConstitution, recipe })`
  is for the concept writer. It returns ideas as JSON, one idea per concept.
- `buildVariantPrompt({ concept, variant, rendererInstructions, visualContext })`
  is for the renderer and produces one prompt per format. The concept section
  is identical for 1:1 and 9:16. Only the format layer differs.

Recipes stay lightweight and mechanism-specific. They hold structure, copy
slots, craft `principles` and `formatLayouts`. They never contain brand
positioning, product facts or global creative philosophy.

### Provenance and the priority rule

Every strategic statement is a `SourcedStatement`. Provenance has three
separate parts:

| Part                   | Field                             | Meaning |
| ---------------------- | --------------------------------- | ------- |
| **Origin**             | `source`                          | Where the idea came from: `user_input`, `source_fact` or `ai_inference`. **Never rewritten.** |
| **Review**             | `reviewStatus`, `approvedByUser`  | The user's decision: `unreviewed`, `accepted` or `rejected`. |
| **Effective priority** | `effectivePriority()`             | How much authority the item has. Derived from origin + review. |

```ts
{
  statement: "Aesthetic self-expression",
  source: "ai_inference",      // origin stays AI, even after Accept
  confidence: 0.82,
  reviewStatus: "accepted",
  approvedByUser: true,
}
```

Effective priority (`lib/strategy/provenance.ts`), highest first:

| Priority | Item                        | UI badge                  |
| -------- | --------------------------- | ------------------------- |
| 4        | Explicit user input         | User provided             |
| 3        | User-approved AI inference  | AI inferred · 82% ✓ Accepted |
| 2        | Verified source fact        | Source fact               |
| 1        | Unreviewed AI inference     | AI inferred · 82%         |
| —        | Rejected AI inference       | never used                |

- **Accepting an AI inference raises its authority, not its origin.** It
  outranks source facts, stays below explicit user input, and keeps its
  "AI inferred" badge, confidence and rationale as an audit trail.
- **Rejected inferences are never used.** `mergeByPriority()` drops them.
- **Unreviewed inferences under 65% confidence are ignored.** Accepting one
  lets it through.
- **`mergeByPriority()` resolves duplicates.** They collapse onto the entry
  with the highest effective priority, which keeps its own origin.
- **Facts can't come from AI.** Product facts use `Fact<T>`, whose source
  type (`FactSource`) excludes `ai_inference`.
- **Quick edits on `/new` count as explicit user input.** Changes to tone,
  desires, colors and notes are treated that way.
- **The prompt keeps the distinction.** Accepted inferences appear as
  `[AI inferred 82% · accepted by user]`, so the concept writer can tell an
  approved hypothesis from a verified fact.

`npm test` covers these rules (`lib/strategy/provenance.test.ts`).

### Brand workspaces (where brand-specific data lives)

A `CreativeProject` (`lib/projects/types.ts`) holds everything
brand-specific: brand-context defaults and suggestion lists, the
`BrandStrategyProfile`, mock `ProductTruthPack`s, mock `StrategyHypothesis`es,
the saved batch direction, and optional hand-written mock copy.

```
lib/projects/
  mikoya/   index.ts (facts, strategy, hypotheses, direction), assets.ts, mock-copy.ts
  lumen/    index.ts, the Premium Face Serum demo brand (no custom copy)
```

To add a brand, add a project object. No application code changes. Lumen Skin
proves this: it has no hand-written copy, so the generic, strategy-driven
templates in `lib/mock/concept-templates.ts` write its concepts.

`buildStrategySnapshot()` (`lib/strategy/index.ts`) resolves all layers for a
batch. The New Generation preview and the generation pipeline both call it,
so the Creative Strategy panel shows exactly what the concept writer receives.
Each batch stores its snapshot.

### Concepts and format variants

A **CreativeConcept** is one idea. It has one mechanism, angle, hook,
subheadline, visual idea and offer. It always carries exactly two
**CreativeVariants**, `1:1` and `9:16` (`lib/pipeline/formats.ts`).
Both variants share the concept's copy. What differs is the layout: the
composition, where elements sit, text wrapping, spacing, product scale and
crop. Users pick mechanisms, never formats.

```
Presets          concepts   outputs (× 2 formats)
Quick Test          5          10
Standard Batch     10          20
Full Creative Drop 20          40
```

The UI only talks to the `GenerationProvider` interface
(`lib/pipeline/provider.ts`). Today it is `mockProvider`, which runs the mock
pipeline in `lib/mock/generate-batch.ts`.

### Product analysis (Phase 2)

```
PRODUCT INPUT (name, URL, images, notes)
   ↓  POST /api/analyze-product            app/api/analyze-product/route.ts
VALIDATE request + URL (no network yet)   analyze-product.ts, url-safety.ts
   ↓  missing key? → 503 before any cost
FETCH the page once (SSRF-safe)           lib/server/fetch/fetch-page.ts
   ↓
CLEAN + EXTRACT page content              lib/server/fetch/extract-page.ts
   (title, meta, JSON-LD product/offer/rating/FAQ, headings, price text, visible text; capped)
   ↓
ONE Claude call: page block + images      lib/server/product-analysis/analyzers.ts
   (structured output, zod schema)        schema.ts, prompt.ts
   ↓
VALIDATE + MAP to ProductTruthPack        schema.ts → parseAnalysisOutput(), toTruthPack()
   ↓  (raw, never modified afterwards)
REVIEW BUNDLE: claims, key facts,         lib/strategy/claims.ts, conflicts.ts
  conflicts, excluded reviews
   ↓
UI REVIEW GATE: Accept / Edit / Reject    components/product/fact-review-section.tsx
   ↓  (UserDecisions, stored separately)
CreativeSafeProductProfile                lib/strategy/safe-profile.ts
   ↓
Creative Strategy → Generate (consumes the safe profile only)
```

The Product Truth Pack is created in **`toTruthPack()`**
(`lib/server/product-analysis/schema.ts`). The model's output is validated
twice: by the SDK's structured-output parser and again by our own zod schema.
Malformed output returns `invalid_ai_output` and nothing is saved.

**Strict factuality and provenance.**
- The model never chooses `source`. It only cites a `sourceRef`:
  `product_page`, `main_image`, `additional_image_<n>` or `user_input`.
- `toTruthPack()` derives provenance from that: `user_input` stays
  `user_input`, and page/image evidence becomes `source_fact`. The AI is the
  extractor, not the source.
- Facts that cite a source that wasn't provided are **dropped**. So are page
  facts without an evidence quote. Quotes that can't be matched in the page
  text produce a review warning.
- The entered product name and URL always win (`user_input`). If the page
  names the product differently, you get a warning.
- Prices need a valid amount and an ISO currency code, and are never
  converted. Conflicting prices stay unknown or are flagged as conflicts.
- Anything unsupported stays in `missing` and is shown in the UI. Customer
  psychology never enters the Truth Pack; that belongs to Strategy
  Hypotheses.
- Each fact can carry a short `evidence` snippet (≤160 chars) for auditing.

**Grammar budget.** The provider compiles the structured-output schema into
a grammar with a size limit. All facts therefore share one item shape tagged
by `field`, and categorical values are plain strings normalised in
`toTruthPack()` (no enums). A test guards this; per-field objects with nested
enums were rejected live ("The compiled grammar is too large").

### Product fact review (claims, conflicts, safe profile)

Stated is not verified. The raw Truth Pack is kept for audit, and creative
generation only ever receives the derived **`CreativeSafeProductProfile`**.

**Claim taxonomy** (`lib/strategy/claims.ts`), deterministic and product-agnostic:

| Type | Meaning |
| ---- | ------- |
| `product_fact` | low-risk attribute (size, process, material) |
| `source_claim` | stated by a source, usually the brand's own page — not verified |
| `verified_claim` | low-risk claim corroborated by two independent provided sources (e.g. page + packaging) |
| `user_approved_claim` | accepted or edited by the user |
| `blocked_claim` | medical / disease claim — never usable, even if approved |

Risk categories: `general`, `health`, `performance`, `comparative`,
`regulated`, `pricing`, `guarantee`. A keyword classifier (English + German)
sets the risk; the model's suggestion can only raise it. Health, performance,
comparative and regulated claims are never auto-verified and need approval.

**Conflicts** (`lib/strategy/conflicts.ts`) are explicit `ProductConflict`s
with values, sources, severity, status and a recommended action:
- `context`: the extracted price currency doesn't match the target market's
  expected currency (Mikoya: Germany / EUR / de).
- `validator`: structured data (JSON-LD / meta) disagrees with the visible
  stock status.
- `model`: other disagreements the model reported with quotes (e.g. shipping).

Nothing is rewritten. A conflict is resolved when every affected item has a
decision, or when the user dismisses it.

**Review scoping.** Reviews are kept only when attributable to this product.
Reviews naming another product (checked deterministically against the product
name) or marked other/unclear by the model are excluded, with a reason.

**Review gate and safe profile.** Each key fact and claim can be accepted,
edited or rejected. Decisions (`UserDecisions`) are stored apart from the
bundle. An edit becomes `user_input` while the original value, source and
quote stay visible. The safe profile includes an item unless:
- it was rejected;
- it is blocked;
- its field has an unresolved conflict;
- it is a high-risk claim nobody approved.

Excluded items are listed with their reason.

**Composite conflict leaks** are closed at the same boundary. An item of
another field (offer, guarantee, description …) that embeds a value of a
conflicted field is withheld as `contains_unresolved_conflict`, with its
`conflictFields`. "Embeds" means one of:
- the same significant number (clock times ignored)
- two or more matching words (existing word-overlap check)
- for price, any money amount

A conflicted field is one whose conflict is unresolved, or was resolved by
editing or rejecting the original value (so embedded copies are stale).
Accepting the composite item as-is does not clear it; an edit whose text no
longer embeds the value does. Raw data stays untouched. Strategy inference
and the concept writer therefore never receive such items.

### Concept generation (Phase 4)

```
StrategySnapshot (safe profile + brand + reviewed DynamicCreativeStrategy)
   ↓ allocateSlots()            deterministic, no AI           lib/concepts/allocation.ts
   ↓ buildConceptInputs()        citable refs: [fact:] [proof:] [brand:] [strategy:]
   ↓ ONE Claude call             compact tagged output          POST /api/generate-concepts
   ↓ validateConcepts()          deterministic guards           lib/concepts/concept-guards.ts
   ↓ toConcept()                 exactly 1:1 + 9:16 per concept lib/concepts/expand-variants.ts
CreativeBatch { strategy, conceptRun (plan, drops, unfilled, swaps, usage), concepts }
```

- **Image concepts only.** One concept = one idea = exactly two outputs (1:1 +
  9:16), so 20 concepts = 40 outputs. Motion mechanisms (Claymation, AI UGC)
  stay in the catalogue with recipes but are not generated yet.
- **Recipes** (all 30 authored) describe how a mechanism works, never what a
  product should say. `MECHANISM_TRAITS` holds generic capabilities:
  `requiresProductAsset`, `prefersProductAsset`,
  `requiresApprovedSocialProof`, `prefersOffer`, `supportsComparison`, fit
  tags and allowed renderers (html / image only).
- **Allocation:**
  - only still mechanisms with an authored recipe whose *required* inputs exist
  - distinct mechanisms first (at least 75% of the batch where possible)
  - at most 2 per mechanism
  - strategy foci rotated: angles, objections, desires, motivations,
    opportunities
  - each slot lists 2 alternative mechanisms
- **Writer:** one call for the whole batch, over the full slot plan. It may
  swap to a listed alternative or decline a slot. Fewer strong concepts beat
  forced weak ones; there is no repair call. Factual grounding is a strict
  prompt rule.
- **Guards** drop a concept, with a reason, for:
  - an invalid slot or mechanism
  - the mechanism cap being reached
  - no grounding in the inputs
  - withheld or blocked claims
  - forbidden topics (on what the ad says and shows)
  - unsupported numbers: ratings, percentages, prices and counts always;
    durations only next to an effect verb
  - unsupported sensitive wording (field names and design terms ignored)
  - made-up testimonials
  - near-duplicate hooks, messages or angles

  Layout notes that carry copy are replaced by the recipe layout.
- **Only hypotheses the strategy actually used** reach concept prompts.
- **Input audit:** each run records `inputRefs`, every reference the writer
  was given. Every kept concept's basis, focus and proof resolve to them;
  unknown references are removed, and a concept with none left is dropped.

### Strategy inference (Phase 3)

```
CreativeSafeProductProfile + effective BrandStrategyProfile + assets + batch direction
   ↓  buildStrategyInputs(): citable lines [fact:…] [brand:…] [asset:…] [review:…] + fingerprint
   ↓  POST /api/infer-strategy  → ONE Claude call (compact tagged-list output)
toHypotheses(): grounding, normalisation, caps, guards     lib/server/strategy/schema.ts
   ↓  StrategyInferenceRun (stored as-is; reviews kept separately)
UI review: Accept / Reject                                  AI inferences tab
   ↓
deriveDynamicCreativeStrategy()  → StrategySnapshot (+ audit)
```

- **Inputs:** only the safe profile reaches the model: no raw truth pack, no
  withheld items. Withheld values are used only to drop hypotheses that
  would restate them.
- **Grounding:** every hypothesis must cite at least one provided input
  reference. Ungrounded, unknown-category, duplicate and over-limit
  hypotheses are dropped, with a reason (3 per category, 20 in total).
- **Guards** (`lib/strategy/strategy-guards.ts`) never change a hypothesis's
  origin or review status:
  - A hypothesis restating a withheld or blocked claim is dropped.
  - A hypothesis touching a brand "never mention" topic is never used, even
    if accepted.
  - A contradiction of explicit brand intent is recorded and never merged.
  - Health, performance, comparative or regulated wording is never used
    unless accepted.
- **Brand override:** where the brand defines audience, positioning or
  desired identity, unreviewed AI hypotheses of that category are not
  merged. Accepted ones are added below the brand values. An AI item that
  restates an explicit item is dropped: the explicit item must have 2 or more
  significant words, and the AI item must contain at least 75% of them.
- **Sensitive wording** reuses the product-claim classifier, but isolated
  emotional words (calm, peaceful, relaxed…) are ignored unless the
  hypothesis states or implies an effect ("reduces stress and keeps you
  calm"). Product-claim classification itself is unchanged.
- **Usage result:** the derivation returns `usedHypothesisIds` and
  `excludedHypotheses` (with a reason: `rejected`, `below_confidence`,
  `requires_review`, `brand_override`, `brand_conflict`, `forbidden_topic`,
  `category_limit`, `duplicate`, `stale_run`). Both are stored in the
  snapshot audit, and the UI only renders them.
- **Social proof** (ratings, review or customer counts, testimonials, in any
  claim field) is supporting proof only once approved, verified or
  user-approved. The concept prompt applies the same rule, and customer
  reviews are passed as context only.
- **Provenance:** hypotheses are always `source = ai_inference`. Accepting
  one sets `reviewStatus = accepted` and `approvedByUser`; it never becomes
  user input.
- **Auditability:** each `StrategySnapshot` carries an `audit` record with
  - the snapshot id and time
  - the safe-profile and brand ids
  - the input fingerprint
  - the inference run id, model and time
  - whether the run is stale
  - every review decision
  - the hypothesis ids that entered the strategy

  A run whose input fingerprint no longer matches is **out of date**: its
  hypotheses stay visible but are not used.
- **Demo mode:** "Demo" returns the workspace's stored hypotheses through the
  same guards. There is no network call and no AI.

**Mock vs real analyzer.** Both implement `ProductAnalyzer`:

| Analyzer | When | What it does |
| -------- | ---- | ------------ |
| `RealProductAnalyzer` | "Analyze Product", only with `CREATIVE_OS_ANTHROPIC_API_KEY` set | Page fetch + 1 Claude call, structured output, validation |
| `MockProductAnalyzer` | "Use demo data (mock)", tests, demos | No network, no AI. Returns stored project facts for known URLs, otherwise only user input. |

**Cost control.** Analysis runs only on an explicit click, never on
keystrokes. One click means one page fetch, one preprocessing pass and one
model call. The result is marked **out of date** when the product name, URL
or images change, and stale facts aren't used until you re-analyze. The SDK
retries 429/5xx up to 2 times. Refusals use the server-side fallback
(`fallbacks: "default"`).

**Errors.** Every failure maps to a user-safe code and message (no stack
traces or secrets): `invalid_url`, `blocked_url`, `fetch_failed`,
`fetch_timeout`, `not_html`, `page_too_large`, `too_many_redirects`,
`image_invalid`, `missing_api_key`, `auth_failed`, `rate_limited`,
`ai_unavailable`, `ai_refused`, `invalid_ai_output`.

### URL fetching security (SSRF)

`lib/server/fetch/url-safety.ts` and `fetch-page.ts`:

- **Protocols:** only `http:` / `https:`. `file:`, `ftp:`, `data:` and
  `javascript:` are rejected, and so are URLs with embedded credentials.
- **Ports:** standard ports only (80/443).
- **Hostnames:** `localhost`, `*.localhost`, `.local` / `.internal` /
  `.lan` etc. and single-label hostnames are rejected.
- **Blocked IP ranges:** loopback, private (10/8, 172.16/12, 192.168/16),
  link-local incl. cloud metadata (169.254.169.254), CGNAT, multicast and
  reserved ranges; IPv6 `::1`, `fc00::/7`, `fe80::/10` and IPv4-mapped/NAT64
  forms.
- **DNS pinning:** DNS is resolved **inside the socket connect** via a custom
  `lookup`, for every connection and every redirect hop. A hostname can't pass
  validation and then rebind to an internal IP.
- **Redirects:** at most 3, each target re-validated.
- **Timeout:** 10 s overall.
- **Size limit:** 3 MB decompressed; gzip, deflate and brotli are supported.
- **Content type:** HTML only.
- **Images:** accepted as uploaded data URLs or bundled `/references/*`
  files (path-traversal-safe). The server never fetches remote image URLs.
  Limits: 6 images, 5 MB each.

### Folder structure

```
app/                     Routes (App Router)
components/
  ui/                    Button, Input, Field, Badge, Sheet, Segmented, Toaster…
  layout/                App shell, sidebar, page header, placeholder page
  product/               Product inputs, image dropzone, assets, brand context
  strategy/              Creative Strategy panel, provenance badges
  generation/            New Generation form, output mix, mechanism picker
  creative/              Gallery, cards, detail drawer, mock ad previews
  generations/           Generations list
  recipes/               Recipe card
lib/
  types/                 Domain model (index.ts), strategy & provenance (strategy.ts), analysis API (analysis.ts)
  server/                SERVER-ONLY code
    ai/                  Anthropic client + the single model config
    fetch/               URL safety (SSRF), page fetch, page extraction
    product-analysis/    analyzeProduct(), analyzers (real/mock), schema, prompt, images, errors
  prompts/               Global creative constitution, prompt builder, renderer instructions
  strategy/              Truth pack, brand strategy, hypotheses, dynamic strategy, provenance
  projects/              Brand workspaces (ALL brand-specific data lives here)
  recipes/               Mechanism catalogue (30) + recipe definitions (11)
  pipeline/              Output formats, concept JSON schema, generation provider
  mock/                  Generic concept templates, mock pipeline, seed batches
  store/                 Client stores (batches in localStorage, toasts)
  assets.ts              File → ProductAsset (validation + downscaled preview)
  analysis-client.ts     Browser helper for POST /api/analyze-product
```

### Data and storage

- `public/references/` holds three real Mikoya visuals (JPN Matcha pouch,
  starter set, iced-matcha lifestyle shot). They are wired in through
  `lib/projects/mikoya/assets.ts`: the seed batches use them, **Load Mikoya
  example** on `/new` pre-fills the form with them, and Lifestyle, POV and
  UGC previews use the lifestyle photo. The packaging is never redrawn.
  Packshots are only blended onto brand backgrounds with `mix-blend-multiply`.
- Uploaded images are validated (JPG, PNG or WEBP, 15 MB max) and downscaled
  to a preview data URL in the browser. Nothing is uploaded to a server.
- Batches you create are saved in `localStorage`. Five seed batches (four
  Mikoya, one Lumen Skin) are always present.
- `components/creative/creative-preview.tsx` draws a recognisable mock for
  every mechanism (tweet, iMessage, receipt, warning label, …), with a separate
  composition for 1:1 and for 9:16. Once renderers exist, show
  `variant.previewUrl` / `variant.outputUrl` instead.

## Where AI will plug in

Step 1 is **live** (Phase 2). The others are still mocked, each behind a
single, typed seam:

| Step | Future AI call | Replaces | Output |
| ---- | -------------- | -------- | ------ |
| 1 ✅ | `analyzeProduct()` (`lib/server/product-analysis/`): SSRF-safe page fetch + one Claude call over page and images | `project.truthPacks` / `buildTruthPackFromInput()` (still used by the mock analyzer and when no analysis ran) | `ProductTruthPack` (facts only) |
| 2 | `inferStrategy()`: fills gaps in brand and product knowledge | `project.hypotheses` | `StrategyHypothesis[]` (`ai_inference` + confidence, `reviewStatus: "unreviewed"`) |
| 3 | `writeConcepts()`: LLM with `buildConceptPrompt()` + `CREATIVE_CONCEPT_JSON_SCHEMA` | `lib/mock/concept-templates.ts` / project mock copy | `CreativeConceptDraft[]`, validated with `parseConceptDraft()` |
| 4 | `renderVariant()`: HTML / image / video / UGC renderer with `buildVariantPrompt()` | client-side `CreativePreview` | `variant.previewUrl`, `variant.outputUrl` |

`deriveDynamicCreativeStrategy()` stays deterministic. If an LLM later
proposes a strategy, its output still goes through the same priority merge,
so user input always wins.

## Recommended next step

1. Manual correction of analysed facts (edit / remove / add a fact as
   `user_input`).
2. Implement `writeConcepts()`: one LLM call per recipe using
   `buildConceptPrompt()`. The model writes each idea once, then the system
   expands it into the 1:1 and 9:16 variants.
3. Persist projects, batches and snapshots in a database, and assets in
   object storage.
4. Implement an `apiProvider` that satisfies `GenerationProvider`.

After that, start with the `html` renderer (deterministic templates to PNG).
The image, video and UGC providers come after it.
