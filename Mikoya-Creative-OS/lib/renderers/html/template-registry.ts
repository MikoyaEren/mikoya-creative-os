import type { MechanismId } from "@/lib/types";
import type { HtmlTemplate } from "../types";
import { imessageTemplate } from "./templates/imessage";
import { lockScreenTemplate } from "./templates/lock-screen";
import { receiptTemplate } from "./templates/receipt";

/**
 * TEMPLATE REGISTRY — one proper template per HTML mechanism (no generic
 * "ad card"). A mechanism without a template is not renderable yet and
 * says so (`no_template`); it is never drawn with another template.
 */
const TEMPLATES: HtmlTemplate<never>[] = [imessageTemplate, receiptTemplate, lockScreenTemplate] as HtmlTemplate<never>[];

const BY_MECHANISM = new Map<MechanismId, HtmlTemplate<unknown>>(TEMPLATES.map((t) => [t.mechanismId, t as HtmlTemplate<unknown>]));

export const templateFor = (mechanismId: MechanismId): HtmlTemplate<unknown> | null => BY_MECHANISM.get(mechanismId) ?? null;

export const TEMPLATE_MECHANISMS: MechanismId[] = [...BY_MECHANISM.keys()];

export const listTemplates = (): HtmlTemplate<unknown>[] => [...BY_MECHANISM.values()];
