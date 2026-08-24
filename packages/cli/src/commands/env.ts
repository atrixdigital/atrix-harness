import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyseEnv, collectEnvDefs, collectEnvReads, createProgramFor, type EnvFinding } from '@atrix/graph-core';
import { bold, dim, log, red, yellow } from '../lib/log.ts';
import { activeProject, listProjects } from '../lib/workspace.ts';

/**
 * Audit the environment graph.
 *
 * Never prints a value — findings are derived from hashes, so the report can say two
 * definitions differ without putting a credential in a terminal or a transcript.
 */

const LABEL: Record<EnvFinding['kind'], string> = {
  'client-exposed-secret': 'SECRET IN CLIENT BUNDLE',
  conflicting: 'CONFLICTING VALUES',
  undefined: 'read but never defined',
  duplicate: 'defined twice (same value)',
  unused: 'defined but never read',
};

const BLOCKING: EnvFinding['kind'][] = ['client-exposed-secret', 'conflicting'];

/**
 * Analysed per project, never across the workspace.
 *
 * Two projects each defining DATABASE_URL differently is correct — they are different
 * systems. Only a disagreement *within* one project means a tool is about to talk to the
 * wrong one, and merging the scopes would turn every workspace into a wall of false alarms.
 */
function readExclude(root: string): string[] {
  const path = join(root, '.atrix', 'config.json');
  if (!existsSync(path)) return ['node_modules', 'dist', '.next'];
  try {
    const config = JSON.parse(readFileSync(path, 'utf8')) as { index?: { exclude?: string[] } };
    return config.index?.exclude ?? ['node_modules', 'dist', '.next'];
  } catch {
    // A malformed config must not stop the audit — the defaults are correct for
    // almost every repo, and a skipped audit hides real conflicts.
    return ['node_modules', 'dist', '.next'];
  }
}

export function runEnv(workspaceRoot: string, args: string[]): boolean {
  const all = args.includes('--all');
  const named = args[args.indexOf('--project') + 1];
  const requested = args.includes('--project') && named !== undefined ? named : undefined;

  const active = activeProject(workspaceRoot);
  const targets =
    all || (requested === undefined && active === undefined)
      ? listProjects(workspaceRoot)
      : listProjects(workspaceRoot).filter((p) => p.name === (requested ?? active?.name));

  // No projects yet, or a session at the workspace root with none cloned in — audit the
  // workspace itself so the command is never silently useless.
  const scopes = targets.length > 0 ? targets : [{ name: '', root: workspaceRoot }];

  let blocking = 0;
  for (const scope of scopes) {
    const exclude = readExclude(scope.root);
    const program = createProgramFor({ root: scope.root, include: [], exclude, project: scope.name || 'audit' });
    const { reads, defs, findings } = analyseEnv(
      collectEnvReads(program, scope.root),
      collectEnvDefs(scope.root),
      scope.root,
    );

    const names = new Set(reads.map((r) => r.name));
    const label = scope.name === '' ? 'workspace' : scope.name;
    log.info(`${bold(label)} — ${names.size} variable(s) read, ${defs.length} definition(s)`);

    if (findings.length === 0) {
      log.ok('  no findings');
      log.blank();
      continue;
    }

    let current: EnvFinding['kind'] | undefined;
    for (const finding of findings) {
      if (finding.kind !== current) {
        current = finding.kind;
        const heading = LABEL[finding.kind];
        log.info(`  ${BLOCKING.includes(finding.kind) ? red(bold(heading)) : yellow(heading)}`);
      }
      log.info(`    ${bold(finding.name)} — ${finding.detail}`);
      for (const location of finding.locations) log.detail(`  ${location}`);
    }

    blocking += findings.filter((f) => BLOCKING.includes(f.kind)).length;
    log.blank();
  }

  if (blocking > 0) {
    log.fail(`${blocking} finding(s) can silently point a tool at the wrong system, or ship a secret.`);
    log.detail(dim('Values are never printed — differences are compared by hash.'));
  }

  return blocking === 0;
}
