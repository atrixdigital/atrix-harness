import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

/**
 * The workspace model.
 *
 * Developers clone the harness, launch their agent at its root, and keep every project
 * under `projects/`. Each project is an independent git repo, gitignored here, so client
 * code never merges into a shared org repo.
 *
 * That makes the working directory the *workspace*, not the project — which breaks the
 * naive assumption that `process.cwd()` identifies what is being worked on. Everything
 * project-scoped resolves through this module instead.
 */

export const PROJECTS_DIR = 'projects';

/** The harness itself, indexed alongside projects under this reserved name. */
export const HARNESS_PROJECT = '.harness';

export interface Project {
  /** Directory name under projects/, used as the scope key everywhere. */
  name: string;
  root: string;
}

export function listProjects(workspaceRoot: string): Project[] {
  const dir = join(workspaceRoot, PROJECTS_DIR);
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((entry) => !entry.startsWith('.'))
    .map((entry) => ({ name: entry, root: join(dir, entry) }))
    .filter((project) => {
      try {
        return statSync(project.root).isDirectory();
      } catch {
        return false;
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Which project a path belongs to.
 *
 * Returns undefined for a path inside the workspace but outside `projects/` — the harness
 * itself is not a project, and treating it as one would put rule edits in a project's
 * trace.
 */
export function projectFor(workspaceRoot: string, path: string): Project | undefined {
  const rel = relative(workspaceRoot, resolve(path));
  if (rel.startsWith('..')) return undefined;

  const segments = rel.split(sep);
  if (segments[0] !== PROJECTS_DIR || segments[1] === undefined || segments[1] === '') return undefined;

  const name = segments[1];
  return { name, root: join(workspaceRoot, PROJECTS_DIR, name) };
}

/**
 * The project the agent is currently working in.
 *
 * `cwd` is checked first — a developer who has actually `cd`'d into a project means that
 * one. `ATRIX_PROJECT` overrides, for a session that stays at the workspace root.
 * Returning undefined means "the workspace as a whole", which is a legitimate answer, not
 * a failure: rule edits and cross-project searches genuinely have no single project.
 */
export function activeProject(workspaceRoot: string, cwd: string = process.cwd()): Project | undefined {
  const named = process.env.ATRIX_PROJECT;
  if (named !== undefined && named !== '') {
    const root = join(workspaceRoot, PROJECTS_DIR, named);
    if (existsSync(root)) return { name: named, root };
  }
  return projectFor(workspaceRoot, cwd);
}

/**
 * Everything indexable: each project, plus the harness under a reserved name.
 *
 * The harness is included so `atrix recall` and symbol search work while someone is
 * editing rules — the most common thing a contributor does in this repo.
 */
export function indexTargets(workspaceRoot: string): Project[] {
  return [{ name: HARNESS_PROJECT, root: workspaceRoot }, ...listProjects(workspaceRoot)];
}

/** Per-developer state. Never committed — `.atrix/` is gitignored. */
export const atrixDir = (workspaceRoot: string): string => join(workspaceRoot, '.atrix');
