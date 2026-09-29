import { existsSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import { afterAll, describe, expect, it } from "vitest";
import { OUTPUT_FORMATS } from "@/lib/pipeline/formats";
import { validateCopyFields, validateHook } from "@/lib/concepts/copy-fields";
import { getRecipeForMechanism } from "@/lib/recipes";
import { TEMPLATE_MECHANISMS, templateFor } from "./html/template-registry";
import { capacityCases } from "./lab/capacity";
import { renderLabCase } from "./lab/run-lab";
import { ChromiumRasterizer } from "./rasterize/chromium";
import { FsRenderStore } from "./store/fs-store";

/**
 * RECIPE CAPACITY — the maximum copy every HTML recipe allows (generated
 * from the recipe: all fields at their limits, capacity rules applied, every
 * visual / pattern choice, and the concept hook: at its limit where the
 * template draws it, 200 characters where it never does) must render at
 * readable sizes in BOTH formats.
 * A recipe may not tell the writer a combination is valid that its template
 * cannot draw without shrinking below the type floors or truncating.
 */
const executable = process.env.CREATIVE_OS_CHROMIUM_PATH || chromium.executablePath();

describe.skipIf(!existsSync(executable))("recipe capacity in Chromium", () => {
  const store = new FsRenderStore(mkdtempSync(path.join(os.tmpdir(), "capacity-")));
  const rasterizer = new ChromiumRasterizer((h) => store.readAsset(h));
  afterAll(() => rasterizer.close());

  it("declares hook limits exactly for the templates that draw the hook", () => {
    for (const mechanism of TEMPLATE_MECHANISMS) expect(Boolean(getRecipeForMechanism(mechanism).hook), mechanism).toBe(templateFor(mechanism)!.hookMode !== "none");
  });

  it("renders the maximum copy of every HTML recipe in 1:1 and 9:16, including any drawn hook", async () => {
    const failures: string[] = [];
    let renders = 0;
    for (const mechanism of TEMPLATE_MECHANISMS) {
      for (const c of capacityCases(mechanism)) {
        const valid = validateCopyFields(mechanism, c.concept.copyFields!);
        expect(valid.ok ? [] : valid.issues, `${mechanism} ${c.label}`).toEqual([]);
        expect(validateHook(mechanism, c.concept.hook, c.concept.copyFields!), `${mechanism} ${c.label}`).toEqual([]);
        for (const format of OUTPUT_FORMATS) {
          const { record } = await renderLabCase(c, format, { rasterizer, store });
          renders += 1;
          if (record.status !== "complete") failures.push(`${mechanism} ${format} ${c.label}: ${record.error?.code} ${record.error?.detail ?? record.error?.message ?? ""}`);
          // The maximum payload includes the hook exactly where the template draws it.
          else if (record.renderedFields.includes("hook") !== c.id.startsWith("cap_drawn")) failures.push(`${mechanism} ${format} ${c.label}: hook drawn = ${record.renderedFields.includes("hook")}`);
        }
      }
    }
    if (process.env.CAPACITY_REPORT) console.log(`[capacity] ${renders} renders\n${failures.join("\n")}`);
    expect(renders).toBeGreaterThan(180);
    expect(failures).toEqual([]);
  }, 600_000);
});
