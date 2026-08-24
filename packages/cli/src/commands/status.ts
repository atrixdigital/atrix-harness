import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Database } from 'bun:sqlite';
import { loadCore } from '../lib/core.ts';
import { listIncidents } from '../lib/incidents.ts';
import { bold, dim, green, log, red, yellow } from '../lib/log.ts';
import { harnessPaths } from '../lib/paths.ts';
import { describe as describeVersion, harnessVersion } from '../lib/version.ts';
import { driftReport } from './sync.ts';
import { activeProject, listProjects } from '../lib/workspace.ts';

/**
 * One view of everything, for a human.
 *
 * `doctor` answers "is it wired up correctly"; this answers "what is the state of my work
 * and what should I do about it". Keeping them separate matters: doctor is a gate that
 * must stay fast and binary, and folding advice into a gate makes it noisy to run in CI.
 */

interface Row {
  label: string;
  value: string;
  hint?: string | undefined;
}

function render(heading: string, rows: Row[]): void {
  log.info(bold(heading));
  const width = Math.max(...rows.map((r) => r.label.length));
  for (const row of rows) {
    log.info(`  ${row.label.padEnd(width)}  ${row.value}${row.hint === undefined ? '' : `  ${dim(row.hint)}`}`);
  }
  log.blank();
}

export function status(harnessRoot: string, projectRoot: string): boolean {
  const p = harnessPaths(harnessRoot);
  const core = loadCore(harnessRoot);
  const version = harnessVersion(harnessRoot);

  render('Harness', [
    { label: 'version', value: describeVersion(version) },
    { label: 'content', value: `${core.rules.length + core.methodology.length} rules · ${core.roles.length} roles · ${core.skills.length} skills` },
    { label: 'problems', value: core.issues.length === 0 ? green('none') : red(`${core.issues.length}`) },
  ]);

  const { incidents } = listIncidents(harnessRoot);
  const byStatus = (s: string): number => incidents.filter((i) => i.meta.status === s).length;
  const captured = byStatus('captured');

  render('Learning', [
    { label: 'incidents', value: `${incidents.length} total`, hint: `${byStatus('merged')} merged · ${byStatus('dismissed')} dismissed` },
    {
      label: 'awaiting',
      value: captured === 0 ? green('nothing to distil') : yellow(`${captured} captured`),
      ...(captured === 0 ? {} : { hint: 'atrix distill' }),
    },
  ]);

  const projects = listProjects(harnessRoot);
  const active = activeProject(harnessRoot);
  if (projects.length > 0) {
    render('Workspace', [
      {
        label: 'projects',
        value: `${projects.length}`,
        hint: projects.map((p) => (p.name === active?.name ? bold(p.name) : p.name)).join(' · '),
      },
      {
        label: 'active',
        value: active === undefined ? dim('the workspace itself') : bold(active.name),
        hint: active === undefined ? 'cd into a project, or set ATRIX_PROJECT' : undefined,
      },
    ]);
  }

  const rows: Row[] = [];
  const dbPath = join(harnessRoot, '.atrix', 'graph.db');

  if (!existsSync(dbPath)) {
    rows.push({ label: 'code graph', value: red('not indexed'), hint: 'atrix index' });
  } else {
    const ageHours = (Date.now() - statSync(dbPath).mtimeMs) / 3_600_000;
    const age = ageHours < 1 ? green('fresh') : ageHours < 24 ? `${Math.floor(ageHours)}h old` : yellow(`${Math.floor(ageHours / 24)}d old`);

    try {
      const db = new Database(dbPath, { readonly: true });
      try {
        const count = (sql: string): number => {
          try {
            return db.query<{ n: number }, []>(sql).get()?.n ?? 0;
          } catch {
            return 0;
          }
        };
        rows.push({
          label: 'code graph',
          value: age,
          hint: `${count('SELECT count(*) n FROM symbols')} symbols · ${count('SELECT count(*) n FROM edges')} edges across ${count('SELECT count(DISTINCT project) n FROM files')} target(s)`,
        });
        rows.push({ label: 'knowledge', value: `${count('SELECT count(*) n FROM notes')} notes`, hint: 'atrix recall "<question>"' });

        const conflicts = count("SELECT count(*) n FROM env_findings WHERE kind IN ('conflicting','client-exposed-secret')");
        rows.push({
          label: 'environment',
          value: conflicts === 0 ? green('no conflicts') : red(`${conflicts} finding(s)`),
          ...(conflicts === 0 ? {} : { hint: 'atrix env' }),
        });
      } finally {
        db.close();
      }
    } catch {
      rows.push({ label: 'code graph', value: red('unreadable'), hint: 'delete .atrix/graph.db and reindex' });
    }
  }

  const tracePath =
    active === undefined
      ? join(harnessRoot, '.atrix', 'trace.jsonl')
      : join(harnessRoot, '.atrix', 'projects', active.name, 'trace.jsonl');
  if (existsSync(tracePath)) {
    const lines = readFileSync(tracePath, 'utf8').split('\n').filter((l) => l.trim() !== '');
    const failed = lines.filter((l) => l.includes('"ok":false')).length;
    rows.push({
      label: 'trace',
      value: `${lines.length} calls · ${failed} failed`,
      hint: failed > 0 ? 'atrix observe' : undefined,
    });
  }

  if (rows.length > 0) render('Index', rows);

  const drift = driftReport(harnessRoot, projectRoot);
  if (drift !== undefined) {
    log.warn(drift);
    log.blank();
  }

  const measured = new Set<string>();
  const casesDir = join(p.evals, 'cases');
  if (existsSync(casesDir)) {
    for (const file of new Bun.Glob('*.yml').scanSync({ cwd: casesDir })) {
      const match = /^measures:\s*(.+)$/m.exec(readFileSync(join(casesDir, file), 'utf8'));
      if (match?.[1] !== undefined) measured.add(match[1].trim());
    }
  }
  const layers = core.rules.length + core.methodology.length + core.skills.length;

  // Stated plainly rather than buried: most of what this repo asserts is unverified,
  // and that is fine only for as long as nobody mistakes it for verified.
  log.info(
    `${bold('Measured')}  ${measured.size} of ${layers} layers have an eval — the rest are reasoned, not tested.  ${dim('atrix eval')}`,
  );

  return core.issues.length === 0;
}
