import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { AtrixError } from './log.ts';

/** Marker that identifies the atrix-harness repo itself (not a consuming project). */
const HARNESS_MARKER = 'core/rules';

/**
 * Walk up from `start` looking for the atrix-harness checkout.
 * Falls back to ATRIX_HOME so `atrix` works from inside a consuming repo.
 */
export function findHarnessRoot(start: string = process.cwd()): string {
  const override = process.env.ATRIX_HOME;
  if (override) {
    const abs = resolve(override);
    if (!existsSync(join(abs, HARNESS_MARKER))) {
      throw new AtrixError(
        `ATRIX_HOME is set to ${abs} but that is not an atrix-harness checkout.`,
        'Point ATRIX_HOME at your atrix-harness clone, or unset it.',
      );
    }
    return abs;
  }

  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, HARNESS_MARKER)) && existsSync(join(dir, 'AGENTS.md'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new AtrixError(
    'Could not locate the atrix-harness checkout.',
    'Run this from inside atrix-harness, or set ATRIX_HOME=/path/to/atrix-harness.',
  );
}

/** The project being worked on — a consuming repo, or the harness itself. */
export function findProjectRoot(start: string = process.cwd()): string {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, '.git'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(start);
}

export const harnessPaths = (root: string) => ({
  root,
  agentsMd: join(root, 'AGENTS.md'),
  core: join(root, 'core'),
  rules: join(root, 'core', 'rules'),
  methodology: join(root, 'core', 'methodology'),
  skills: join(root, 'core', 'skills'),
  roles: join(root, 'core', 'roles'),
  playbooks: join(root, 'core', 'playbooks'),
  adapters: join(root, 'adapters'),
  learning: join(root, 'learning'),
  incidents: join(root, 'learning', 'incidents'),
  candidates: join(root, 'learning', 'candidates'),
  evals: join(root, 'evals'),
});
