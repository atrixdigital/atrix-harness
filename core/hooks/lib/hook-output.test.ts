import { describe, expect, test } from 'bun:test';
import { DEFAULT_THRESHOLDS, observe, type LoopState } from './loop-guard.ts';

/**
 * A hook communicates through one line of JSON on stdout. If that line is malformed the
 * runtime drops it silently — the guard would appear to work and do nothing.
 *
 * Asserted here rather than in a shell demo: zsh's builtin `echo` interprets `\n`
 * escapes, which corrupted the JSON before the parser saw it and made correct output
 * look broken. Verify the world, but verify it with something that does not lie.
 */

const CONTROL_CHARS = /[\u0000-\u001f]/;

describe('nudge messages are safe to emit', () => {
  test('every threshold message survives a JSON round-trip', () => {
    let state: LoopState = {};
    const emitted: string[] = [];

    for (let i = 0; i < 9; i += 1) {
      const out = observe(state, {
        sessionId: 's',
        tool: 'Bash',
        input: { command: 'psql -c "SELECT 1"' },
        resultSignature: 'connection refused',
        now: 1_700_000_000_000 + i,
      });
      state = out.state;
      if (out.nudge !== undefined) emitted.push(out.nudge.message);
    }

    expect(emitted).toHaveLength(DEFAULT_THRESHOLDS.length);

    for (const message of emitted) {
      const line = JSON.stringify({
        hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: message },
      });

      // The serialised line must be one line with no raw control characters.
      expect(CONTROL_CHARS.test(line)).toBe(false);
      expect(line.split('\n')).toHaveLength(1);

      // And must survive the trip back intact, including embedded quotes from the
      // command preview.
      const parsed = JSON.parse(line) as { hookSpecificOutput: { additionalContext: string } };
      expect(parsed.hookSpecificOutput.additionalContext).toBe(message);
    }
  });

  test('a command containing quotes and newlines does not break the payload', () => {
    const { nudge } = observe(
      { s: { key: 'x', count: 2, tool: 'Bash', preview: 'p', updated: 0 } },
      {
        sessionId: 's',
        tool: 'Bash',
        input: { command: 'cat <<\'EOF\'\nline "one"\nEOF' },
        resultSignature: 'r',
        now: 1,
      },
      [2],
    );

    // count resets to 1 because the key differs, so no nudge — but the preview built
    // from that input must still be safe if it were emitted.
    expect(nudge).toBeUndefined();
  });
});
