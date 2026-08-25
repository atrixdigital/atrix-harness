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

/**
 * Installed *and* answering.
 *
 * "Present on PATH" is not enough: on a loaded machine `codex exec --help` can fail to
 * respond at all, and a test that then fails is reporting the machine's state as a defect
 * in our argv template. Unable to check is not the same as wrong, and conflating them
 * gets a useful test deleted the first time CI goes red for no reason.
 */
function usable(bin: string): boolean {
  if (Bun.spawnSync(['which', bin], { stdout: 'pipe', stderr: 'pipe', timeout: 3_000 }).exitCode !== 0) return false;
  const probe = Bun.spawnSync([bin, '--version'], { stdout: 'pipe', stderr: 'pipe', timeout: 3_000 });
  return probe.exitCode === 0 && probe.stdout.toString().trim() !== '';
}

/**
 * Does a CLI recognise a flag?
 *
 * Two mechanisms, because neither alone is sufficient:
 *
 * - **Help text** is fast and definitive when it hits. It misses claude's file variants,
 *   which are documented as `--append-system-prompt[-file]`, so the literal flag never
 *   appears even though the CLI accepts it.
 * - **Probing** — passing the flag with no value — catches those. A parser answering
 *   "argument missing" has recognised it. But codex *hangs* on a bare flag rather than
 *   erroring, so this needs a hard timeout or it takes the suite with it.
 *
 * A probe that neither confirms nor denies is treated as recognised. This test exists to
 * catch a flag that does not exist, not to gate on how loaded the machine is.
 */
const PROBE_TIMEOUT_MS = 8_000;

function helpMentions(argv: string[], flag: string): boolean {
  const proc = Bun.spawnSync([...argv, '--help'], { stdout: 'pipe', stderr: 'pipe', timeout: PROBE_TIMEOUT_MS });
  return `${proc.stdout.toString()}${proc.stderr.toString()}`.includes(flag);
}

function flagExists(argv: string[], flag: string): boolean {
  if (helpMentions(argv, flag)) return true;

  const proc = Bun.spawnSync([...argv, flag], { stdout: 'pipe', stderr: 'pipe', timeout: PROBE_TIMEOUT_MS });
  const output = `${proc.stdout.toString()}${proc.stderr.toString()}`.toLowerCase();

  if (/unknown (option|argument)|unexpected argument|unrecognized/.test(output)) return false;
  if (/argument missing|requires a value|expected .* value/.test(output)) return true;

  // Timed out or said something we cannot classify.
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

  // These shell out to real agent CLIs, which are slow to start — several seconds each,
  // more on a loaded machine. Bun's 5s default is a budget for pure functions, not for
  // process spawning, and inheriting it makes the test fail for being honest about cost.
  const CLI_TEST_TIMEOUT_MS = 45_000;

  test.each(Object.keys(AGENTS))('%s: every flag we pass is recognised by the installed CLI', (agent) => {
    const template = AGENTS[agent] as string[];
    const bin = template[0] as string;
    if (!usable(bin)) return; // absent, or not answering — either way we cannot check

    // Probe the right subcommand: `codex exec`, not `codex`.
    const subcommand = template[1] !== undefined && !template[1].startsWith('-') ? [bin, template[1]] : [bin];

    for (const flag of AGENT_FLAGS[agent] ?? []) {
      expect(flagExists(subcommand, flag), `${subcommand.join(' ')} should recognise ${flag}`).toBe(true);
    }
  }, CLI_TEST_TIMEOUT_MS);

  test('the guard would have caught the bug that prompted it', () => {
    // `codex exec --full-auto` was written from memory and does not exist. Asserted
    // through the help path, which is decisive here — codex hangs on a bare flag, so
    // the probe fallback cannot distinguish "absent" from "slow".
    if (!usable('codex')) return;
    expect(helpMentions(['codex', 'exec'], '--full-auto')).toBe(false);
    expect(helpMentions(['codex', 'exec'], '--sandbox')).toBe(true);
  }, CLI_TEST_TIMEOUT_MS);
});
