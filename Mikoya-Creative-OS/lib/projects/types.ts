import type {
  BrandContext,
  BrandStrategyProfile,
  CreativeDirectionInput,
  ProductAnalysisContext,
  ProductInput,
  ProductTruthPack,
  StrategyHypothesis,
} from "@/lib/types";
import type { MockCopyBank } from "@/lib/mock/concept-templates";

/**
 * A brand workspace. ALL brand- and product-specific knowledge lives in a
 * CreativeProject — never in the constitution, recipes, renderers or
 * pipeline logic. Adding a brand = adding one of these objects.
 */
export interface CreativeProject {
  id: string;
  name: string;
  description: string;
  /** Defaults for the quick Brand Context controls on New Generation. */
  brandContext: BrandContext;
  toneOptions: string[];
  desireOptions: string[];
  brandStrategy: BrandStrategyProfile;
  /** Mock AI hypotheses (later: inferStrategy()). */
  hypotheses: StrategyHypothesis[];
  /** Saved batch direction set by the brand team (user input). */
  defaultDirection: CreativeDirectionInput;
  /** Default target market for product analysis (flags e.g. prices in an unexpected currency). */
  analysisContext?: ProductAnalysisContext;
  exampleProduct: ProductInput;
  /** Mock product analysis results, matched by product URL (later: analyzeProduct()). */
  truthPacks: ProductTruthPack[];
  /** Optional hand-written mock copy that stands in for LLM output. */
  mockCopy?: MockCopyBank;
  mockCtas?: string[];
}
