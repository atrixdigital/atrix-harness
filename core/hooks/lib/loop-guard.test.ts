import { describe, expect, test } from 'bun:test';
import {
  canonicalise,
  DEFAULT_THRESHOLDS,
  observe,
  previewOf,
  shouldEscalate,
  validateThresholds,
  type LoopState,
} from './loop-guard.ts';

/**
 * False positives are the failure mode that matters. A loop guard that nags during
 * legitimate repetition gets switched off within a week, and then it catches nothing —
 * so the "does not fire" cases carry as much weight as the "does".
 */

const NOW = 1_700_000_000_000;

function run(
  calls: { tool: string; input: unknown; result: string }[],
  sessionId = 's1',
): { state: LoopState; nudges: (number | undefined)[] } {
  let state: LoopState = {};
  const nudges: (number | undefined)[] = [];
  for (const [i, call] of calls.entries()) {
    const out = observe(state, {
      sessionId,
      tool: call.tool,
      input: call.input,
      resultSignature: call.result,
      now: NOW + i,
    });
    state = out.state;
    nudges.push(out.nudge?.count);
  }
  return { state, nudges };
}

const same = (n: number, result = 'ECONNREFUSED') =>
  Array.from({ length: n }, () => ({ tool: 'Bash', input: { command: 'psql -c "SELECT 1"' }, result }));

describe('no-progress detection', () => {
  test('fires at each threshold, once', () => {
    const { nudges } = run(same(9));
    expect(nudges.filter((n) => n !== undefined)).toEqual([...DEFAULT_THRESHOLDS]);
  });

  test('catches a call that SUCCEEDS repeatedly without progress', () => {
    // The case three other guardrails missed: an agent navigated to the same
    // non-existent URL 98 times, successfully, every time. Counting failures finds none.
    const calls = Array.from({ length: 5 }, () => ({
      tool: 'Bash',
      input: { command: 'curl https://example.test/docs' },
      result: '',
    }));
    expect(run(calls).nudges.filter(Boolean)).toEqual([3, 5]);
  });

  test('does NOT fire when the result changes — that is progress', () => {
    // `bun test` run repeatedly during red→green is legitimate and must stay silent.
    const calls = ['3 fail', '1 fail', '0 fail', '0 fail'].map((result) => ({
      tool: 'Bash',
      input: { command: 'bun test' },
      result,
    }));
    expect(run(calls).nudges.filter(Boolean)).toEqual([]);
  });

  test('a different call resets the chain', () => {
    const calls = [...same(2), { tool: 'Read', input: { file_path: 'a.ts' }, result: 'x' }, ...same(2)];
    expect(run(calls).nudges.filter(Boolean)).toEqual([]);
  });
});

describe('chain laundering', () => {
  test('a bookkeeping tool between repeats does not reset the chain', () => {
    // Otherwise a model interleaving TodoWrite escapes detection for free.
    const calls = [
      ...same(2),
      { tool: 'TodoWrite', input: { todos: [] }, result: 'ok' },
      ...same(1),
    ];
    expect(run(calls).nudges.filter(Boolean)).toEqual([3]);
  });

  test('reordered argument keys still count as the same call', () => {
    const a = observe({}, { sessionId: 's', tool: 'T', input: { a: 1, b: 2 }, resultSignature: 'r', now: NOW });
    const b = observe(a.state, { sessionId: 's', tool: 'T', input: { b: 2, a: 1 }, resultSignature: 'r', now: NOW });
    expect(b.state['s']?.count).toBe(2);
  });

  test('canonicalise sorts nested keys', () => {
    expect(canonicalise({ b: { d: 1, c: 2 }, a: 3 })).toBe(canonicalise({ a: 3, c: undefined, b: { c: 2, d: 1 } }));
  });
});

describe('sessions', () => {
  test('one session cannot trip another session chain', () => {
    let state: LoopState = {};
    for (let i = 0; i < 5; i += 1) {
      state = observe(state, { sessionId: 'a', tool: 'T', input: {}, resultSignature: 'r', now: NOW + i }).state;
    }
    const other = observe(state, { sessionId: 'b', tool: 'T', input: {}, resultSignature: 'r', now: NOW });
    expect(other.nudge).toBeUndefined();
    expect(other.state['b']?.count).toBe(1);
  });
});

describe('escalation', () => {
  const thresholds = DEFAULT_THRESHOLDS;

  test('does not escalate below the final threshold', () => {
    const { state } = run(same(7));
    expect(shouldEscalate(state, 's1', 'Bash', { command: 'psql -c "SELECT 1"' }, thresholds)).toBeUndefined();
  });

  test('escalates the same call once past the final threshold', () => {
    const { state } = run(same(8));
    expect(shouldEscalate(state, 's1', 'Bash', { command: 'psql -c "SELECT 1"' }, thresholds)?.count).toBe(8);
  });

  test('does not escalate a DIFFERENT call — that is the model changing approach', () => {
    // Which is exactly what the nudges asked it to do; punishing it would be perverse.
    const { state } = run(same(8));
    expect(shouldEscalate(state, 's1', 'Bash', { command: 'psql -c "SELECT 2"' }, thresholds)).toBeUndefined();
  });
});

describe('preview', () => {
  test.each([
    [{ command: 'bun test' }, 'Bash(command: bun test)'],
    [{ file_path: 'src/a.ts' }, 'Bash(file_path: src/a.ts)'],
    [{ pattern: 'orgId' }, 'Bash(pattern: orgId)'],
  ])('%p → %s', (input, expected) => {
    expect(previewOf('Bash', input)).toBe(expected);
  });

  test('never quotes a file body', () => {
    const preview = previewOf('Write', { file_path: 'a.ts', content: 'SECRET'.repeat(500) });
    expect(preview).not.toContain('SECRET');
    expect(preview.length).toBeLessThan(140);
  });
});

describe('threshold config', () => {
  test('defaults when unset', () => {
    expect(validateThresholds(undefined)).toEqual([...DEFAULT_THRESHOLDS]);
  });

  test('sorts ascending', () => {
    expect(validateThresholds([8, 3, 5])).toEqual([3, 5, 8]);
  });

  test.each([[[]], [[1]], [['3']], [[3, 3]], ['nope']])('rejects %p loudly', (bad) => {
    // A mis-set threshold must never silently read as "guard is off".
    expect(() => validateThresholds(bad)).toThrow();
  });
});
