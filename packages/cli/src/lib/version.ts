import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Harness identity.
 *
 * A consuming repo records which harness it was initialised against, so `doctor` can say
 * "you are 14 commits behind" instead of leaving people to guess. Without this the
 * propagate step of the learning loop is invisible: a rule can be merged and nobody
 * downstream ever learns that their checkout predates it.
 */

export interface HarnessVersion {
  /** Semantic version from the root package.json. */
  version: string;
  /** Short commit sha, when the harness is a git checkout. */
  commit: string | undefined;
  /** True when the checkout has uncommitted changes — a version that means nothing. */
  dirty: boolean;
}

function git(harnessRoot: string, args: string[]): string | undefined {
  try {
    const proc = Bun.spawnSync(['git', ...args], { cwd: harnessRoot, stdout: 'pipe', stderr: 'pipe' });
    if (proc.exitCode !== 0) return undefined;
    const out = proc.stdout.toString().trim();
    return out === '' ? undefined : out;
  } catch {
    return undefined;
  }
}

export function harnessVersion(harnessRoot: string): HarnessVersion {
  const pkgPath = join(harnessRoot, 'package.json');
  const version = existsSync(pkgPath)
    ? ((JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string }).version ?? '0.0.0')
    : '0.0.0';

  return {
    version,
    commit: git(harnessRoot, ['rev-parse', '--short', 'HEAD']),
    dirty: git(harnessRoot, ['status', '--porcelain']) !== undefined,
  };
}

/**
 * How far a recorded version is behind the checkout.
 *
 * Returns undefined when the question cannot be answered honestly — no git, an unknown
 * commit, a shallow clone. An unknown distance is reported as unknown, never as zero.
 */
export function commitsBehind(harnessRoot: string, recordedCommit: string | undefined): number | undefined {
  if (recordedCommit === undefined) return undefined;
  if (git(harnessRoot, ['cat-file', '-e', `${recordedCommit}^{commit}`]) === undefined) {
    // `cat-file -e` prints nothing on success, so distinguish by exit status.
    const proc = Bun.spawnSync(['git', 'cat-file', '-e', `${recordedCommit}^{commit}`], {
      cwd: harnessRoot,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    if (proc.exitCode !== 0) return undefined;
  }

  const count = git(harnessRoot, ['rev-list', '--count', `${recordedCommit}..HEAD`]);
  return count === undefined ? undefined : Number(count);
}

export const describe = (v: HarnessVersion): string =>
  `${v.version}${v.commit === undefined ? '' : `+${v.commit}`}${v.dirty ? ' (dirty)' : ''}`;
