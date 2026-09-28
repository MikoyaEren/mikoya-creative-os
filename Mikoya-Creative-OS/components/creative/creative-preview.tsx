import { BadgeCheck, Heart, MessageCircle, Play, Repeat2, Search, TriangleAlert } from "lucide-react";
import type { BrandColors, CreativeConcept } from "@/lib/types";
import { getMechanism } from "@/lib/recipes";
import { cn } from "@/lib/utils";
import { ProductVisual } from "./product-visual";

interface CreativePreviewProps {
  concept: CreativeConcept;
  productName: string;
  productImage?: string | null;
  colors: BrandColors;
  className?: string;
}

const RATIO: Record<CreativeConcept["aspectRatio"], string> = {
  "1:1": "1 / 1",
  "4:5": "4 / 5",
  "9:16": "9 / 16",
  "16:9": "16 / 9",
};

/**
 * Client-side mock render of a concept. Once renderers are connected this is
 * replaced by `concept.outputUrl`; until then it gives every mechanism a
 * recognisable, on-brand visual so the gallery can be reviewed.
 * All sizes use container-query units so it scales from card to drawer.
 */
export function CreativePreview({ concept, productName, productImage, colors, className }: CreativePreviewProps) {
  return (
    <div
      className={cn("@container relative overflow-hidden text-left", className)}
      style={{ aspectRatio: RATIO[concept.aspectRatio], background: colors.background }}
    >
      <PreviewBody concept={concept} productName={productName} productImage={productImage} colors={colors} />
    </div>
  );
}

