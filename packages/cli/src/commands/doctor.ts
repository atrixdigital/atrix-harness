import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadCore } from '../lib/core.ts';
import { danglingProvenance, listIncidents } from '../lib/incidents.ts';
import { log } from '../lib/log.ts';
import { harnessPaths } from '../lib/paths.ts';

/** Upper bound on AGENTS.md. A manual nobody reads is a manual that does nothing. */
const AGENTS_MD_MAX_LINES = 60;

/**
 * Codex and Gemini load the whole rule bundle every session — there is no progressive
 * disclosure to fall back on. This budget is what stops the rule set growing until it
 * crowds out the work. When it trips, prune or scope rules; do not raise the number.
 */
const BUNDLE_TOKEN_BUDGET = 12_000;

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
    // A trailing newline is a line terminator, not an extra line.
    const lines = readFileSync(p.agentsMd, 'utf8').replace(/\n$/, '').split('\n').length;
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

  const { incidents, issues: incidentIssues } = listIncidents(harnessRoot);
  checks.push({
    name: 'incidents validate',
    ok: incidentIssues.length === 0,
    detail:
      incidentIssues.length === 0
        ? `${incidents.length} incident(s)`
        : `${incidentIssues.length} problem(s)`,
  });

  // The provenance invariant is only real if the citation resolves. A rule pointing at
  // an incident nobody can read is the same as a rule with no justification at all.
  const dangling = danglingProvenance(
    harnessRoot,
    [...core.rules, ...core.methodology].map((d) => ({ path: d.path, source: d.meta.source })),
  );
  checks.push({
    name: 'rule provenance resolves',
    ok: dangling.length === 0,
    detail: dangling.length === 0 ? undefined : `${dangling.length} dangling citation(s)`,
  });

  const adaptersBuilt = existsSync(join(p.adapters, 'claude', '.claude-plugin', 'marketplace.json'));
  checks.push({
    name: 'adapters built',
    ok: adaptersBuilt,
    detail: adaptersBuilt ? undefined : 'run `atrix build`',
  });

  const bundlePath = join(p.adapters, 'codex', 'AGENTS.md');
  if (existsSync(bundlePath)) {
    // Word count × 4/3 is a rough but stable proxy; precision is not the point, the trend is.
    const words = readFileSync(bundlePath, 'utf8').split(/\s+/).filter((w) => w !== '').length;
    const tokens = Math.round((words * 4) / 3);
    const pct = Math.round((tokens / BUNDLE_TOKEN_BUDGET) * 100);
    checks.push({
      name: 'rule bundle within context budget',
      ok: tokens <= BUNDLE_TOKEN_BUDGET,
      detail: `~${tokens.toLocaleString()} tokens, ${pct}% of ${BUNDLE_TOKEN_BUDGET.toLocaleString()}`,
    });
  }

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

  const problems = [
    ...core.issues.map((i) => `${i.path} — ${i.message}`),
    ...incidentIssues,
    ...dangling,
  ];
  if (problems.length > 0) {
    log.blank();
    log.fail('problems:');
    for (const problem of problems) log.detail(problem);
  }

  const failed = checks.filter((c) => !c.ok);
  // The graph index is expected to be absent until phase 3 ships.
  const blocking = failed.filter((c) => c.name !== 'code graph indexed');
  return blocking.length === 0;
}
