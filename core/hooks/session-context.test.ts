import { Database } from 'bun:sqlite';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

/**
 * Runs the hook as a process in a seeded workspace, rather than importing its internals.
 *
 * This is the real entry path: a hook is a script that reads the working directory and
 * writes one line of JSON. Testing extracted helpers would prove the helpers work while
 * leaving the thing that actually runs unverified.
 */

const HOOK = join(import.meta.dir, 'session-context.ts');
let workspace: string;

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'atrix-session-'));
  mkdirSync(join(workspace, '.atrix'), { recursive: true });
});
afterEach(() => rmSync(workspace, { recursive: true, force: true }));

function run(): string {
  const proc = Bun.spawnSync(['bun', 'run', HOOK], {
    cwd: workspace,
    stdin: new TextEncoder().encode('{"session_id":"s"}'),
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, ATRIX_HOME: '' },
  });
  const out = proc.stdout.toString().trim();
  if (out === '') return '';
  return (JSON.parse(out) as { hookSpecificOutput: { additionalContext: string } }).hookSpecificOutput.additionalContext;
}

const seedDb = (findings: { kind: string; name: string }[]): void => {
  const db = new Database(join(workspace, '.atrix', 'graph.db'), { create: true });
  db.run('CREATE TABLE env_findings (id INTEGER PRIMARY KEY, kind TEXT, name TEXT, detail TEXT, locations TEXT)');
  for (const f of findings) db.run('INSERT INTO env_findings (kind, name, detail, locations) VALUES (?,?,?,?)', [f.kind, f.name, 'd', 'l']);
  db.close();
};

const today = new Date().toISOString().slice(0, 10);

describe('silence is the default', () => {
  test('says nothing when there is nothing worth saying', () => {
    // A banner that recites statistics trains people to skip it, and then the one line
    // that mattered gets skipped too.
    seedDb([]);
    expect(run()).toBe('');
  });

  test('a failure seen twice is not yet a standing problem', () => {
    seedDb([]);
    writeFileSync(
      join(workspace, '.atrix', 'trace.jsonl'),
      [1, 2].map(() => JSON.stringify({ date: today, tool: 'Bash', ok: false, program: 'psql', signature: 'refused' })).join('\n'),
    );
    expect(run()).toBe('');
  });
});

describe('things that change what to do next', () => {
  test('warns about env values that differ between files', () => {
    seedDb([{ kind: 'conflicting', name: 'DATABASE_URL' }]);
    const out = run();
    expect(out).toContain('DATABASE_URL');
    expect(out).toContain('defined in more than one env file');
  });

  test('warns about a secret behind a public prefix', () => {
    seedDb([{ kind: 'client-exposed-secret', name: 'NEXT_PUBLIC_STRIPE_SECRET_KEY' }]);
    expect(run()).toContain('browser bundle');
  });

  test('surfaces a recurring failure so nobody has to remember to run observe', () => {
    seedDb([]);
    writeFileSync(
      join(workspace, '.atrix', 'trace.jsonl'),
      [1, 2, 3].map(() => JSON.stringify({ date: today, tool: 'Bash', ok: false, program: 'psql', signature: 'connection refused' })).join('\n'),
    );
    const out = run();
    expect(out).toContain('recurred');
    expect(out).toContain('psql');
  });

  test('tells you the graph tools are unavailable when there is no index', () => {
    expect(run()).toContain('No code graph');
  });
});

describe('robustness', () => {
  test('a truncated trace line does not break the session', () => {
    seedDb([]);
    writeFileSync(join(workspace, '.atrix', 'trace.jsonl'), '{"date":"2026-01-01","ok":fal');
    expect(() => run()).not.toThrow();
  });

  test('a corrupt database does not break the session', () => {
    writeFileSync(join(workspace, '.atrix', 'graph.db'), 'not a database');
    expect(() => run()).not.toThrow();
  });

  test('emits valid single-line JSON', () => {
    seedDb([{ kind: 'conflicting', name: 'A_VAR' }]);
    const proc = Bun.spawnSync(['bun', 'run', HOOK], {
      cwd: workspace,
      stdin: new TextEncoder().encode('{"session_id":"s"}'),
      stdout: 'pipe',
      env: { ...process.env, ATRIX_HOME: '' },
    });
    const line = proc.stdout.toString().trim();
    expect(line.split('\n')).toHaveLength(1);
    expect(() => JSON.parse(line)).not.toThrow();
  });
});

