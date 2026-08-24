import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadCore } from '../lib/core.ts';
import { danglingProvenance, listIncidents } from '../lib/incidents.ts';
import { driftReport } from './sync.ts';
import { describe, harnessVersion } from '../lib/version.ts';
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

  checks.push({ name: 'harness located', ok: true, detail: `${harnessRoot} @ ${describe(harnessVersion(harnessRoot))}` });

  // A repo silently running a months-old rule set is the failure mode that makes the
  // whole learning loop pointless.
  const drift = driftReport(harnessRoot, projectRoot);
  if (drift !== undefined) checks.push({ name: 'harness up to date', ok: false, detail: drift });

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

  // The agent runtime ships its own validator and it was available from the first day
  // this adapter existed. Nobody ran it, and a shape bug lived for weeks as a result.
  const marketplaceDir = join(p.adapters, 'claude');
  if (existsSync(join(marketplaceDir, '.claude-plugin', 'marketplace.json'))) {
    const probe = Bun.spawnSync(['which', 'claude'], { stdout: 'pipe', stderr: 'pipe' });
    if (probe.exitCode === 0) {
      const result = Bun.spawnSync(['claude', 'plugin', 'validate', marketplaceDir], { stdout: 'pipe', stderr: 'pipe' });
      const output = `${result.stdout.toString()}${result.stderr.toString()}`.trim();
      checks.push({
        name: 'claude accepts the generated marketplace',
        ok: result.exitCode === 0,
        detail: result.exitCode === 0 ? undefined : output.split('\n').slice(-2).join(' '),
      });
    }
  }

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
  let indexDetail = 'run `atrix index`';
  if (indexed) {
    const ageHours = (Date.now() - statSync(indexPath).mtimeMs) / 3_600_000;
    const age = ageHours < 1 ? 'fresh' : ageHours < 24 ? `${Math.floor(ageHours)}h old` : `${Math.floor(ageHours / 24)}d old`;
    indexDetail = `${age} — impact queries are only as current as this`;
  }
  checks.push({ name: 'code graph indexed', ok: indexed, detail: indexDetail });

  for (const check of checks) {
    if (check.ok) log.ok(`${check.name}${check.detail ? ` ${'— ' + check.detail}` : ''}`);
    else log.fail(`${check.name}${check.detail ? ` — ${check.detail}` : ''}`);
  }

  // Not a pass/fail check — a standing prompt. A harness that only grows is a harness
  // that rots, and the prune stage needs something to act on.
  const expiring = [...core.rules, ...core.methodology].filter((d) => d.meta.expires_when !== undefined);
  if (expiring.length > 0) {
    log.blank();
    log.info(`${expiring.length} rule(s) declare an expiry condition — check whether any has come true:`);
    for (const doc of expiring) log.detail(`${doc.meta.name} — ${doc.meta.expires_when ?? ''}`);
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

  return checks.every((c) => c.ok);
}
