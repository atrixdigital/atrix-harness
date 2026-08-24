import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyseEnv, collectEnvDefs, collectEnvReads, createProgramFor, type EnvFinding } from '@atrix/graph-core';
import { bold, dim, log, red, yellow } from '../lib/log.ts';

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

export function runEnv(projectRoot: string): boolean {
  const configPath = join(projectRoot, '.atrix', 'config.json');
  const exclude = existsSync(configPath)
    ? ((JSON.parse(readFileSync(configPath, 'utf8')) as { index?: { exclude?: string[] } }).index?.exclude ?? [])
    : ['node_modules', 'dist', '.next'];

  const program = createProgramFor({ root: projectRoot, include: [], exclude });
  const { reads, defs, findings } = analyseEnv(
    collectEnvReads(program, projectRoot),
    collectEnvDefs(projectRoot),
    projectRoot,
  );

  const names = new Set(reads.map((r) => r.name));
  log.info(`${names.size} variable(s) read across ${new Set(reads.map((r) => r.path)).size} file(s), ${defs.length} definition(s)`);
  log.blank();

  if (findings.length === 0) {
    log.ok('no findings');
    return true;
  }

  let current: EnvFinding['kind'] | undefined;
  for (const finding of findings) {
    if (finding.kind !== current) {
      current = finding.kind;
      log.blank();
      const heading = LABEL[finding.kind];
      log.info(BLOCKING.includes(finding.kind) ? red(bold(heading)) : yellow(heading));
    }
    log.info(`  ${bold(finding.name)} — ${finding.detail}`);
    for (const location of finding.locations) log.detail(location);
  }

  const blocking = findings.filter((f) => BLOCKING.includes(f.kind));
  log.blank();
  if (blocking.length > 0) {
    log.fail(`${blocking.length} finding(s) can silently point a tool at the wrong system, or ship a secret.`);
    log.detail(dim('Values are never printed — differences are compared by hash.'));
  }

  return blocking.length === 0;
}
