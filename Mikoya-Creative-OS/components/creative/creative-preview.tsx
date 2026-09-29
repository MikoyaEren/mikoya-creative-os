import { Heart, MessageCircle, Play, Repeat2, Search, TriangleAlert } from "lucide-react";
import type { BrandColors, CreativeConcept, OutputFormat } from "@/lib/types";
import { getMechanism } from "@/lib/recipes";
import { cn } from "@/lib/utils";
import { ProductVisual } from "./product-visual";

interface CreativePreviewProps {
  concept: CreativeConcept;
  /** Which mandatory format variant to draw. */
  format: OutputFormat;
  productName: string;
  productImage?: string | null;
  /** Optional lifestyle photo used by scene-based mechanisms. */
  lifestyleImage?: string | null;
  /** Used for native UI chrome (avatars, receipts, notifications). */
  brandName: string;
  colors: BrandColors;
  className?: string;
}

const RATIO: Record<OutputFormat, string> = {
  "1:1": "1 / 1",
  "9:16": "9 / 16",
};

/**
 * Client-side mock render of one format variant. Once renderers are connected
 * this is replaced by `variant.previewUrl` / `outputUrl`.
 *
 * The copy and idea come from the concept and are identical in both formats;
 * the composition changes: 1:1 is compact (side-by-side, smaller product),
 * 9:16 is stacked (hook top, large product, CTA low, safe zones respected).
 * Sizes use container-query units so it scales from card to drawer.
 */
export function CreativePreview({ className, format, colors, ...rest }: CreativePreviewProps) {
  return (
    <div
      className={cn("@container relative overflow-hidden text-left", className)}
      style={{ aspectRatio: RATIO[format], background: colors.background }}
    >
      <PreviewBody format={format} colors={colors} {...rest} />
    </div>
  );
}

