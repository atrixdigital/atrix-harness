import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadCore } from '../lib/core.ts';
import { lintSkill, type LintFinding } from '../lib/lint.ts';
import { log, yellow } from '../lib/log.ts';

function listFiles(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(listFiles(full));
    else out.push(full);
  }
  return out;
}

/** Returns true when nothing blocking was found; warnings do not fail the run. */
export function lint(harnessRoot: string): boolean {
  const core = loadCore(harnessRoot);
  const findings: LintFinding[] = core.skills.flatMap((skill) => lintSkill(harnessRoot, skill, listFiles));

  if (findings.length === 0) {
    log.ok(`${core.skills.length} skill(s) lint clean`);
    return true;
  }

  const errors = findings.filter((f) => f.severity === 'error');
  for (const finding of findings) {
    const label = `${finding.path} [${finding.rule}]`;
    if (finding.severity === 'error') log.fail(`${label} — ${finding.message}`);
    else log.warn(`${yellow(label)} — ${finding.message}`);
  }

  log.blank();
  log.info(`${errors.length} error(s), ${findings.length - errors.length} warning(s)`);
  return errors.length === 0;
}
