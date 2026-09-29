"use client";

import { useEffect, useState } from "react";
import type { OutputFormat, RenderRecord } from "@/lib/types";
import { OUTPUT_FORMATS } from "@/lib/pipeline/formats";

interface LabTemplate {
  mechanism: string;
  id: string;
  name: string;
  version: number;
  ctaMode: string;
  hookMode: string;
  brandInfluence: string;
  assetSlots: { id: string; accepts: string[]; requirement: string; fit: string }[];
  cases: { id: string; label: string }[];
}

/**
 * TEMPLATE LAB — reviews art direction with the EXACT production path:
 * each tile calls /api/dev/template-lab, which runs renderVariant() (payload
 * mapping, template, fit, checks, Chromium) and returns its RenderRecord.
 */
export function TemplateLab() {
  const [templates, setTemplates] = useState<LabTemplate[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    fetch("/api/dev/template-lab")
      .then((r) => r.json())
      .then((d: { templates: LabTemplate[] }) => {
        setTemplates(d.templates);
        setActive((a) => a ?? d.templates[0]?.mechanism ?? null);
      });
  }, []);

  const t = templates?.find((x) => x.mechanism === active);
  return (
    <div className="mx-auto max-w-[1500px] px-6 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Template Lab</h1>
          <p className="text-sm text-neutral-500">Development only · production renderer · 1:1 and 9:16 side by side</p>
        </div>
        <button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => setNonce((n) => n + 1)}>
          Re-render all
        </button>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {templates?.map((x) => (
          <button key={x.mechanism} onClick={() => setActive(x.mechanism)} className={`rounded-full border px-3 py-1 text-sm ${x.mechanism === active ? "bg-black text-white" : ""}`}>
            {x.name}
          </button>
        ))}
      </div>
      {t && (
        <>
          <p className="mt-4 text-xs text-neutral-500">
            {t.id}@{t.version} · CTA {t.ctaMode} · hook {t.hookMode} · brand {t.brandInfluence} · slots:{" "}
            {t.assetSlots.map((s) => `${s.id} (${s.requirement}, ${s.fit}, ${s.accepts.join("/")})`).join("; ")}
          </p>
          <div className="mt-6 space-y-10">
            {t.cases.map((c) => (
              <section key={`${c.id}-${nonce}`}>
                <h2 className="text-sm font-medium">{c.label}</h2>
                <div className="mt-3 flex flex-wrap items-start gap-6">
                  {OUTPUT_FORMATS.map((f) => (
                    <LabTile key={f} mechanism={t.mechanism} caseId={c.id} format={f} nonce={nonce} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LabTile({ mechanism, caseId, format, nonce }: { mechanism: string; caseId: string; format: OutputFormat; nonce: number }) {
  const [record, setRecord] = useState<RenderRecord | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/dev/template-lab?mechanism=${mechanism}&case=${caseId}&format=${encodeURIComponent(format)}&n=${nonce}`)
      .then((r) => r.json())
      .then((d: { record: RenderRecord }) => live && setRecord(d.record));
    return () => {
      live = false;
    };
  }, [mechanism, caseId, format, nonce]);
  const w = format === "1:1" ? 360 : 270;
  return (
    <figure style={{ width: w }} className="text-xs">
      <div style={{ width: w, height: format === "1:1" ? 360 : 480 }} className="flex items-center justify-center overflow-hidden rounded border bg-neutral-100">
        {!record ? (
          <span className="text-neutral-400">Rendering…</span>
        ) : record.outputUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- rendered PNG
          <a href={record.outputUrl} target="_blank" rel="noreferrer"><img src={`${record.outputUrl}?t=${encodeURIComponent(record.renderedAt ?? "")}`} alt={`${mechanism} ${format}`} className="h-full w-full object-contain" /></a>
        ) : (
          <span className="p-3 text-red-700">
            {record.error?.code}: {record.error?.message}
            {record.error?.detail ? ` — ${record.error.detail}` : ""}
          </span>
        )}
      </div>
      {record && (
        <figcaption className="mt-2 space-y-0.5 text-neutral-600">
          <div>
            {format} · {record.width}×{record.height} · {record.status} · {record.durationMs} ms{record.bytes ? ` · ${Math.round(record.bytes / 1024)} KB` : ""}
          </div>
          <div>type: {record.fontSizes.map((u) => `${u.unit} ${u.px}px (min ${u.minPx})`).join(" · ") || "—"}</div>
          <div>fields: {record.renderedFields.join(", ")} · CTA {record.cta ? "on" : "off"}</div>
          <div>assets: {record.assets.map((a) => `${a.slot}=${a.role}/${a.treatment}/${a.fit}`).join(", ") || "none"}</div>
          {record.warnings.length ? <div className="text-amber-700">{record.warnings.join(" · ")}</div> : null}
        </figcaption>
      )}
    </figure>
  );
}
