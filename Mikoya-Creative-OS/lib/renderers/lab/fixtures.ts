import type { CopyField, MechanismId } from "@/lib/types";
import type { RenderConceptInput } from "../render-variant";

/**
 * TEMPLATE LAB FIXTURES — neutral, product-agnostic concept copy for
 * reviewing templates. Brands come from workspace data ("A" / "B"), assets
 * from the lab asset sets; the words below are generic on purpose.
 */
export type LabBrand = "A" | "B";

export interface LabCase {
  id: string;
  label: string;
  brand: LabBrand;
  withAssets: boolean;
  cta: boolean;
  concept: Omit<RenderConceptInput, "renderer">;
  /** Expected outcome when the case exists to prove a failure path. */
  expect?: "fail";
}

const t = (key: string, text: string): CopyField => ({ key, text, rows: [] });
const rows = (key: string, r: [string, string, string?][]): CopyField => ({ key, text: "", rows: r.map(([label, text, note]) => ({ label, text, note: note ?? "" })) });

const IMESSAGE: LabCase[] = [
  {
    id: "short",
    label: "Short copy · Brand A · with photo",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: {
      mechanism: "imessage",
      hook: "you look weirdly rested lately",
      cta: "See what changed",
      copyFields: [rows("messages", [["them", "you look weirdly rested lately"], ["me", "new morning thing. phone stays in the other room"], ["them", "ok tell me everything"]]), t("contact", "Jules")],
    },
  },
  {
    id: "headline",
    label: "Distinct hook → headline · Brand B · no asset",
    brand: "B",
    withAssets: false,
    cta: true,
    concept: {
      mechanism: "imessage",
      hook: "The text every group chat sends eventually",
      cta: "Start tonight",
      copyFields: [rows("messages", [["them", "ok what is your evening routine now"], ["me", "ten quiet minutes. lamp on, phone off"], ["them", "that's it?"], ["me", "that's it. best part of my day"]]), t("contact", "Sam")],
    },
  },
  {
    id: "min_rows",
    label: "Minimum rows (2) · Brand A · no asset",
    brand: "A",
    withAssets: false,
    cta: false,
    concept: { mechanism: "imessage", hook: "is this a phase", cta: "Try it", copyFields: [rows("messages", [["them", "is this a phase"], ["me", "it's been three months"]]), t("contact", "Ava")] },
  },
  {
    id: "max_rows",
    label: "Maximum rows (6), long but valid · Brand B · with product",
    brand: "B",
    withAssets: true,
    cta: false,
    concept: {
      mechanism: "imessage",
      hook: "be honest with me",
      cta: "Try it",
      copyFields: [
        rows("messages", [
          ["them", "be honest, did you change something?"],
          ["me", "i stopped starting the day on my phone"],
          ["them", "and that actually works for you?"],
          ["me", "weirdly yes. first ten minutes are mine now"],
          ["them", "ok send me whatever you're using"],
          ["me", "sending it now. thank me in a week"],
        ]),
        t("contact", "Alexandra"),
      ],
    },
  },
];

const RECEIPT: LabCase[] = [
  {
    id: "short",
    label: "Short copy · Brand A · with product",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: {
      mechanism: "receipt",
      hook: "Itemised: the best part of the day",
      cta: "Get yours",
      copyFields: [rows("items", [["1x", "slow start", "free"], ["1x", "window seat", "free"], ["0x", "rushing", ""]]), t("total", "one good morning")],
    },
  },
  {
    id: "long",
    label: "Maximum rows (5), longest valid items · Brand A · with product · CTA",
    brand: "A",
    withAssets: true,
    cta: true,
    concept: {
      mechanism: "receipt",
      hook: "What the first hour actually costs",
      cta: "Get yours",
      copyFields: [
        rows("items", [
          ["1x", "ten quiet minutes before email", "free"],
          ["1x", "phone face down on the counter", "free"],
          ["1x", "one playlist, zero skipping", "free"],
          ["2x", "deep breaths by the open window", "free"],
          ["0x", "rushing out of the door again", "saved"],
        ]),
        t("total", "a morning you actually keep"),
      ],
    },
  },
  {
    id: "brand_b",
    label: "Brand B · no asset · hook repeats the total (no headline)",
    brand: "B",
    withAssets: false,
    cta: false,
    concept: {
      mechanism: "receipt",
      hook: "Total: an evening that's yours",
      cta: "Get yours",
      copyFields: [rows("items", [["1x", "warm light, low", "free"], ["1x", "book, not a screen", "free"], ["1x", "early night", "priceless"]]), t("total", "an evening that's yours")],
    },
  },
  {
    id: "min_rows",
    label: "Minimum rows (3) · Brand B · with product",
    brand: "B",
    withAssets: true,
    cta: false,
    concept: { mechanism: "receipt", hook: "Receipt for a better night", cta: "Get yours", copyFields: [rows("items", [["", "lamp on", ""], ["", "phone off", ""], ["", "lights out", ""]]), t("total", "eight real hours")] },
  },
];

const LOCK_SCREEN: LabCase[] = [
  {
    id: "short",
    label: "Short copy · Brand A · lifestyle wallpaper",
    brand: "A",
    withAssets: true,
    cta: false,
    concept: {
      mechanism: "lock_screen",
      hook: "Slow start. Phone stays face down.",
      cta: "",
      copyFields: [rows("notifications", [["Reminders", "Slow start. Phone stays face down.", "now"], ["Calendar", "Nothing until 10:00", "7:00"]]), t("time", "7:12")],
    },
  },
  {
    id: "headline",
    label: "Distinct hook → headline · Brand B · synthetic scene wallpaper",
    brand: "B",
    withAssets: true,
    cta: false,
    concept: {
      mechanism: "lock_screen",
      hook: "Your phone already knows the plan",
      cta: "",
      copyFields: [rows("notifications", [["Reminders", "Lamp on. Screens off.", "now"], ["Focus", "Evening wind-down is on", "21:30"]]), t("time", "21:42")],
    },
  },
  {
    id: "max_rows",
    label: "Maximum rows (4), long but valid · Brand A · no asset",
    brand: "A",
    withAssets: false,
    cta: false,
    concept: {
      mechanism: "lock_screen",
      hook: "four notifications you'd actually want",
      cta: "",
      copyFields: [
        rows("notifications", [
          ["Reminders", "Ten quiet minutes before anything else", "now"],
          ["Calendar", "Nothing scheduled until ten. Take it slow", "7:00"],
          ["Weather", "Clear and bright all morning", "6:45"],
          ["Notes", "The first hour is not for email", "6:30"],
        ]),
        t("time", "7:12"),
      ],
    },
  },
  {
    id: "min_rows",
    label: "Minimum rows (1) · Brand B · lifestyle wallpaper",
    brand: "B",
    withAssets: true,
    cta: false,
    concept: { mechanism: "lock_screen", hook: "one reminder", cta: "", copyFields: [rows("notifications", [["Reminders", "Lights low. You earned an early night.", "now"]]), t("time", "22:10")] },
  },
];

export const LAB_CASES: Partial<Record<MechanismId, LabCase[]>> = {
  imessage: IMESSAGE,
  receipt: RECEIPT,
  lock_screen: LOCK_SCREEN,
};
