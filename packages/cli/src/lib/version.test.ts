import { describe, expect, test } from 'bun:test';
import { commitsBehind, describe as describeVersion, harnessVersion } from './version.ts';
import { findHarnessRoot } from './paths.ts';

const root = findHarnessRoot(import.meta.dir);

describe('harnessVersion', () => {
  test('reads the version and the commit', () => {
    const v = harnessVersion(root);
    expect(v.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(v.commit).toMatch(/^[0-9a-f]{7,}$/);
  });

  test('renders something a human can compare', () => {
    expect(describeVersion({ version: '1.2.3', commit: 'abc1234', dirty: false })).toBe('1.2.3+abc1234');
    expect(describeVersion({ version: '1.2.3', commit: 'abc1234', dirty: true })).toBe('1.2.3+abc1234 (dirty)');
  });

  test('survives a directory that is not a git checkout', () => {
    const v = harnessVersion('/tmp');
    expect(v.commit).toBeUndefined();
  });
});

describe('commitsBehind', () => {
  test('reports zero for the current head', () => {
    const head = harnessVersion(root).commit;
    expect(commitsBehind(root, head)).toBe(0);
  });

  test('counts distance from an older commit', () => {
    const proc = Bun.spawnSync(['git', 'rev-parse', '--short', 'HEAD~2'], { cwd: root, stdout: 'pipe' });
    const older = proc.stdout.toString().trim();
    expect(commitsBehind(root, older)).toBe(2);
  });

  test('returns undefined rather than guessing when the commit is unknown', () => {
    // A shallow clone or a rewritten history must report "unknown", never "0".
    expect(commitsBehind(root, 'deadbee')).toBeUndefined();
    expect(commitsBehind(root, undefined)).toBeUndefined();
  });
});
