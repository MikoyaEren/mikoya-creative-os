import type { CreativeProject } from "./types";
import { LUMEN_PROJECT } from "./lumen";
import { MIKOYA_PROJECT } from "./mikoya";

export type { CreativeProject } from "./types";

/** Brand workspaces (mock). Add a brand by adding a project — no code changes. */
export const PROJECTS: CreativeProject[] = [MIKOYA_PROJECT, LUMEN_PROJECT];

export const DEFAULT_PROJECT_ID = MIKOYA_PROJECT.id;

export function getProject(id: string): CreativeProject {
  return PROJECTS.find((p) => p.id === id) ?? PROJECTS[0];
}