function PreviewBody({ concept, productName, productImage, colors }: CreativePreviewProps) {
  const { hook, subheadline: sub } = concept;
  const product = (cls: string) => (
    <ProductVisual src={productImage} name={productName} dark={colors.dark} className={cls} />
  );

  switch (concept.mechanism) {
    case "x_post":
      return (
        <div className="flex h-full items-center justify-center p-[7cqw]">
          <div className="w-full rounded-[3cqw] bg-white p-[5cqw] shadow-[0_2cqw_6cqw_-2cqw_rgba(0,0,0,0.18)]">
            <div className="flex items-center gap-[2.5cqw]">
              <span className="flex size-[9cqw] items-center justify-center rounded-full font-serif text-[5cqw] text-white" style={{ background: colors.dark }}>m</span>
              <div className="leading-tight">
                <p className="flex items-center gap-[1cqw] text-[3.6cqw] font-semibold text-black">
                  sophie <BadgeCheck className="size-[3.6cqw] text-[#1d9bf0]" />
                </p>
                <p className="text-[3.2cqw] text-neutral-500">@slowmornings</p>
              </div>
            </div>
            <p className="mt-[3.5cqw] text-[4.6cqw] leading-[1.35] text-black">{hook}</p>
            <div className="mt-[4cqw] flex gap-[7cqw] text-[3cqw] text-neutral-500">
              <span className="flex items-center gap-[1cqw]"><MessageCircle className="size-[3.4cqw]" />214</span>
              <span className="flex items-center gap-[1cqw]"><Repeat2 className="size-[3.4cqw]" />1.2K</span>
              <span className="flex items-center gap-[1cqw]"><Heart className="size-[3.4cqw]" />18.4K</span>
            </div>
          </div>
        </div>
      );

    case "imessage":
    case "dm_conversation":
    case "friend_recommendation": {
      const outgoing = concept.mechanism === "imessage" ? "bg-[#0a84ff] text-white" : concept.mechanism === "dm_conversation" ? "bg-[#7b5cf5] text-white" : "text-white";
      return (
        <div className="flex h-full flex-col bg-white">
          <div className="flex flex-col items-center border-b border-neutral-100 pt-[5cqw] pb-[3cqw]">
            <span className="size-[9cqw] rounded-full bg-neutral-300" />
            <span className="mt-[1cqw] text-[3cqw] text-neutral-700">{concept.mechanism === "dm_conversation" ? "lena.m" : "Anna 💚"}</span>
          </div>
          <div className="flex flex-1 flex-col justify-center gap-[2.5cqw] px-[5cqw]">
            <p className="max-w-[78%] self-start rounded-[4cqw] bg-[#e9e9eb] px-[3.5cqw] py-[2.2cqw] text-[3.8cqw] leading-snug text-black">{hook}</p>
            <p
              className={cn("max-w-[78%] self-end rounded-[4cqw] px-[3.5cqw] py-[2.2cqw] text-[3.8cqw] leading-snug whitespace-pre-line", outgoing)}
              style={concept.mechanism === "friend_recommendation" ? { background: colors.dark } : undefined}
            >
              {sub}
            </p>
            <div className="h-[26cqw] w-[36cqw] self-end overflow-hidden rounded-[4cqw] p-[2cqw]" style={{ background: colors.background }}>
              {product("h-full w-full")}
            </div>
          </div>
        </div>
      );
    }

    case "notes_app":
    case "checklist":
      return (
        <div className="flex h-full flex-col bg-[#fbfaf5] px-[7cqw] pt-[6cqw]">
          <p className="text-[3cqw] font-medium text-[#d9a400]">‹ Notes</p>
          <p className="mt-[5cqw] text-[6.4cqw] leading-tight font-bold text-black">{hook}</p>
          <p className="mt-[1.5cqw] text-[2.8cqw] text-neutral-400">Today at 07:42</p>
          <p className="mt-[4cqw] text-[4.2cqw] leading-[1.6] whitespace-pre-line text-neutral-800">{sub}</p>
          <div className="mt-auto flex justify-end pb-[5cqw]">{product("h-[26cqw] w-[26cqw]")}</div>
        </div>
      );

    case "search_bar":
      return (
        <div className="flex h-full flex-col px-[7cqw] pt-[14cqw]">
          <div className="flex items-center gap-[2.5cqw] rounded-full bg-white px-[4.5cqw] py-[3cqw] shadow-[0_1cqw_4cqw_rgba(0,0,0,0.1)]">
            <Search className="size-[4cqw] shrink-0 text-neutral-500" />
            <span className="text-[3.8cqw] leading-snug text-black">{hook}</span>
          </div>
          <div className="mt-[2cqw] rounded-[3cqw] bg-white/80 px-[4.5cqw] py-[2.5cqw]">
            {sub.split("·").map((s) => (
              <p key={s} className="flex items-center gap-[2.5cqw] py-[1cqw] text-[3.3cqw] text-neutral-600">
                <Search className="size-[3cqw] text-neutral-400" />{s.trim()}
              </p>
            ))}
          </div>
          <div className="mt-auto flex justify-center pb-[6cqw]">{product("h-[40cqw] w-[40cqw]")}</div>
        </div>
      );

    case "lock_screen":
      return (
        <div className="flex h-full flex-col items-center px-[6cqw] pt-[12cqw] text-white" style={{ background: `linear-gradient(160deg, ${colors.dark}, #0e1f14)` }}>
          <p className="text-[4cqw] opacity-80">Monday, 12 May</p>
          <p className="text-[20cqw] leading-none font-light tracking-tight">8:02</p>
          <div className="mt-[8cqw] w-full rounded-[4cqw] bg-white/20 p-[3.5cqw] backdrop-blur">
            <div className="flex items-center gap-[2cqw] text-[3cqw] opacity-80">
              <span className="size-[4.5cqw] rounded-[1.2cqw] bg-[#f8f6f0]" /> MIKOYA · now
            </div>
            <p className="mt-[1.5cqw] text-[3.8cqw] font-semibold">{hook}</p>
            <p className="text-[3.4cqw] opacity-85">{sub}</p>
          </div>
        </div>
      );

    case "receipt":
      return (
        <div className="flex h-full items-center justify-center p-[8cqw]">
          <div className="w-[78%] -rotate-2 bg-white px-[5cqw] py-[6cqw] font-mono text-black shadow-[0_2cqw_5cqw_rgba(0,0,0,0.15)]">
            <p className="text-center text-[4cqw] font-bold tracking-widest">MIKOYA</p>
            <p className="text-center text-[2.6cqw] text-neutral-500">ORDER #0042 · 08:00</p>
            <div className="my-[3cqw] border-t border-dashed border-neutral-400" />
            {sub.split("\n").map((line) => (
              <p key={line} className="text-[3cqw] leading-[1.7]">{line}</p>
            ))}
            <div className="my-[3cqw] border-t border-dashed border-neutral-400" />
            <p className="text-[3.6cqw] leading-snug font-bold">{hook}</p>
            <p className="mt-[3cqw] text-center text-[2.6cqw] tracking-[0.4em] text-neutral-400">|||| ||| || ||||</p>
          </div>
        </div>
      );

    case "warning_label":
      return (
        <div className="flex h-full flex-col items-center justify-center bg-[#f4c430] p-[8cqw] text-black">
          <div className="w-full border-[1.2cqw] border-black p-[5cqw]">
            <div className="flex items-center gap-[3cqw]">
              <TriangleAlert className="size-[11cqw]" strokeWidth={2.4} />
              <p className="text-[9cqw] leading-none font-black tracking-tight">{hook}</p>
            </div>
            <p className="mt-[4cqw] text-[4.2cqw] leading-snug font-semibold">{sub}</p>
          </div>
          <div className="mt-[5cqw] self-end">{product("h-[24cqw] w-[24cqw]")}</div>
        </div>
      );

    case "membership_card":
      return (
        <div className="flex h-full items-center justify-center p-[8cqw]">
          <div className="relative aspect-[1.586] w-full rotate-[-4deg] rounded-[4cqw] p-[5cqw] text-[#f8f6f0] shadow-[0_3cqw_8cqw_-2cqw_rgba(0,0,0,0.35)]" style={{ background: `linear-gradient(135deg, ${colors.dark}, #10301a)` }}>
            <p className="text-[2.8cqw] tracking-[0.3em] opacity-70">MEMBER</p>
            <p className="mt-[2cqw] font-serif text-[7cqw] leading-none">{hook}</p>
            <p className="absolute bottom-[5cqw] left-[5cqw] text-[2.8cqw] opacity-80">{sub}</p>
            <span className="absolute top-[5cqw] right-[5cqw] h-[7cqw] w-[10cqw] rounded-[1.2cqw] bg-gradient-to-br from-[#e8d59a] to-[#b79a4b]" />
          </div>
        </div>
      );

    case "breaking_news":
      return (
        <div className="flex h-full flex-col bg-neutral-900 text-white">
          <div className="flex flex-1 items-center justify-center p-[6cqw]" style={{ background: colors.background }}>
            {product("h-[55cqw] w-[55cqw]")}
          </div>
          <div className="flex items-center bg-[#c8102e] px-[4cqw] py-[1.5cqw] text-[3.4cqw] font-black tracking-widest">BREAKING</div>
          <div className="bg-white px-[4cqw] py-[3cqw] text-black">
            <p className="text-[4.4cqw] leading-tight font-bold">{hook.replace(/^BREAKING:\s*/i, "")}</p>
            <p className="mt-[1cqw] text-[3cqw] text-neutral-600">{sub}</p>
          </div>
        </div>
      );

    case "missing_poster":
      return (
        <div className="flex h-full items-center justify-center bg-neutral-300 p-[7cqw]">
          <div className="flex h-full w-full flex-col items-center bg-[#fbf8ef] p-[5cqw] text-black shadow-md">
            <p className="text-[13cqw] leading-none font-black tracking-tight">MISSING</p>
            <div className="my-[3cqw] flex w-full flex-1 items-center justify-center border-[0.6cqw] border-black">{product("h-[80%] w-[80%]")}</div>
            <p className="text-center text-[3.8cqw] font-bold">{hook.replace(/^MISSING:\s*/i, "")}</p>
            <p className="mt-[1cqw] text-center text-[3cqw] text-neutral-600">{sub}</p>
          </div>
        </div>
      );

    case "dictionary":
      return (
        <div className="flex h-full flex-col justify-center p-[9cqw]">
          <p className="font-serif text-[11cqw] leading-none text-ink">{hook.split(" (")[0]}</p>
          <p className="mt-[2cqw] text-[3.4cqw] text-muted italic">({hook.split(" (")[1] ?? "n."}</p>
          <div className="my-[4cqw] h-px w-[20cqw]" style={{ background: colors.dark }} />
          <p className="font-serif text-[5.2cqw] leading-snug text-ink-soft">1. {sub}</p>
          <div className="mt-[8cqw] self-end">{product("h-[26cqw] w-[26cqw]")}</div>
        </div>
      );

    case "red_green_flag":
    case "choose_your_fighter":
    case "starter_pack": {
      const items = sub.split("·").map((s) => s.trim());
      return (
        <div className="flex h-full flex-col p-[7cqw]">
          <p className="text-center text-[6cqw] leading-tight font-bold text-ink">{concept.mechanism === "red_green_flag" ? "Red flag vs green flag" : hook}</p>
          <div className={cn("mt-[5cqw] grid flex-1 gap-[2.5cqw]", concept.mechanism === "red_green_flag" ? "grid-cols-2" : "grid-cols-3")}>
            {(concept.mechanism === "red_green_flag" ? hook.split("·").map((s) => s.trim()) : items).map((item, i) => (
              <div key={item} className="flex flex-col items-center justify-between rounded-[3cqw] bg-white/70 p-[2.5cqw] ring-1 ring-black/5">
                <div className="flex w-full flex-1 items-center justify-center">{i === (concept.mechanism === "red_green_flag" ? 1 : 0) ? product("h-[26cqw] w-full") : <span className="size-[12cqw] rounded-full" style={{ background: i % 2 ? "#e9e3d3" : colors.dark, opacity: i % 2 ? 1 : 0.2 }} />}</div>
                <p className="mt-[2cqw] text-center text-[3cqw] leading-tight font-medium text-ink">{item}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    case "calendar":
      return (
        <div className="flex h-full flex-col p-[7cqw]">
          <p className="font-serif text-[8cqw] leading-none text-ink">{hook}</p>
          <p className="mt-[2cqw] text-[3.4cqw] text-muted">{sub}</p>
          <div className="mt-[5cqw] grid grid-cols-7 gap-[1.5cqw]">
            {Array.from({ length: 28 }, (_, i) => (
              <div key={i} className="flex aspect-square items-center justify-center rounded-[1.5cqw] text-[2.6cqw]" style={i < 19 ? { background: colors.dark, color: "#f8f6f0" } : { background: "rgba(0,0,0,0.05)", color: "#74716a" }}>
                {i < 19 ? "🍵" : i + 1}
              </div>
            ))}
          </div>
          <div className="mt-auto self-end">{product("h-[22cqw] w-[22cqw]")}</div>
        </div>
      );

    case "review":
      return (
        <div className="flex h-full flex-col items-center justify-center p-[8cqw] text-center">
          <p className="text-[6cqw] tracking-[0.2em]" style={{ color: colors.dark }}>★★★★★</p>
          <p className="mt-[4cqw] font-serif text-[6.6cqw] leading-[1.15] text-ink">{hook}</p>
          <p className="mt-[3cqw] text-[3.2cqw] text-muted">{sub.replace(/^★+\s*—\s*/, "— ")}</p>
          <div className="mt-[6cqw]">{product("h-[30cqw] w-[30cqw]")}</div>
        </div>
      );

    case "product_hero":
      return (
        <div className="flex h-full flex-col items-center p-[8cqw] text-center">
          <p className="font-serif text-[8.5cqw] leading-[1.02] text-ink">{hook}</p>
          <p className="mt-[2cqw] text-[3cqw] tracking-[0.18em] text-muted uppercase">{sub}</p>
          <div className="flex w-full flex-1 items-center justify-center py-[4cqw]">{product("h-full max-h-[70cqw] w-[70%]")}</div>
          <span className="rounded-full px-[5cqw] py-[2cqw] text-[3cqw] font-medium text-white" style={{ background: colors.dark }}>{concept.cta}</span>
        </div>
      );

    case "lifestyle":
    case "pov":
      return (
        <div className="relative h-full" style={{ background: `radial-gradient(120% 90% at 70% 20%, #fff7e2 0%, ${colors.background} 45%, #d9d3c2 100%)` }}>
          <div className="absolute inset-x-0 bottom-[18%] h-[22%] bg-[#cbbfa4]/60" />
          <div className="absolute right-[12%] bottom-[20%] h-[42%] w-[36%]">{product("h-full w-full")}</div>
          <div className="absolute top-[7cqw] left-[7cqw] right-[7cqw]">
            <p className="font-serif text-[8cqw] leading-[1.05] text-ink">{hook}</p>
            <p className="mt-[2cqw] text-[3.4cqw] text-ink-soft">{sub}</p>
          </div>
        </div>
      );

    case "claymation":
    case "ai_ugc":
      return <MotionPreview concept={concept} productName={productName} productImage={productImage} colors={colors} />;

    default: {
      // Typography-led statements: don't buy this, hot take, confession, unpopular opinion, etc.
      const dark = concept.mechanism === "dont_buy_this" || concept.mechanism === "hot_take";
      const label = getMechanism(concept.mechanism).name;
      return (
        <div className="flex h-full flex-col p-[8cqw]" style={dark ? { background: colors.dark, color: "#f8f6f0" } : undefined}>
          <p className={cn("text-[2.8cqw] font-medium tracking-[0.2em] uppercase", dark ? "opacity-60" : "text-muted")}>{label}</p>
          <p className={cn("mt-[5cqw] font-serif leading-[1.02]", hook.length > 50 ? "text-[8cqw]" : "text-[12cqw]")}>{hook}</p>
          <p className={cn("mt-[4cqw] text-[3.8cqw] leading-snug", dark ? "opacity-80" : "text-ink-soft")}>{sub}</p>
          <div className="mt-auto flex items-end justify-between">
            <span className={cn("rounded-full border px-[3.5cqw] py-[1.5cqw] text-[2.8cqw]", dark ? "border-white/30" : "border-black/15")}>{concept.cta}</span>
            {product("h-[30cqw] w-[30cqw]")}
          </div>
        </div>
      );
    }
  }
}

function MotionPreview({ concept, productName, productImage, colors }: CreativePreviewProps) {
  const ugc = concept.mechanism === "ai_ugc";
  return (
    <div
      className="relative flex h-full flex-col text-white"
      style={{
        background: ugc
          ? "linear-gradient(180deg, #c9b79a 0%, #8f7b61 55%, #3d3226 100%)"
          : `radial-gradient(circle at 50% 40%, #f0c9a0 0%, #c98f63 45%, ${colors.dark} 100%)`,
      }}
    >
      <div className="flex items-center justify-between p-[4cqw] text-[2.8cqw]">
        <span className="rounded-full bg-black/30 px-[2.5cqw] py-[1cqw] backdrop-blur">{ugc ? "AI UGC" : "Claymation"}</span>
        <span className="rounded-full bg-black/30 px-[2.5cqw] py-[1cqw] tabular-nums backdrop-blur">{ugc ? "0:24" : "0:08"}</span>
      </div>
      <div className="flex flex-1 items-center justify-center">
        {ugc ? (
          <div className="relative flex h-[62%] w-[56%] items-end justify-center">
            <div className="absolute top-0 size-[26cqw] rounded-full bg-[#e8cbb0]" />
            <div className="absolute top-[24cqw] h-[45cqw] w-full rounded-t-[20cqw] bg-[#f3efe6]" />
            <div className="absolute right-[-6cqw] bottom-[8cqw] h-[26cqw] w-[20cqw]">
              <ProductVisual src={productImage} name={productName} dark={colors.dark} className="h-full w-full" />
            </div>
          </div>
        ) : (
          <div className="relative h-[46%] w-[60%]">
            <ProductVisual src={productImage} name={productName} dark={colors.dark} className="h-full w-full drop-shadow-[0_2cqw_2cqw_rgba(0,0,0,0.3)]" />
          </div>
        )}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="flex size-[14cqw] items-center justify-center rounded-full bg-white/85 text-black shadow-lg">
          <Play className="ml-[0.6cqw] size-[5.5cqw] fill-current" />
        </span>
      </div>
      <div className="p-[5cqw]">
        <p className={cn("text-center text-[4cqw] leading-snug font-semibold", ugc && "rounded-[1.5cqw] bg-black/55 px-[3cqw] py-[1.5cqw]")}>{concept.hook}</p>
      </div>
    </div>
  );
}
