# Mikoya Creative OS

Internal creative generation platform for Mikoya. Enter a product once and get
30–40 ad concepts across static, video, UGC and experimental mechanisms.

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
| `/new`               | Full UI     | Create Ads: product, brand context, output mix, formats |
| `/generations`       | Full UI     | History of batches                                   |
| `/generations/[id]`  | Full UI     | Creative gallery with filters, sort and detail drawer |
| `/recipes`           | Read-only   | Recipe cards + the prompt-layer architecture         |
| `/library`, `/brand`, `/settings` | Placeholder | Roadmap for each area                  |

## Architecture

The future pipeline is **layered**, not 40 giant prompts:

```
GLOBAL BRAND CONTEXT  +  PRODUCT TRUTH PACK  +  CREATIVE RECIPE
      +  CREATIVE CONCEPT  +  RENDERER INSTRUCTIONS  =  FINAL GENERATION PROMPT
```

Each layer has its own module and can be versioned and cached on its own:

| Layer                 | Where                                   |
| --------------------- | --------------------------------------- |
| Brand context         | `BrandContext` type, `lib/constants.ts` defaults |
| Product truth pack    | `lib/pipeline/truth-pack.ts` (stub)     |
| Creative recipe       | `lib/recipes/recipes.ts`                |
| Creative concept      | `CreativeConcept` type, `lib/pipeline/concept-schema.ts` |
| Renderer instructions | `lib/pipeline/renderers.ts`             |
| Composition           | `lib/pipeline/prompt-builder.ts`        |

The UI only talks to the `GenerationProvider` interface
(`lib/pipeline/provider.ts`). Today it is `mockProvider`. Swapping in a real
provider does not touch any components.

Every mock concept already carries a real composed `generationPrompt`, which
you can inspect in the creative detail drawer.

### Folder structure

```
app/                     Routes (App Router)
components/
  ui/                    Button, Input, Field, Badge, Sheet, Segmented, Toaster…
  layout/                App shell, sidebar, page header, placeholder page
  product/               Product inputs, image dropzone, assets, brand context
  generation/            New Generation form, output mix, format picker
  creative/              Gallery, cards, detail drawer, mock ad previews
  generations/           Generations list
  recipes/               Recipe card
lib/
  types/                 Domain model (ProductInput, CreativeConcept, CreativeBatch…)
  recipes/               Mechanism catalogue (30) + recipe definitions (11)
  pipeline/              Truth pack, renderers, prompt builder, schema, provider
  mock/                  Copy bank, mock batch generator, seed batches
  store/                 Client stores (batches in localStorage, toasts)
  assets.ts              File → ProductAsset (validation + downscaled preview)
```

### Data and storage

- `public/references/` holds three real Mikoya visuals (JPN Matcha pouch,
  starter set, iced-matcha lifestyle shot). They are wired in through
  `lib/mock/reference-assets.ts`: the seed batches use them, **Load Mikoya
  example** on `/new` pre-fills the form with them, and Lifestyle, POV and
  UGC previews use the lifestyle photo. The packaging is never redrawn.
  Packshots are only blended onto brand backgrounds with `mix-blend-multiply`.
- Uploaded images are validated (JPG, PNG or WEBP, 15 MB max) and downscaled
  to a preview data URL in the browser. Nothing is uploaded to a server.
- Batches you create are saved in `localStorage`. Four seed batches are always
  present.
- `components/creative/creative-preview.tsx` draws a recognisable mock for
  every mechanism (tweet, iMessage, receipt, warning label, …). Once renderers
  exist, show `concept.outputUrl` instead.

## Recommended next step

Connect the concept writer:

1. Add a server route (`app/api/generations/route.ts`) that builds the product
   truth pack. Scrape the product URL, then run a vision pass over the images.
2. Call the LLM with Brand context + Truth pack + the selected recipes, using
   `CREATIVE_CONCEPT_JSON_SCHEMA` as structured output. Validate the result
   with `parseConceptDraft`.
3. Persist batches in a database and assets in object storage.
4. Implement an `apiProvider` that satisfies `GenerationProvider`.

After that, start with the `html` renderer (deterministic templates to PNG).
The image, video and UGC providers come after it.
