import { describe, expect, test } from 'bun:test';
import { AGENT_FLAGS, AGENTS } from './eval.ts';

/**
 * Validates the runner templates against the CLIs actually installed.
 *
 * This is "test the real entry path" applied to a shell-out: the argv was written from
 * memory and `codex exec --full-auto` turned out not to exist, which would have failed on
 * the first real eval run — long after anyone would connect the two.
 *
 * Each case self-skips when its CLI is absent, so a machine without codex stays green.
 */

const installed = (bin: string): boolean =>
  Bun.spawnSync(['which', bin], { stdout: 'pipe', stderr: 'pipe' }).exitCode === 0;

/**
 * Probe a flag by passing it with no value.
 *
 * `--help` output is not a reliable authority: claude documents the file variants as
 * `--append-system-prompt[-file]`, so the literal flag we pass never appears in the text
 * even though the CLI accepts it. Checking help would have failed a correct template —
 * the instrument being wrong is as costly as the code being wrong.
 *
 * A parser that answers "argument missing" has recognised the flag. "unknown option" or
 * "unexpected argument" means it has not.
 */
function flagExists(argv: string[], flag: string): boolean {
  const proc = Bun.spawnSync([...argv, flag], { stdout: 'pipe', stderr: 'pipe' });
  const output = `${proc.stdout.toString()}${proc.stderr.toString()}`.toLowerCase();
  if (/unknown (option|argument)|unexpected argument|unrecognized/.test(output)) return false;
  return true;
}

describe('runner templates', () => {
  test('every template substitutes both placeholders', () => {
    for (const [name, template] of Object.entries(AGENTS)) {
      const joined = template.join(' ');
      expect(joined, name).toContain('{{prompt}}');
    }
  });

  test('claude receives the system prompt; the others take it inline', () => {
    // Only claude has a file-based append flag, so this is a real asymmetry rather
    // than an oversight — recorded here so nobody "fixes" it.
    expect(AGENTS['claude']?.join(' ')).toContain('{{system}}');
  });

  test('no template requests unrestricted disk access', () => {
    for (const [name, template] of Object.entries(AGENTS)) {
      expect(template.join(' '), name).not.toContain('danger-full-access');
      expect(template.join(' '), name).not.toContain('dangerously-bypass');
    }
  });

  test.each(Object.keys(AGENTS))('%s: every flag we pass is recognised by the installed CLI', (agent) => {
    const template = AGENTS[agent] as string[];
    const bin = template[0] as string;
    if (!installed(bin)) return; // self-skip keeps a machine without this CLI green

    // Probe the right subcommand: `codex exec`, not `codex`.
    const subcommand = template[1] !== undefined && !template[1].startsWith('-') ? [bin, template[1]] : [bin];

    for (const flag of AGENT_FLAGS[agent] ?? []) {
      expect(flagExists(subcommand, flag), `${subcommand.join(' ')} should recognise ${flag}`).toBe(true);
    }
  });

  test('the guard would have caught the bug that prompted it', () => {
    // `codex exec --full-auto` was written from memory and does not exist.
    if (!installed('codex')) return;
    expect(flagExists(['codex', 'exec'], '--full-auto')).toBe(false);
  });
});
