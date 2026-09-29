import path from "node:path";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import type { RenderRecord } from "@/lib/types";

/**
 * IMAGE JOB STORE — one JSON file per image render job next to the render
 * store (`<data>/image-jobs/<jobId>.json`). It survives server restarts, so
 * a slow provider job is never lost or resubmitted: status calls resume it
 * from here (also after the local waiting window, a reload or a restart).
 * Replace with a database table once one exists.
 */
export interface ImageJob {
  jobId: string;
  batchId: string;
  variantId: string;
  /** Provider id to poll with (null when the submit itself failed). */
  providerJobId: string | null;
  submittedAtMs: number;
  /** Do not poll the provider before this time (documented 429 wait). */
  nextPollAtMs: number;
  polls: number;
  record: RenderRecord;
}

export const JOB_ID = /^img_[A-Za-z0-9_-]{1,100}$/;

export interface ImageJobStore {
  get(jobId: string): Promise<ImageJob | null>;
  put(job: ImageJob): Promise<void>;
  /** The most recently submitted job of a variant (the one a new submit would replace). */
  latestForVariant(variantId: string): Promise<ImageJob | null>;
}

const latest = (jobs: ImageJob[]) => jobs.reduce<ImageJob | null>((a, j) => (!a || j.submittedAtMs > a.submittedAtMs ? j : a), null);

export class FsImageJobStore implements ImageJobStore {
  private readonly dir: string;
  constructor(root: string) {
    this.dir = path.join(root, "image-jobs");
  }

  async get(jobId: string) {
    if (!JOB_ID.test(jobId)) return null;
    return readFile(path.join(this.dir, `${jobId}.json`), "utf8").then((s) => JSON.parse(s) as ImageJob, () => null);
  }

  async put(job: ImageJob) {
    if (!JOB_ID.test(job.jobId)) throw new Error("Invalid image job id.");
    await mkdir(this.dir, { recursive: true });
    const file = path.join(this.dir, `${job.jobId}.json`);
    await writeFile(`${file}.tmp`, JSON.stringify(job));
    await rename(`${file}.tmp`, file);
  }

  async latestForVariant(variantId: string) {
    const names = await readdir(this.dir).catch(() => [] as string[]);
    const ids = names.filter((n) => n.endsWith(".json")).map((n) => n.slice(0, -5));
    const jobs = await Promise.all(ids.map((id) => this.get(id)));
    return latest(jobs.filter((j): j is ImageJob => !!j && j.variantId === variantId));
  }
}

/** In-memory store (tests). */
export class MemoryImageJobStore implements ImageJobStore {
  readonly jobs = new Map<string, ImageJob>();
  async get(jobId: string) {
    const j = this.jobs.get(jobId);
    return j ? (JSON.parse(JSON.stringify(j)) as ImageJob) : null;
  }
  async put(job: ImageJob) {
    this.jobs.set(job.jobId, JSON.parse(JSON.stringify(job)) as ImageJob);
  }
  async latestForVariant(variantId: string) {
    const j = latest([...this.jobs.values()].filter((x) => x.variantId === variantId));
    return j ? (JSON.parse(JSON.stringify(j)) as ImageJob) : null;
  }
}
