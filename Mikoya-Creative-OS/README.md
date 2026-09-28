# Mikoya Creative OS

Internal creative generation platform. Enter a product once and get up to 20
creative concepts across static, video, UGC and experimental mechanisms. Every
concept is delivered in both mandatory formats, **1:1 and 9:16**, so a Full
Creative Drop is 20 concepts, which makes 40 outputs.

The engine is **product- and brand-agnostic**. Mikoya is the first brand
workspace; a second demo brand (Lumen Skin, a premium face serum) runs through
exactly the same pipeline to prove it.

> **Milestone 1 (this version):** architecture, polished frontend, input
> workflow, asset handling, output gallery and the TypeScript data model.
> **No AI APIs are called.** Generation is simulated with realistic mock data.

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
| `npm test`          | Unit tests (Vitest) for the strategy/provenance rules |

Requires Node 20.9+. No environment variables are needed yet. `.env.example`
lists the keys future integrations will use.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Lucide.
UI primitives are small, shadcn-style components in `components/ui` (no
component library dependency). Runtime dependencies beyond Next/React:
`lucide-react`, `clsx` and `tailwind-merge`.

## Pages

| Route                | Status      | Purpose                                              |
| -------------------- | ----------- | ---------------------------------------------------- |
| `/new`               | Full UI     | Create Ads: brand workspace, product, brand context, creative strategy, output mix, mechanisms |
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
  types/                 Domain model (index.ts) + strategy & provenance types (strategy.ts)
  prompts/               Global creative constitution, prompt builder, renderer instructions
  strategy/              Truth pack, brand strategy, hypotheses, dynamic strategy, provenance
  projects/              Brand workspaces (ALL brand-specific data lives here)
  recipes/               Mechanism catalogue (30) + recipe definitions (11)
  pipeline/              Output formats, concept JSON schema, generation provider
  mock/                  Generic concept templates, mock pipeline, seed batches
  store/                 Client stores (batches in localStorage, toasts)
  assets.ts              File → ProductAsset (validation + downscaled preview)
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

All of these are mocked today. Each has a single, typed seam:

| Step | Future AI call | Replaces | Output |
| ---- | -------------- | -------- | ------ |
| 1 | `analyzeProduct()`: scrape the URL, then a vision pass over the assets | `project.truthPacks` / `buildTruthPackFromInput()` | `ProductTruthPack` (facts only) |
| 2 | `inferStrategy()`: fills gaps in brand and product knowledge | `project.hypotheses` | `StrategyHypothesis[]` (`ai_inference` + confidence, `reviewStatus: "unreviewed"`) |
| 3 | `writeConcepts()`: LLM with `buildConceptPrompt()` + `CREATIVE_CONCEPT_JSON_SCHEMA` | `lib/mock/concept-templates.ts` / project mock copy | `CreativeConceptDraft[]`, validated with `parseConceptDraft()` |
| 4 | `renderVariant()`: HTML / image / video / UGC renderer with `buildVariantPrompt()` | client-side `CreativePreview` | `variant.previewUrl`, `variant.outputUrl` |

`deriveDynamicCreativeStrategy()` stays deterministic. If an LLM later
proposes a strategy, its output still goes through the same priority merge,
so user input always wins.

## Recommended next step

1. Add a server route (`app/api/generations/route.ts`) that implements
   `analyzeProduct()` for the truth pack.
2. Implement `writeConcepts()`: one LLM call per recipe using
   `buildConceptPrompt()`. The model writes each idea once, then the system
   expands it into the 1:1 and 9:16 variants.
3. Persist projects, batches and snapshots in a database, and assets in
   object storage.
4. Implement an `apiProvider` that satisfies `GenerationProvider`.

After that, start with the `html` renderer (deterministic templates to PNG).
The image, video and UGC providers come after it.
