import type { MechanismId } from "@/lib/types";
import type { HtmlTemplate } from "../types";
import { imessageTemplate } from "./templates/imessage";
import { lockScreenTemplate } from "./templates/lock-screen";
import { receiptTemplate } from "./templates/receipt";
import { searchBarTemplate } from "./templates/search-bar";
import { xPostTemplate } from "./templates/x-post";
import { warningLabelTemplate } from "./templates/warning-label";
import { checklistTemplate } from "./templates/checklist";
import { dictionaryTemplate } from "./templates/dictionary";
import { confessionTemplate } from "./templates/confession";
import { unpopularOpinionTemplate } from "./templates/unpopular-opinion";
import { thingsThatMakeSenseTemplate } from "./templates/things-that-make-sense";
import { relationshipStatusTemplate } from "./templates/relationship-status";
import { membershipCardTemplate } from "./templates/membership-card";
import { missingPosterTemplate } from "./templates/missing-poster";
import { breakingNewsTemplate } from "./templates/breaking-news";
import { starterPackTemplate } from "./templates/starter-pack";
import { dmConversationTemplate } from "./templates/dm-conversation";
import { usVsThemTemplate } from "./templates/us-vs-them";

/**
 * TEMPLATE REGISTRY — one proper template per HTML mechanism (no generic
 * "ad card"). A mechanism without a template is not renderable yet and
 * says so (`no_template`); it is never drawn with another template.
 */
const TEMPLATES: HtmlTemplate<never>[] = [
  imessageTemplate, receiptTemplate, lockScreenTemplate, xPostTemplate, searchBarTemplate, warningLabelTemplate, checklistTemplate, dictionaryTemplate,
  confessionTemplate, unpopularOpinionTemplate, thingsThatMakeSenseTemplate, relationshipStatusTemplate,
  membershipCardTemplate, missingPosterTemplate, breakingNewsTemplate, starterPackTemplate,
  dmConversationTemplate, usVsThemTemplate,
] as HtmlTemplate<never>[];

const BY_MECHANISM = new Map<MechanismId, HtmlTemplate<unknown>>(TEMPLATES.map((t) => [t.mechanismId, t as HtmlTemplate<unknown>]));

export const templateFor = (mechanismId: MechanismId): HtmlTemplate<unknown> | null => BY_MECHANISM.get(mechanismId) ?? null;

export const TEMPLATE_MECHANISMS: MechanismId[] = [...BY_MECHANISM.keys()];

export const listTemplates = (): HtmlTemplate<unknown>[] => [...BY_MECHANISM.values()];
