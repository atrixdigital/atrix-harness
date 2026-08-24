import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { commandRunner, judge, loadCases, runSuite, type Lift } from '@atrix/eval';
import { loadCore } from '../lib/core.ts';
import { AtrixError, bold, dim, log, yellow } from '../lib/log.ts';
import { harnessPaths } from '../lib/paths.ts';
import { renderRuleBundle } from './build.ts';

/**
 * Two modes, and the default is the free one.
 *
 * Coverage needs no model and answers the question that actually matters day to day:
 * which rules has nobody ever measured? Running the suite costs real money against a
 * real model, so it is opt-in and names the cost before it starts.
 */

/** argv templates per agent. Adding one is a line, not a fork. */
const AGENTS: Record<string, string[]> = {
  claude: ['claude', '-p', '{{prompt}}', '--append-system-prompt-file', '{{system}}', '--permission-mode', 'acceptEdits'],
  codex: ['codex', 'exec', '--full-auto', '{{prompt}}'],
  gemini: ['gemini', '-p', '{{prompt}}', '-y'],
};

function reportCoverage(harnessRoot: string): boolean {
  const p = harnessPaths(harnessRoot);
  const core = loadCore(harnessRoot);
  const { cases, issues } = loadCases(join(p.evals, 'cases'));

  if (issues.length > 0) {
    log.fail(`${issues.length} problem(s) in evals/cases:`);
    for (const issue of issues) log.detail(issue);
    return false;
  }

  const measured = new Set(cases.map((c) => c.measures));
  const layers = [
    ...core.rules.map((d) => ({ name: d.meta.name, kind: 'rule' })),
    ...core.methodology.map((d) => ({ name: d.meta.name, kind: 'rule' })),
    ...core.skills.map((d) => ({ name: d.meta.name, kind: 'skill' })),
  ];

  const covered = layers.filter((l) => measured.has(l.name));
  const uncovered = layers.filter((l) => !measured.has(l.name));
  const orphaned = [...measured].filter((m) => !layers.some((l) => l.name === m));

  log.info(`${cases.length} case(s) covering ${covered.length} of ${layers.length} layers`);
  log.blank();

  if (covered.length > 0) {
    log.ok('measured:');
    for (const layer of covered) log.detail(`${layer.name} (${layer.kind})`);
    log.blank();
  }

  // The honest headline. Every unmeasured layer is a claim nobody has tested — which is
  // fine, as long as it is not mistaken for a claim that has been.
  log.warn(`${uncovered.length} layer(s) have no eval — their effect is unknown, not proven:`);
  for (const layer of uncovered) log.detail(`${yellow(layer.name)} (${layer.kind})`);

  if (orphaned.length > 0) {
    log.blank();
    log.fail(`${orphaned.length} case(s) measure something that no longer exists:`);
    for (const name of orphaned) log.detail(name);
    return false;
  }

  log.blank();
  log.detail('Run the suite with: atrix eval --run --agent claude   (costs real tokens)');
  return true;
}

function renderLift(lift: Lift): string {
  const verdict = judge(lift);
  const label =
    verdict === 'load-bearing'
      ? '✓ load-bearing'
      : verdict === 'harmful'
        ? '✗ HARMFUL'
        : verdict === 'underpowered'
          ? '? underpowered'
          : '– no measured effect';

  const pct = `${lift.lift >= 0 ? '+' : ''}${Math.round(lift.lift * 100)}%`;
  const hacks = lift.hacks > 0 ? `  ${yellow(`${lift.hacks} integrity violation(s)`)}` : '';
  return `${label}  ${bold(lift.measures)}  ${pct}  (${lift.withPassed}/${lift.runs} with, ${lift.withoutPassed}/${lift.runs} without)${hacks}`;
}

export async function runEval(harnessRoot: string, args: string[]): Promise<boolean> {
  const p = harnessPaths(harnessRoot);

  if (!args.includes('--run')) return reportCoverage(harnessRoot);

  const agentName = args[args.indexOf('--agent') + 1] ?? 'claude';
  const template = AGENTS[agentName];
  if (template === undefined) {
    throw new AtrixError(`Unknown agent "${agentName}".`, `Known: ${Object.keys(AGENTS).join(', ')}`);
  }

  const runsArg = args[args.indexOf('--runs') + 1];
  const runs = args.includes('--runs') && runsArg !== undefined ? Number(runsArg) : 5;
  if (!Number.isInteger(runs) || runs < 1) throw new AtrixError('--runs must be a positive integer.');

  const { cases, issues } = loadCases(join(p.evals, 'cases'));
  if (issues.length > 0) {
    log.fail('fix the case problems first:');
    for (const issue of issues) log.detail(issue);
    return false;
  }

  const core = loadCore(harnessRoot);
  const agentsMd = readFileSync(p.agentsMd, 'utf8');
  const fixturesDir = join(p.evals, 'fixtures');
  if (!existsSync(fixturesDir)) throw new AtrixError(`No fixtures directory at ${fixturesDir}.`);

  // Say the cost out loud before spending it. Each case runs twice per repetition.
  const total = cases.length * runs * 2;
  log.warn(`about to run ${total} agent invocations (${cases.length} cases × ${runs} runs × 2 arms) via ${agentName}`);
  log.detail('This spends real tokens. Ctrl-C now if that was not intended.');
  log.blank();

  const { lifts } = await runSuite({
    cases,
    fixturesDir,
    runner: commandRunner(template, agentName),
    runs,
    bundle: (exclude) => renderRuleBundle(core, agentsMd, exclude),
    onProgress: (message) => log.step(message),
  });

  log.blank();
  log.info(bold(`Results — ${agentName}, ${runs} paired runs per case`));
  log.blank();
  for (const lift of lifts) log.info(renderLift(lift));

  log.blank();
  const harmful = lifts.filter((l) => judge(l) === 'harmful');
  const dead = lifts.filter((l) => judge(l) === 'no-measured-effect');

  if (harmful.length > 0) log.fail(`${harmful.length} layer(s) measurably made things worse — remove or fix them.`);
  if (dead.length > 0) {
    log.warn(`${dead.length} layer(s) showed no measured effect — candidates for pruning.`);
    log.detail('Confirm with more runs before deleting; absence of evidence at n=5 is weak.');
  }
  log.detail(dim('Record findings in learning/CHANGELOG.md.'));

  return harmful.length === 0;
}
