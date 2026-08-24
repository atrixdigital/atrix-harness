import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import {
  analyseEnv,
  checkpoint,
  collectEnvDefs,
  collectEnvReads,
  collectNotes,
  createProgramFor,
  indexNotes,
  indexRepo,
  open,
  storeEnvFindings,
  type EnvFinding,
} from '@atrix/graph-core';
import { bold, dim, log } from '../lib/log.ts';
import { atrixDir, activeProject, HARNESS_PROJECT, indexTargets, type Project } from '../lib/workspace.ts';

/**
 * Index the workspace.
 *
 * One database covering every project, each row scoped by project name. That is what
 * makes "has anyone already solved this" answerable across repos while keeping the
 * default answer local — a search that returned an ezrov symbol for a playo-web question
 * would be technically a match and practically wrong.
 *
 * Environment analysis is per project by design: two projects each defining
 * `DATABASE_URL` differently is correct, not a conflict. Only a disagreement *within*
 * one project means somebody is about to talk to the wrong system.
 */

const configSchema = z.object({
  index: z
    .object({
      include: z.array(z.string()).default([]),
      exclude: z.array(z.string()).default(['node_modules', 'dist', '.next']),
    })
    .default({ include: [], exclude: ['node_modules', 'dist', '.next'] }),
});

type IndexConfig = z.infer<typeof configSchema>['index'];

/** Per-project config wins; the workspace default applies otherwise. */
function configFor(root: string, fallback: IndexConfig): IndexConfig {
  const path = join(root, '.atrix', 'config.json');
  if (!existsSync(path)) return fallback;
  try {
    const parsed = configSchema.safeParse(JSON.parse(readFileSync(path, 'utf8')));
    return parsed.success ? parsed.data.index : fallback;
  } catch {
    // A malformed per-project config falls back to the workspace default rather
    // than aborting the whole index for one bad file.
    return fallback;
  }
}

export function runIndex(workspaceRoot: string, args: string[]): boolean {
  const only = args[args.indexOf('--project') + 1];
  const requested = args.includes('--project') && only !== undefined ? only : undefined;

  // With no flag, indexing from inside a project does just that one — a developer
  // working on playo-web should not pay 40 seconds to reindex nineteen other repos.
  const active = activeProject(workspaceRoot);
  const scope = requested ?? (args.includes('--all') ? undefined : active?.name);

  const all = indexTargets(workspaceRoot);
  const targets: Project[] = scope === undefined ? all : all.filter((t) => t.name === scope);

  if (targets.length === 0) {
    log.fail(`No project named "${scope ?? ''}".`);
    log.detail(`Known: ${all.map((t) => t.name).join(', ')}`);
    return false;
  }

  const dir = atrixDir(workspaceRoot);
  mkdirSync(dir, { recursive: true });
  const db = open(join(dir, 'graph.db'));

  try {
    const workspaceConfig = configFor(workspaceRoot, configSchema.parse({}).index);
    let files = 0;
    let symbols = 0;
    const envFindings: EnvFinding[] = [];

    for (const target of targets) {
      const config = configFor(target.root, workspaceConfig);
      const options = { root: target.root, project: target.name, ...config };

      const result = indexRepo(db, options);
      files += result.files;
      symbols += result.symbols;

      const label = target.name === HARNESS_PROJECT ? dim('harness') : bold(target.name);
      log.info(
        `  ${label} — ${result.files} files, ${result.symbols} symbols, ${result.edges} edges ${dim(`${(result.durationMs / 1000).toFixed(1)}s`)}`,
      );

      if (result.skipped.length > 0) log.warn(`  ${target.name}: ${result.skipped.length} file(s) skipped`);

      // Scoped per project: a var defined differently in two projects is not a conflict.
      const program = createProgramFor(options);
      const { findings } = analyseEnv(collectEnvReads(program, target.root), collectEnvDefs(target.root), target.root);
      envFindings.push(...findings.map((f) => ({ ...f, name: `${target.name}/${f.name}` })));
    }

    storeEnvFindings(db, envFindings);

    // Notes span the workspace: org-wide incidents in the harness, per-project
    // understandings committed to each project's own repo.
    const notes = indexNotes(db, collectNotes(workspaceRoot, workspaceRoot, indexTargets(workspaceRoot).map((t) => t.root)));

    log.blank();
    log.ok(`${targets.length} target(s) — ${files} files, ${symbols} symbols, ${notes} notes`);

    const serious = envFindings.filter((f) => f.kind === 'conflicting' || f.kind === 'client-exposed-secret');
    if (serious.length > 0) log.warn(`${serious.length} environment finding(s) — run \`atrix env\``);

    return true;
  } finally {
    checkpoint(db);
    db.close();
  }
}