function PreviewBody({ concept, format, productName, productImage, lifestyleImage, brandName, colors }: CreativePreviewProps) {
  const { hook, subheadline: sub, cta } = concept;
  const brandLabel = (brandName || "Brand").toUpperCase();
  const initial = (brandName || "B").charAt(0).toLowerCase();
  const sq = format === "1:1";
  const product = (cls: string) => <ProductVisual src={productImage} name={productName} className={cls} />;
  const ctaPill = (cls?: string) => (
    <span className={cn("inline-flex rounded-full px-[4.5cqw] py-[2cqw] text-[3.2cqw] font-medium text-white", cls)} style={{ background: colors.dark }}>
      {cta}
    </span>
  );

  switch (concept.mechanism) {
    case "x_post":
      return (
        <div className={cn("flex h-full flex-col items-center p-[7cqw]", sq ? "justify-center" : "justify-between pt-[22cqw] pb-[26cqw]")}>
          <div className="w-full rounded-[3cqw] bg-white p-[5cqw] shadow-[0_2cqw_6cqw_-2cqw_rgba(0,0,0,0.18)]">
            <div className="flex items-center gap-[2.5cqw]">
              <span className="flex size-[9cqw] items-center justify-center rounded-full font-serif text-[5cqw] text-white" style={{ background: colors.dark }}>{initial}</span>
              <div className="leading-tight">
                <p className="text-[3.6cqw] font-semibold text-black">{brandName || "Brand"}</p>
                <p className="text-[3.2cqw] text-neutral-500">{concept.copyFields?.find((f) => f.key === "handle")?.text ?? ""}</p>
              </div>
            </div>
            <p className={cn("mt-[3.5cqw] leading-[1.35] text-black", sq ? "text-[4.6cqw]" : "text-[5.4cqw]")}>{hook}</p>
            <div className="mt-[4cqw] flex gap-[7cqw] text-[3cqw] text-neutral-500">
              {/* Neutral chrome only: no fabricated engagement counts. */}
              <MessageCircle className="size-[3.4cqw]" />
              <Repeat2 className="size-[3.4cqw]" />
              <Heart className="size-[3.4cqw]" />
            </div>
          </div>
          {!sq && (
            <div className="flex w-full flex-col items-center gap-[4cqw]">
              {product("h-[55cqw] w-[70cqw]")}
              {ctaPill()}
            </div>
          )}
        </div>
      );

    case "imessage":
    case "dm_conversation":
    case "friend_recommendation": {
      const outgoing = concept.mechanism === "imessage" ? "bg-[#0a84ff] text-white" : concept.mechanism === "dm_conversation" ? "bg-[#7b5cf5] text-white" : "text-white";
      const contact = concept.mechanism === "dm_conversation" ? "lena.m" : "Anna 💚";
      return (
        <div className="flex h-full flex-col bg-white">
          {sq ? (
            <div className="flex items-center gap-[2cqw] border-b border-neutral-100 px-[5cqw] py-[2.5cqw]">
              <span className="size-[6cqw] rounded-full bg-neutral-300" />
              <span className="text-[3cqw] text-neutral-700">{contact}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center border-b border-neutral-100 pt-[16cqw] pb-[3cqw]">
              <span className="size-[11cqw] rounded-full bg-neutral-300" />
              <span className="mt-[1cqw] text-[3.4cqw] text-neutral-700">{contact}</span>
            </div>
          )}
          <div className={cn("flex flex-1 flex-col justify-center px-[5cqw]", sq ? "gap-[2cqw]" : "gap-[3cqw]")}>
            <p className={cn("max-w-[78%] self-start rounded-[4cqw] bg-[#e9e9eb] px-[3.5cqw] py-[2.2cqw] leading-snug text-black", sq ? "text-[3.6cqw]" : "text-[4.4cqw]")}>{hook}</p>
            <p
              className={cn("max-w-[78%] self-end rounded-[4cqw] px-[3.5cqw] py-[2.2cqw] leading-snug whitespace-pre-line", sq ? "text-[3.6cqw]" : "text-[4.4cqw]", outgoing)}
              style={concept.mechanism === "friend_recommendation" ? { background: colors.dark } : undefined}
            >
              {sub}
            </p>
            <div className={cn("self-end overflow-hidden rounded-[4cqw] p-[2cqw]", sq ? "h-[24cqw] w-[30cqw]" : "h-[48cqw] w-[52cqw]")} style={{ background: colors.background }}>
              {product("h-full w-full")}
            </div>
          </div>
          {!sq && <div className="mx-[5cqw] mb-[18cqw] rounded-full border border-neutral-200 px-[4cqw] py-[2.5cqw] text-[3.2cqw] text-neutral-400">iMessage</div>}
        </div>
      );
    }

    case "notes_app":
    case "checklist":
      return (
        <div className={cn("flex h-full bg-[#fbfaf5] px-[7cqw]", sq ? "flex-row items-stretch gap-[3cqw] py-[6cqw]" : "flex-col pt-[18cqw] pb-[20cqw]")}>
          <div className={cn(sq && "w-[64%]")}>
            <p className="text-[3cqw] font-medium text-[#d9a400]">‹ Notes</p>
            <p className={cn("mt-[4cqw] leading-tight font-bold text-black", sq ? "text-[5.6cqw]" : "text-[7.6cqw]")}>{hook}</p>
            <p className="mt-[1.5cqw] text-[2.8cqw] text-neutral-400">Today at 07:42</p>
            <p className={cn("mt-[4cqw] leading-[1.6] whitespace-pre-line text-neutral-800", sq ? "text-[3.6cqw]" : "text-[4.8cqw]")}>{sub}</p>
          </div>
          <div className={cn("flex", sq ? "flex-1 items-end justify-end" : "mt-auto justify-center")}>
            {product(sq ? "h-[30cqw] w-full" : "h-[60cqw] w-[70cqw]")}
          </div>
        </div>
      );

    case "search_bar":
      return (
        <div className={cn("flex h-full flex-col px-[7cqw]", sq ? "pt-[8cqw] pb-[6cqw]" : "pt-[34cqw] pb-[24cqw]")}>
          <div className="flex items-center gap-[2.5cqw] rounded-full bg-white px-[4.5cqw] py-[3cqw] shadow-[0_1cqw_4cqw_rgba(0,0,0,0.1)]">
            <Search className="size-[4cqw] shrink-0 text-neutral-500" />
            <span className={cn("leading-snug text-black", sq ? "text-[3.6cqw]" : "text-[4.4cqw]")}>{hook}</span>
          </div>
          <div className={cn("mt-[3cqw] flex flex-1", sq ? "flex-row items-end gap-[3cqw]" : "flex-col gap-[6cqw]")}>
            <div className={cn("rounded-[3cqw] bg-white/80 px-[4.5cqw] py-[2.5cqw]", sq && "w-[58%] self-start")}>
              {sub.split("·").map((s) => (
                <p key={s} className="flex items-center gap-[2.5cqw] py-[1cqw] text-[3.3cqw] text-neutral-600">
                  <Search className="size-[3cqw] shrink-0 text-neutral-400" />{s.trim()}
                </p>
              ))}
            </div>
            <div className="flex flex-1 items-end justify-center">{product(sq ? "h-[42cqw] w-full" : "h-[70cqw] w-[80cqw]")}</div>
          </div>
        </div>
      );

    case "lock_screen":
      return (
        <div className={cn("flex h-full flex-col items-center px-[6cqw] text-white", sq ? "pt-[6cqw]" : "pt-[24cqw]")} style={{ background: `linear-gradient(160deg, ${colors.dark}, #0e1f14)` }}>
          <p className="text-[3.6cqw] opacity-80">Monday, 12 May</p>
          <p className={cn("leading-none font-light tracking-tight", sq ? "text-[15cqw]" : "text-[22cqw]")}>8:02</p>
          <div className={cn("w-full rounded-[4cqw] bg-white/20 p-[3.5cqw] backdrop-blur", sq ? "mt-[4cqw]" : "mt-[10cqw]")}>
            <div className="flex items-center gap-[2cqw] text-[3cqw] opacity-80">
              <span className="size-[4.5cqw] rounded-[1.2cqw] bg-[#f8f6f0]" /> {brandLabel} · now
            </div>
            <p className="mt-[1.5cqw] text-[3.8cqw] font-semibold">{hook}</p>
            <p className="text-[3.4cqw] opacity-85">{sub}</p>
          </div>
          {!sq && <div className="mt-auto mb-[22cqw] rounded-[5cqw] bg-[#f8f6f0] p-[3cqw]">{product("h-[40cqw] w-[40cqw]")}</div>}
        </div>
      );

    case "receipt":
      return (
        <div className={cn("flex h-full p-[7cqw]", sq ? "flex-row items-center gap-[3cqw]" : "relative flex-col items-center pt-0")}>
          <div className={cn("bg-white px-[5cqw] py-[6cqw] font-mono text-black shadow-[0_2cqw_5cqw_rgba(0,0,0,0.15)]", sq ? "w-[58%] -rotate-3" : "w-[80%] rotate-1 pt-[24cqw]")}>
            <p className="text-center text-[4cqw] font-bold tracking-widest">{brandLabel}</p>
            <p className="text-center text-[2.6cqw] text-neutral-500">ORDER #0042 · 08:00</p>
            <div className="my-[3cqw] border-t border-dashed border-neutral-400" />
            {sub.split("\n").map((line) => (
              <p key={line} className={cn("leading-[1.7]", sq ? "text-[2.8cqw]" : "text-[3.6cqw]")}>{line}</p>
            ))}
            <div className="my-[3cqw] border-t border-dashed border-neutral-400" />
            <p className={cn("leading-snug font-bold", sq ? "text-[3.4cqw]" : "text-[4.6cqw]")}>{hook}</p>
            <p className="mt-[3cqw] text-center text-[2.6cqw] tracking-[0.4em] text-neutral-400">|||| ||| || ||||</p>
          </div>
          {sq ? (
            <div className="flex flex-1 items-center justify-center">{product("h-[55cqw] w-full")}</div>
          ) : (
            <div className="absolute right-[6cqw] bottom-[24cqw] flex flex-col items-end gap-[3cqw]">
              {product("h-[55cqw] w-[50cqw]")}
              {ctaPill()}
            </div>
          )}
        </div>
      );

    case "warning_label":
      return (
        <div className={cn("flex h-full bg-[#f4c430] p-[7cqw] text-black", sq ? "flex-row items-center gap-[4cqw]" : "flex-col items-center justify-center gap-[8cqw]")}>
          <div className={cn("border-[1.2cqw] border-black p-[5cqw]", sq ? "w-[66%]" : "w-full")}>
            <div className={cn("flex gap-[3cqw]", sq ? "items-center" : "flex-col items-start")}>
              <TriangleAlert className={sq ? "size-[9cqw]" : "size-[18cqw]"} strokeWidth={2.4} />
              <p className={cn("leading-none font-black tracking-tight", sq ? "text-[7cqw]" : "text-[12cqw]")}>{hook}</p>
            </div>
            <p className={cn("mt-[4cqw] leading-snug font-semibold", sq ? "text-[3.6cqw]" : "text-[5cqw]")}>{sub}</p>
          </div>
          {product(sq ? "h-[40cqw] flex-1" : "h-[50cqw] w-[60cqw]")}
        </div>
      );

    case "membership_card":
      return (
        <div className={cn("flex h-full flex-col items-center p-[8cqw]", sq ? "justify-center" : "justify-center gap-[8cqw]")}>
          <div className="relative aspect-[1.586] w-full rotate-[-4deg] rounded-[4cqw] p-[5cqw] text-[#f8f6f0] shadow-[0_3cqw_8cqw_-2cqw_rgba(0,0,0,0.35)]" style={{ background: `linear-gradient(135deg, ${colors.dark}, #10301a)` }}>
            <p className="text-[2.8cqw] tracking-[0.3em] opacity-70">MEMBER</p>
            <p className="mt-[2cqw] font-serif text-[7cqw] leading-none">{hook}</p>
            <p className="absolute bottom-[5cqw] left-[5cqw] text-[2.8cqw] opacity-80">{sub}</p>
            <span className="absolute top-[5cqw] right-[5cqw] h-[7cqw] w-[10cqw] rounded-[1.2cqw] bg-gradient-to-br from-[#e8d59a] to-[#b79a4b]" />
          </div>
          {sq ? (
            <p className="mt-[6cqw] text-[3.2cqw] text-muted">{cta} →</p>
          ) : (
            <>
              {product("h-[50cqw] w-[60cqw]")}
              {ctaPill()}
            </>
          )}
        </div>
      );

    case "breaking_news":
      return (
        <div className="flex h-full flex-col bg-neutral-900 text-white">
          <div className={cn("flex flex-1 items-center justify-center p-[6cqw]", !sq && "pt-[20cqw]")} style={{ background: colors.background }}>
            {product(sq ? "h-[42cqw] w-[60cqw]" : "h-[90cqw] w-[80cqw]")}
          </div>
          <div className="flex items-center bg-[#c8102e] px-[4cqw] py-[1.5cqw] text-[3.4cqw] font-black tracking-widest">BREAKING</div>
          <div className={cn("bg-white px-[4cqw] py-[3cqw] text-black", !sq && "pb-[22cqw]")}>
            <p className={cn("leading-tight font-bold", sq ? "text-[4.2cqw]" : "text-[5.6cqw]")}>{hook.replace(/^BREAKING:\s*/i, "")}</p>
            <p className="mt-[1cqw] text-[3cqw] text-neutral-600">{sub}</p>
          </div>
        </div>
      );

    case "missing_poster":
      return (
        <div className={cn("flex h-full items-center justify-center bg-neutral-300", sq ? "p-[5cqw]" : "px-[6cqw] py-[18cqw]")}>
          <div className={cn("flex h-full w-full bg-[#fbf8ef] p-[5cqw] text-black shadow-md", sq ? "flex-row gap-[4cqw]" : "flex-col items-center")}>
            {sq ? (
              <>
                <div className="flex w-[45%] items-center justify-center border-[0.6cqw] border-black">{product("h-[80%] w-[85%]")}</div>
                <div className="flex flex-1 flex-col justify-center">
                  <p className="text-[10cqw] leading-none font-black tracking-tight">MISSING</p>
                  <p className="mt-[3cqw] text-[3.6cqw] font-bold">{hook.replace(/^MISSING:\s*/i, "")}</p>
                  <p className="mt-[1.5cqw] text-[3cqw] text-neutral-600">{sub}</p>
                </div>
              </>
            ) : (
              <>
                <p className="text-[14cqw] leading-none font-black tracking-tight">MISSING</p>
                <div className="my-[4cqw] flex w-full flex-1 items-center justify-center border-[0.6cqw] border-black">{product("h-[80%] w-[80%]")}</div>
                <p className="text-center text-[4.4cqw] font-bold">{hook.replace(/^MISSING:\s*/i, "")}</p>
                <p className="mt-[1cqw] text-center text-[3.4cqw] text-neutral-600">{sub}</p>
              </>
            )}
          </div>
        </div>
      );

    case "dictionary":
      return (
        <div className={cn("flex h-full p-[9cqw]", sq ? "flex-row items-center gap-[4cqw]" : "flex-col justify-center")}>
          <div className={cn(sq && "w-[62%]")}>
            <p className={cn("font-serif leading-none text-ink", sq ? "text-[9cqw]" : "text-[13cqw]")}>{hook.split(" (")[0]}</p>
            <p className="mt-[2cqw] text-[3.4cqw] text-muted italic">({hook.split(" (")[1] ?? "n."}</p>
            <div className="my-[4cqw] h-px w-[20cqw]" style={{ background: colors.dark }} />
            <p className={cn("font-serif leading-snug text-ink-soft", sq ? "text-[4.4cqw]" : "text-[6cqw]")}>1. {sub}</p>
          </div>
          <div className={cn("flex", sq ? "flex-1 justify-center" : "mt-[12cqw] justify-center")}>{product(sq ? "h-[42cqw] w-full" : "h-[60cqw] w-[70cqw]")}</div>
        </div>
      );

    case "red_green_flag":
    case "choose_your_fighter":
    case "starter_pack": {
      const flags = concept.mechanism === "red_green_flag";
      const items = (flags ? hook.split("·") : sub.split("·")).map((s) => s.trim());
      return (
        <div className={cn("flex h-full flex-col p-[7cqw]", !sq && "pt-[20cqw] pb-[22cqw]")}>
          <p className={cn("text-center leading-tight font-bold text-ink", sq ? "text-[5.4cqw]" : "text-[7cqw]")}>{flags ? "Red flag vs green flag" : hook}</p>
          <div className={cn("mt-[5cqw] grid flex-1 gap-[2.5cqw]", flags ? "grid-cols-2" : sq ? "grid-cols-3" : "grid-cols-1")}>
            {items.map((item, i) => (
              <div key={item} className={cn("flex items-center justify-between rounded-[3cqw] bg-white/70 p-[2.5cqw] ring-1 ring-black/5", sq || flags ? "flex-col" : "flex-row gap-[3cqw]")}>
                <div className={cn("flex items-center justify-center", sq || flags ? "w-full flex-1" : "h-full w-[40%]")}>
                  {i === (flags ? 1 : 0) ? product("h-full max-h-[40cqw] w-full") : <span className="size-[12cqw] rounded-full" style={{ background: i % 2 ? "#e9e3d3" : colors.dark, opacity: i % 2 ? 1 : 0.2 }} />}
                </div>
                <p className={cn("mt-[2cqw] leading-tight font-medium text-ink", sq || flags ? "text-center text-[3cqw]" : "flex-1 text-[4cqw]")}>{item}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "calendar":
      return (
        <div className={cn("flex h-full flex-col p-[7cqw]", !sq && "pt-[20cqw] pb-[22cqw]")}>
          <p className={cn("font-serif leading-none text-ink", sq ? "text-[7cqw]" : "text-[10cqw]")}>{hook}</p>
          <p className="mt-[2cqw] text-[3.4cqw] text-muted">{sub}</p>
          <div className={cn("grid grid-cols-7 gap-[1.5cqw]", sq ? "mt-[4cqw] w-[78%]" : "mt-[6cqw]")}>
            {Array.from({ length: 28 }, (_, i) => (
              <div key={i} className="flex aspect-square items-center justify-center rounded-[1.5cqw] text-[2.6cqw]" style={i < 19 ? { background: colors.dark, color: "#f8f6f0" } : { background: "rgba(0,0,0,0.05)", color: "#74716a" }}>
                {i < 19 ? "✓" : i + 1}
              </div>
            ))}
          </div>
          {sq ? (
            <div className="absolute right-[4cqw] bottom-[4cqw]">{product("h-[34cqw] w-[26cqw]")}</div>
          ) : (
            <div className="mt-auto flex items-end justify-between">
              {ctaPill()}
              {product("h-[48cqw] w-[48cqw]")}
            </div>
          )}
        </div>
      );

    case "review":
      return (
        <div className={cn("flex h-full p-[8cqw]", sq ? "flex-row items-center gap-[4cqw]" : "flex-col items-center justify-center text-center")}>
          <div className={cn(sq && "w-[58%]")}>
            <p className="font-serif text-[12cqw] leading-none" style={{ color: colors.dark }} aria-hidden>“</p>
            <p className={cn("mt-[3cqw] font-serif leading-[1.15] text-ink", sq ? "text-[5.6cqw]" : "text-[8cqw]")}>{hook}</p>
            <p className="mt-[3cqw] text-[3.2cqw] text-muted">{sub.replace(/^★+\s*—\s*/, "— ")}</p>
          </div>
          <div className={cn("flex", sq ? "flex-1 justify-center" : "mt-[8cqw] flex-col items-center gap-[5cqw]")}>
            {product(sq ? "h-[50cqw] w-full" : "h-[65cqw] w-[70cqw]")}
            {!sq && ctaPill()}
          </div>
        </div>
      );

    case "product_hero":
      return sq ? (
        <div className="flex h-full flex-row items-center gap-[2cqw] p-[7cqw]">
          <div className="flex h-full w-[52%] items-center justify-center">{product("h-[80%] w-full")}</div>
          <div className="flex-1">
            <p className="font-serif text-[7.2cqw] leading-[1.02] text-ink">{hook}</p>
            <p className="mt-[2cqw] text-[2.8cqw] tracking-[0.16em] text-muted uppercase">{sub}</p>
            <div className="mt-[5cqw]">{ctaPill("text-[3cqw]")}</div>
          </div>
        </div>
      ) : (
        <div className="flex h-full flex-col items-center px-[8cqw] pt-[22cqw] pb-[24cqw] text-center">
          <p className="font-serif text-[10cqw] leading-[1.02] text-ink">{hook}</p>
          <p className="mt-[2cqw] text-[3.2cqw] tracking-[0.18em] text-muted uppercase">{sub}</p>
          <div className="flex w-full flex-1 items-center justify-center py-[4cqw]">{product("h-full w-full")}</div>
          {ctaPill()}
        </div>
      );

    case "lifestyle":
    case "pov":
      if (lifestyleImage) {
        return (
          <div className="relative h-full">
            <SceneImage src={lifestyleImage} alt={`${productName} lifestyle`} />
            {sq ? (
              <>
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                <div className="absolute right-[6cqw] bottom-[6cqw] left-[6cqw] text-white">
                  <p className="font-serif text-[7cqw] leading-[1.05]">{hook}</p>
                  <div className="mt-[2.5cqw] flex items-center justify-between gap-[3cqw]">
                    <p className="text-[3.2cqw] opacity-90">{sub}</p>
                    <span className="shrink-0 rounded-full bg-white/90 px-[3.5cqw] py-[1.6cqw] text-[2.8cqw] font-medium text-black">{cta}</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/45" />
                <div className="absolute top-[22cqw] right-[7cqw] left-[7cqw] text-white">
                  <p className="font-serif text-[10cqw] leading-[1.05]">{hook}</p>
                  <p className="mt-[2.5cqw] text-[4cqw] opacity-90">{sub}</p>
                </div>
                <span className="absolute bottom-[26cqw] left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-[5cqw] py-[2.2cqw] text-[3.4cqw] font-medium whitespace-nowrap text-black">{cta}</span>
              </>
            )}
          </div>
        );
      }
      return (
        <div className="relative h-full" style={{ background: `radial-gradient(120% 90% at 70% 20%, #fff7e2 0%, ${colors.background} 45%, #d9d3c2 100%)` }}>
          <div className="absolute inset-x-0 bottom-[18%] h-[22%] bg-[#cbbfa4]/60" />
          <div className={cn("absolute", sq ? "right-[8%] bottom-[16%] h-[48%] w-[40%]" : "right-[10%] bottom-[20%] h-[40%] w-[70%]")}>{product("h-full w-full")}</div>
          <div className={cn("absolute right-[7cqw] left-[7cqw]", sq ? "top-[7cqw]" : "top-[22cqw]")}>
            <p className={cn("font-serif leading-[1.05] text-ink", sq ? "text-[7cqw]" : "text-[10cqw]")}>{hook}</p>
            <p className="mt-[2cqw] text-[3.4cqw] text-ink-soft">{sub}</p>
          </div>
        </div>
      );

    case "claymation":
    case "ai_ugc":
      return <MotionPreview concept={concept} format={format} productName={productName} productImage={productImage} lifestyleImage={lifestyleImage} brandName={brandName} colors={colors} />;

    default: {
      // Typography-led statements: don't buy this, hot take, confession, unpopular opinion, etc.
      const dark = concept.mechanism === "dont_buy_this" || concept.mechanism === "hot_take";
      const label = getMechanism(concept.mechanism).name;
      const long = hook.length > 50;
      const text = dark ? "#f8f6f0" : undefined;
      return (
        <div className={cn("flex h-full flex-col", sq ? "p-[7cqw]" : "px-[8cqw] pt-[22cqw] pb-[24cqw]")} style={dark ? { background: colors.dark, color: text } : undefined}>
          <p className={cn("text-[2.8cqw] font-medium tracking-[0.2em] uppercase", dark ? "opacity-60" : "text-muted")}>{label}</p>
          {sq ? (
            <>
              <p className={cn("mt-[4cqw] w-[68%] font-serif leading-[1.02]", long ? "text-[6.6cqw]" : "text-[10cqw]")}>{hook}</p>
              <p className={cn("mt-[3cqw] w-[60%] text-[3.4cqw] leading-snug", dark ? "opacity-80" : "text-ink-soft")}>{sub}</p>
              <span className={cn("mt-auto self-start rounded-full border px-[3.5cqw] py-[1.5cqw] text-[2.8cqw]", dark ? "border-white/30" : "border-black/15")}>{cta}</span>
              <div className="absolute right-[4cqw] bottom-[4cqw]">{product("h-[46cqw] w-[36cqw]")}</div>
            </>
          ) : (
            <>
              <p className={cn("mt-[5cqw] font-serif leading-[1.02]", long ? "text-[9cqw]" : "text-[14cqw]")}>{hook}</p>
              <p className={cn("mt-[4cqw] text-[4.4cqw] leading-snug", dark ? "opacity-80" : "text-ink-soft")}>{sub}</p>
              <div className="flex flex-1 items-center justify-center py-[4cqw]">{product("h-full max-h-[80cqw] w-[80%]")}</div>
              <span className={cn("self-center rounded-full border px-[4.5cqw] py-[2cqw] text-[3.4cqw]", dark ? "border-white/40" : "border-black/20")}>{cta}</span>
            </>
          )}
        </div>
      );
    }
  }
}

function SceneImage({ src, alt }: { src: string; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- local/public previews
  return <img src={src} alt={alt} className="absolute inset-0 size-full object-cover" draggable={false} />;
}

function MotionPreview({ concept, format, productName, productImage, lifestyleImage, colors }: CreativePreviewProps) {
  const ugc = concept.mechanism === "ai_ugc";
  const sq = format === "1:1";
  // UGC frames use the real lifestyle photo as a stand-in for the creator shot.
  const scene = ugc ? lifestyleImage : null;
  return (
    <div
      className="relative flex h-full flex-col text-white"
      style={scene ? undefined : {
        background: ugc
          ? "linear-gradient(180deg, #c9b79a 0%, #8f7b61 55%, #3d3226 100%)"
          : `radial-gradient(circle at 50% 40%, #f0c9a0 0%, #c98f63 45%, ${colors.dark} 100%)`,
      }}
    >
      {scene && (
        <>
          <SceneImage src={scene} alt={`${productName} creator scene`} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />
        </>
      )}
      <div className={cn("relative flex items-center justify-between p-[4cqw] text-[2.8cqw]", !sq && "pt-[16cqw]")}>
        <span className="rounded-full bg-black/30 px-[2.5cqw] py-[1cqw] backdrop-blur">{ugc ? "AI UGC" : "Claymation"}</span>
        <span className="rounded-full bg-black/30 px-[2.5cqw] py-[1cqw] tabular-nums backdrop-blur">{ugc ? "0:24" : "0:08"}</span>
      </div>
      <div className="flex flex-1 items-center justify-center">
        {scene ? null : ugc ? (
          <div className="relative flex h-[62%] w-[56%] items-end justify-center">
            <div className="absolute top-0 size-[26cqw] rounded-full bg-[#e8cbb0]" />
            <div className="absolute top-[24cqw] h-[45cqw] w-full rounded-t-[20cqw] bg-[#f3efe6]" />
            <div className="absolute right-[-6cqw] bottom-[8cqw] h-[26cqw] w-[20cqw]">
              <ProductVisual src={productImage} name={productName} className="h-full w-full" />
            </div>
          </div>
        ) : (
          <div className={cn("relative", sq ? "h-[55%] w-[50%]" : "h-[40%] w-[70%]")}>
            <ProductVisual src={productImage} name={productName} className="h-full w-full drop-shadow-[0_2cqw_2cqw_rgba(0,0,0,0.3)]" />
          </div>
        )}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="flex size-[14cqw] items-center justify-center rounded-full bg-white/85 text-black shadow-lg">
          <Play className="ml-[0.6cqw] size-[5.5cqw] fill-current" />
        </span>
      </div>
      <div className={cn("relative p-[5cqw]", !sq && "pb-[24cqw]")}>
        <p className={cn("text-center leading-snug font-semibold", sq ? "text-[3.8cqw]" : "text-[4.6cqw]", ugc && "rounded-[1.5cqw] bg-black/55 px-[3cqw] py-[1.5cqw]")}>{concept.hook}</p>
      </div>
    </div>
  );
}
