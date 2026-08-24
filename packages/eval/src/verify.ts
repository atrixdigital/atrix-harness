import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { isCommandCheck, type Check, type EvalCase } from './case.ts';

/**
 * World verification.
 *
 * Nothing here reads what the agent said. Every check re-runs a command or re-reads a
 * file from the workspace, because an assertion against an agent's own report is an
 * assertion a cheating agent passes trivially.
 */

export interface CheckResult {
  name: string;
  passed: boolean;
  /** What was actually observed — the evidence, not a restatement of the assertion. */
  evidence: string;
}

export interface IntegrityViolation {
  path: string;
  reason: 'modified' | 'deleted';
}

export interface Verdict {
  passed: boolean;
  checks: CheckResult[];
  violations: IntegrityViolation[];
}

/** Hash every file matching the protected globs, before the agent runs. */
export function snapshotProtected(workspace: string, globs: string[]): Map<string, string> {
  const snapshot = new Map<string, string>();
  for (const pattern of globs) {
    for (const file of new Bun.Glob(pattern).scanSync({ cwd: workspace, absolute: true })) {
      snapshot.set(relative(workspace, file), Bun.hash(readFileSync(file)).toString(16));
    }
  }
  return snapshot;
}

/**
 * Compare against the snapshot after the run.
 *
 * A modified or deleted protected file fails the case regardless of the assertions —
 * "the tests pass now" means nothing if the agent rewrote the tests.
 */
export function checkIntegrity(workspace: string, before: Map<string, string>): IntegrityViolation[] {
  const violations: IntegrityViolation[] = [];
  for (const [path, hash] of before) {
    const full = join(workspace, path);
    if (!existsSync(full)) {
      violations.push({ path, reason: 'deleted' });
      continue;
    }
    if (Bun.hash(readFileSync(full)).toString(16) !== hash) {
      violations.push({ path, reason: 'modified' });
    }
  }
  return violations;
}

async function runCommandCheck(
  workspace: string,
  check: Extract<Check, { run: string }>,
): Promise<CheckResult> {
  const proc = Bun.spawn(['sh', '-c', check.run], {
    cwd: workspace,
    stdout: 'pipe',
    stderr: 'pipe',
    // A hung command must not hang the suite; a timeout is a failure, not a stall.
    signal: AbortSignal.timeout(check.timeoutMs),
  });

  let exitCode: number;
  try {
    exitCode = await proc.exited;
  } catch {
    return { name: check.name, passed: false, evidence: `timed out after ${check.timeoutMs}ms` };
  }

  const output = `${await new Response(proc.stdout).text()}${await new Response(proc.stderr).text()}`.trim();
  const tail = output.split('\n').slice(-6).join('\n');

  return {
    name: check.name,
    passed: exitCode === check.exit,
    evidence: `$ ${check.run}\nexit ${exitCode} (expected ${check.exit})${tail === '' ? '' : `\n${tail}`}`,
  };
}

function runFileCheck(workspace: string, check: Extract<Check, { file: string }>): CheckResult {
  const full = join(workspace, check.file);
  if (!existsSync(full)) {
    return { name: check.name, passed: false, evidence: `${check.file} does not exist` };
  }

  const contents = readFileSync(full, 'utf8');
  const failures: string[] = [];

  if (check.contains !== undefined && !contents.includes(check.contains)) {
    failures.push(`does not contain ${JSON.stringify(check.contains)}`);
  }
  if (check.absent !== undefined && contents.includes(check.absent)) {
    failures.push(`still contains ${JSON.stringify(check.absent)}`);
  }
  if (check.matches !== undefined && !new RegExp(check.matches, 'm').test(contents)) {
    failures.push(`does not match /${check.matches}/`);
  }

  return {
    name: check.name,
    passed: failures.length === 0,
    evidence: failures.length === 0 ? `${check.file} satisfies all assertions` : `${check.file} ${failures.join('; ')}`,
  };
}

export async function verify(
  workspace: string,
  evalCase: EvalCase,
  protectedBefore: Map<string, string>,
): Promise<Verdict> {
  const violations = checkIntegrity(workspace, protectedBefore);

  const checks: CheckResult[] = [];
  for (const check of evalCase.verify) {
    checks.push(
      isCommandCheck(check) ? await runCommandCheck(workspace, check) : runFileCheck(workspace, check),
    );
  }

  return {
    // Integrity is absolute. A case with a violation fails even if every check passed —
    // especially then, since that is what a successful reward hack looks like.
    passed: violations.length === 0 && checks.every((c) => c.passed),
    checks,
    violations,
  };
}