describe('un-onboarded projects', () => {
  test('flags a project with no AGENTS.md, and names the skill that fixes it', () => {
    // A developer who cloned a repo an hour ago has no reason to suspect the graph
    // tools cannot see it. The agent can do the whole setup — but only if it knows
    // there is something to do.
    mkdirSync(join(workspace, 'projects', 'freshly-cloned'), { recursive: true });
    const out = run();
    expect(out).toContain('freshly-cloned');
    expect(out).toContain('onboarding-a-project');
  });

  test('says nothing about a project that has been onboarded', () => {
    mkdirSync(join(workspace, 'projects', 'done'), { recursive: true });
    writeFileSync(join(workspace, 'projects', 'done', 'AGENTS.md'), '# done\n');
    seedDb([]);
    expect(run()).toBe('');
  });

  test('ignores dotfiles and the gitkeep placeholder', () => {
    mkdirSync(join(workspace, 'projects'), { recursive: true });
    writeFileSync(join(workspace, 'projects', '.gitkeep'), '');
    seedDb([]);
    expect(run()).toBe('');
  });
});

describe('the rule bundle reaches the model', () => {
  /**
   * The regression this guards is the worst one this repo has had: the bundle was
   * generated into the plugin and loaded by nothing, so Claude Code sessions ran with
   * no rules at all for the whole life of the adapter. Every structural check passed
   * while that was true — the file existed, the manifests validated, the tests were
   * green — because none of them asked whether a model ever saw the bytes.
   *
   * This asserts the delivery mechanism. The live query that proved the bug is in
   * learning/incidents/incident-2026-08-25-*.
   */
  function runWithPlugin(pluginRoot: string): string {
    const proc = Bun.spawnSync(['bun', 'run', HOOK, pluginRoot], {
      cwd: workspace,
      stdin: new TextEncoder().encode('{"session_id":"s"}'),
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, ATRIX_HOME: '' },
    });
    const out = proc.stdout.toString().trim();
    if (out === '') return '';
    return (JSON.parse(out) as { hookSpecificOutput: { additionalContext: string } }).hookSpecificOutput.additionalContext;
  }

  test('never emits the rule bundle', () => {
    // The bundle used to ride this payload, and that is exactly why no rule reached the
    // model: Claude Code inlines only a ~2KB preview once a hook payload passes ~10,000
    // characters. A 38KB bundle here delivers the manual head and drops everything after
    // it — including the notes below. Rules go in the workspace CLAUDE.md instead.
    const pluginRoot = join(workspace, 'plugin');
    mkdirSync(pluginRoot, { recursive: true });
    writeFileSync(join(pluginRoot, 'AGENTS.md'), '# Manual\n\n## bounded-recovery\n\nretry, patch, replan.\n');

    const context = runWithPlugin(pluginRoot);
    expect(context).not.toContain('bounded-recovery');
    expect(context).not.toContain('retry, patch, replan');
  });

  test('stays well under the payload size that triggers truncation', () => {
    // Measured empirically: a payload at 8,000 chars arrives whole, one at 10,000 is
    // replaced by a ~2KB preview, with no error anywhere. Notes are the only thing left
    // in here, so the headroom is large — this guards it staying that way.
    const pluginRoot = join(workspace, 'plugin');
    mkdirSync(pluginRoot, { recursive: true });
    seedDb([{ kind: 'conflicting', name: 'DATABASE_URL' }]);

    expect(runWithPlugin(pluginRoot).length).toBeLessThan(8_000);
  });

  test('still starts a session when the bundle is missing', () => {
    // Degraded is workable; failing to start is not.
    const pluginRoot = join(workspace, 'empty-plugin');
    mkdirSync(pluginRoot, { recursive: true });
    seedDb([{ kind: 'conflicting', name: 'DATABASE_URL' }]);

    expect(runWithPlugin(pluginRoot)).toContain('DATABASE_URL');
  });

  test('emits valid single-line JSON even with a large bundle', () => {
    // 36KB of markdown with quotes, backticks and newlines through JSON.stringify.
    const pluginRoot = join(workspace, 'plugin');
    mkdirSync(pluginRoot, { recursive: true });
    writeFileSync(join(pluginRoot, 'AGENTS.md'), `# Manual\n\n${'`code` "quoted" line\n'.repeat(800)}`);

    const proc = Bun.spawnSync(['bun', 'run', HOOK, pluginRoot], {
      cwd: workspace,
      stdin: new TextEncoder().encode('{"session_id":"s"}'),
      stdout: 'pipe',
      env: { ...process.env, ATRIX_HOME: '' },
    });
    const line = proc.stdout.toString().trim();
    expect(line.split('\n')).toHaveLength(1);
    expect(() => JSON.parse(line)).not.toThrow();
  });
});
