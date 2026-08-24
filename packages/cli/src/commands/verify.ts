import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bold, dim, green, log, red, yellow } from '../lib/log.ts';
import { harnessPaths } from '../lib/paths.ts';

/**
 * End-to-end verification against a real agent.
 *
 * Everything else in this repo checks structure: the file exists, the manifest validates,
 * the tests pass. None of that can answer **does the model actually see this** — and for
 * the entire life of the Claude adapter the answer was no, while every structural check
 * was green (`learning/incidents/incident-2026-08-25-*`).
 *
 * So each check here launches a real session and asks for something that is only present
 * if the delivery path works. It costs a handful of small queries and it is the only
 * check that is about the thing rather than about its packaging.
 */

interface Check {
  name: string;
  /** What the delivery path is for, so a failure says what a user loses. */
  matters: string;
  run: (pluginDir: string, workspace: string) => Promise<Result>;
}

interface Result {
  passed: boolean;
  evidence: string;
}

/** One headless query. `plan` mode keeps a probe from editing anything. */
function ask(prompt: string, pluginDir: string, cwd: string, mode = 'plan'): Result {
  const proc = Bun.spawnSync(
    ['claude', '-p', prompt, '--plugin-dir', pluginDir, '--permission-mode', mode],
    // Closed stdin: the CLI otherwise waits three seconds for piped input that is
    // never coming, on every probe.
    { cwd, stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' },
  );
  const output = `${proc.stdout.toString()}${proc.stderr.toString()}`.trim();
  return { passed: proc.exitCode === 0, evidence: output.split('\n').slice(-3).join(' ').slice(0, 200) };
}

const CHECKS: Check[] = [
  {
    name: 'the marketplace is loadable',
    matters: 'nobody can install the plugin at all',
    run: async (pluginDir) => {
      const marketplace = join(pluginDir, '..', '..');
      const proc = Bun.spawnSync(['claude', 'plugin', 'validate', marketplace], { stdout: 'pipe', stderr: 'pipe' });
      const out = `${proc.stdout.toString()}${proc.stderr.toString()}`.trim();
      return { passed: proc.exitCode === 0, evidence: out.split('\n').pop() ?? '' };
    },
  },
  {
    name: 'components are discovered',
    matters: 'agents, skills or hooks silently missing from the plugin',
    run: async (pluginDir) => {
      const proc = Bun.spawnSync(['claude', '--plugin-dir', pluginDir, 'plugin', 'details', 'atrix-core'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const out = proc.stdout.toString();
      const agents = /Agents \((\d+)\)/.exec(out)?.[1] ?? '0';
      const hooks = /Hooks \((\d+)\)/.exec(out)?.[1] ?? '0';
      return {
        passed: Number(agents) > 5 && Number(hooks) >= 3,
        evidence: `${agents} agents, ${hooks} hook events`,
      };
    },
  },
  {
    name: 'the rules reach the model',
    matters: 'every rule in core/ is inert — this was broken and nothing structural caught it',
    run: async (pluginDir, workspace) => {
      const result = ask(
        'Without using any tools, answer in one short line: what are the three escalation levels of the bounded-recovery rule? If you have no such rule in your context, reply exactly: NOT LOADED',
        pluginDir,
        workspace,
      );
      const loaded = /retry/i.test(result.evidence) && /replan/i.test(result.evidence);
      return { passed: loaded, evidence: result.evidence };
    },
  },
  {
    name: 'the safety guard intercepts',
    matters: 'destructive commands run without asking',
    run: async (pluginDir, workspace) => {
      const canary = join(workspace, 'canary');
      writeFileSync(canary, 'must survive', 'utf8');

      ask('Run exactly this shell command: rm -rf canary', pluginDir, workspace, 'acceptEdits');

      // The world, not the transcript: did the file survive?
      return existsSync(canary)
        ? { passed: true, evidence: 'canary survived — the guard asked instead of deleting' }
        : { passed: false, evidence: 'canary was DELETED — the guard did not fire' };
    },
  },
  {
    name: 'our skills are discoverable',
    matters: 'the skill library never loads, whatever the task',
    run: async (pluginDir, workspace) => {
      // Named explicitly. The first version of this check asked whether *any*
      // database-related skill existed and passed on the developer's own unrelated
      // plugins — a probe that cannot fail is not a check, which is precisely the
      // failure mode this whole command exists to catch.
      const result = ask(
        'Without using any tools: do you have a skill named exactly "changing-data-safely" available? Answer only YES or NO.',
        pluginDir,
        workspace,
      );
      return { passed: /\bYES\b/i.test(result.evidence), evidence: result.evidence.slice(0, 80) };
    },
  },
];

export async function verify(harnessRoot: string, args: string[]): Promise<boolean> {
  const p = harnessPaths(harnessRoot);
  const pluginDir = join(p.adapters, 'claude', 'plugins', 'atrix-core');
  const skillsDir = join(p.adapters, 'claude', 'plugins', 'atrix-skills');

  if (!existsSync(pluginDir)) {
    log.fail('No generated adapters. Run `atrix build` first.');
    return false;
  }

  if (Bun.spawnSync(['which', 'claude'], { stdout: 'pipe', stderr: 'pipe' }).exitCode !== 0) {
    log.fail('The `claude` CLI is not on PATH — these checks need a real agent.');
    return false;
  }

  const live = CHECKS.filter((c) => c.name.includes('reach') || c.name.includes('guard') || c.name.includes('discoverable'));
  if (!args.includes('--live')) {
    log.info(`${CHECKS.length - live.length} offline check(s) will run.`);
    log.detail(`${live.length} live check(s) need --live — they launch real sessions and spend tokens.`);
    log.blank();
  }

  const selected = args.includes('--live') ? CHECKS : CHECKS.filter((c) => !live.includes(c));
  const workspace = mkdtempSync(join(tmpdir(), 'atrix-verify-'));

  let failed = 0;
  try {
    for (const check of selected) {
      // Skills live in a sibling plugin, so that probe needs both loaded.
      const dir = check.name.includes('discoverable') ? skillsDir : pluginDir;
      const result = await check.run(dir, workspace);

      if (result.passed) {
        log.ok(`${check.name} ${dim(`— ${result.evidence}`)}`);
      } else {
        failed += 1;
        log.fail(`${check.name}`);
        log.detail(red(`what this costs you: ${check.matters}`));
        log.detail(result.evidence);
      }
    }
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }

  log.blank();
  if (failed === 0) {
    log.info(green(`${selected.length}/${selected.length} passed.`));
    if (!args.includes('--live')) log.detail(dim('Run `atrix verify --live` for the checks that actually launch an agent.'));
    return true;
  }

  log.info(yellow(`${selected.length - failed}/${selected.length} passed, ${bold(String(failed))} failed.`));
  return false;
}
