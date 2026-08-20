import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCore } from '../lib/core.ts';
import { log } from '../lib/log.ts';
import { harnessPaths } from '../lib/paths.ts';

/** Upper bound on AGENTS.md. A manual nobody reads is a manual that does nothing. */
const AGENTS_MD_MAX_LINES = 60;

interface Check {
  name: string;
  ok: boolean;
  detail?: string | undefined;
}

export function doctor(harnessRoot: string, projectRoot: string): boolean {
  const p = harnessPaths(harnessRoot);
  const checks: Check[] = [];

  checks.push({ name: 'harness located', ok: true, detail: harnessRoot });

  const agentsExists = existsSync(p.agentsMd);
  if (agentsExists) {
    const lines = readFileSync(p.agentsMd, 'utf8').split('\n').length;
    checks.push({
      name: `AGENTS.md within ${AGENTS_MD_MAX_LINES} lines`,
      ok: lines <= AGENTS_MD_MAX_LINES,
      detail: `${lines} lines`,
    });
  } else {
    checks.push({ name: 'AGENTS.md present', ok: false, detail: 'missing' });
  }

  const core = loadCore(harnessRoot);
  checks.push({
    name: 'core/ validates',
    ok: core.issues.length === 0,
    detail:
      core.issues.length === 0
        ? `${core.rules.length + core.methodology.length} rules, ${core.roles.length} roles, ${core.skills.length} skills`
        : `${core.issues.length} problem(s)`,
  });

  const adaptersBuilt = existsSync(join(p.adapters, 'claude', '.claude-plugin', 'marketplace.json'));
  checks.push({
    name: 'adapters built',
    ok: adaptersBuilt,
    detail: adaptersBuilt ? undefined : 'run `atrix build`',
  });

  const indexPath = join(projectRoot, '.atrix', 'graph.db');
  const indexed = existsSync(indexPath);
  checks.push({
    name: 'code graph indexed',
    ok: indexed,
    detail: indexed ? indexPath : 'run `atrix index` (phase 3 — not yet implemented)',
  });

  for (const check of checks) {
    if (check.ok) log.ok(`${check.name}${check.detail ? ` ${'— ' + check.detail}` : ''}`);
    else log.fail(`${check.name}${check.detail ? ` — ${check.detail}` : ''}`);
  }

  if (core.issues.length > 0) {
    log.blank();
    log.fail('core/ problems:');
    for (const issue of core.issues) log.detail(`${issue.path} — ${issue.message}`);
  }

  const failed = checks.filter((c) => !c.ok);
  // The graph index is expected to be absent until phase 3 ships.
  const blocking = failed.filter((c) => c.name !== 'code graph indexed');
  return blocking.length === 0;
}
