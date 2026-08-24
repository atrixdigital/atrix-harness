import { describe, expect, test } from 'bun:test';
import { projectOf, stateDir } from './project.ts';

/**
 * Hooks run at the workspace root, so this is what stops twenty repos sharing one trace.
 * Getting it wrong does not error — it silently merges unrelated failures into one
 * stream, and every recurrence count becomes meaningless.
 */

const WS = '/w';
const of = (input: Record<string, unknown>) => projectOf({ tool_input: input }, WS);

describe('resolving from the payload', () => {
  test.each([
    ['relative file path', { file_path: 'projects/playo-web/src/a.ts' }, 'playo-web'],
    ['absolute file path', { file_path: '/w/projects/ezrov/apps/api/x.ts' }, 'ezrov'],
    ['notebook path', { notebook_path: 'projects/analysis/nb.ipynb' }, 'analysis'],
    ['explicit cwd', { cwd: '/w/projects/fleetx' }, 'fleetx'],
  ])('%s', (_label, input, expected) => {
    expect(of(input)).toBe(expected);
  });

  test.each([
    ['cd into a project', 'cd projects/playo-web && bun test'],
    ['a path argument', 'bun test projects/playo-web/src/a.test.ts'],
    ['quoted', 'cat "projects/playo-web/README.md"'],
    ['dot-slash prefixed', 'ls ./projects/playo-web'],
  ])('shell command: %s', (_label, command) => {
    expect(of({ command })).toBe('playo-web');
  });
});

describe('work that belongs to no project', () => {
  test.each([
    ['a rule edit', { file_path: 'core/rules/safety.md' }],
    ['a harness file', { file_path: '/w/packages/cli/src/index.ts' }],
    ['a workspace command', { command: 'bun test' }],
    ['a path outside the workspace', { file_path: '/elsewhere/thing.ts' }],
  ])('%s resolves to the workspace', (_label, input) => {
    // Undefined is a real answer here, not a failure to detect.
    expect(of(input)).toBeUndefined();
  });

  test('the projects directory itself is not a project', () => {
    expect(of({ file_path: 'projects/' })).toBeUndefined();
  });

  test('a substring match does not count', () => {
    // `myprojects/foo` is not `projects/foo`.
    expect(of({ command: 'ls myprojects/foo' })).toBeUndefined();
  });
});

describe('state location', () => {
  test('per-project state is isolated', () => {
    expect(stateDir(WS, 'playo-web')).toBe('/w/.atrix/projects/playo-web');
    expect(stateDir(WS, 'ezrov')).toBe('/w/.atrix/projects/ezrov');
  });

  test('workspace state sits at the root', () => {
    expect(stateDir(WS, undefined)).toBe('/w/.atrix');
  });

  test('everything stays inside the gitignored .atrix', () => {
    // Traces are per-developer and must never reach a remote.
    for (const project of [undefined, 'playo-web']) {
      expect(stateDir(WS, project).startsWith('/w/.atrix')).toBe(true);
    }
  });
});
