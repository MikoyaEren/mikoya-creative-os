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
   ↓
UI: Review Product Facts → Creative Strategy → Generate
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
- Prices need a valid amount and an ISO currency code. Conflicting prices
  stay unknown.
- Anything unsupported stays in `missing` and is shown in the UI. Customer
  psychology never enters the Truth Pack; that belongs to Strategy
  Hypotheses.
- Each fact can carry a short `evidence` snippet (≤160 chars) for auditing.

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
