import { clusterFailures, describeCluster, MIN_RECURRENCE, readTrace, traceFiles } from '@atrix/hooks/trace.ts';
import { bold, cyan, dim, log } from '../lib/log.ts';
import { activeProject } from '../lib/workspace.ts';

/**
 * Mine the trace for failure patterns worth turning into incidents.
 *
 * Reads through `@atrix/hooks/*`, which maps to `core/hooks/lib/`. That directory is
 * copied wholesale into the Claude plugin, so it may not import from `packages/` — which
 * makes it the correct home for logic both a hook and the CLI need, and makes this the
 * one direction the dependency can legally run.
 *
 * This is the half of the learning loop that does not depend on somebody remembering. A
 * failure that happened once is noise; the same failure eleven times is a harness gap, and
 * the person who hit it eleven times had stopped noticing by the fourth.
 *
 * It proposes; it never writes. Automatic incident creation fills the loop with churn
 * nobody triages.
 */
export function observe(workspaceRoot: string, args: string[]): boolean {
  const all = args.includes('--all');
  const active = activeProject(workspaceRoot);
  const scope = all ? undefined : active?.name;

  const files = traceFiles(workspaceRoot);
  if (files.length === 0) {
    log.info('No trace recorded yet.');
    log.detail('Install the atrix-core plugin and work normally — the PostToolUse hook records as you go.');
    return true;
  }

  const records = readTrace(workspaceRoot, scope);
  const failures = records.filter((r) => !r.ok);
  const rate = records.length === 0 ? 0 : Math.round((failures.length / records.length) * 100);
  const where = scope === undefined ? `${files.length} trace file(s)` : `project ${bold(scope)}`;

  log.info(`${records.length} tool calls across ${where}, ${failures.length} failed (${rate}%)`);
  if (!all && scope !== undefined) log.detail(dim('--all spans every project in the workspace'));
  log.blank();

  const clusters = clusterFailures(records);
  if (clusters.length === 0) {
    log.ok(`no failure pattern recurred ${MIN_RECURRENCE}+ times — nothing to learn from yet`);
    return true;
  }

  log.info(bold(`${clusters.length} recurring failure pattern(s):`));
  log.blank();

  for (const [i, cluster] of clusters.entries()) {
    log.info(`${cyan(`${i + 1}.`)} ${bold(describeCluster(cluster))}`);
    log.detail(`${cluster.count}× across ${cluster.days} day(s), last seen ${cluster.lastSeen}`);
    log.blank();
  }

  log.info('These are candidates, not conclusions. For any that cost real time:');
  log.detail('atrix learn "<what actually went wrong>"');
  log.blank();
  log.detail('Ask first whether a check, a hook or a type could prevent it — that beats a rule.');
  return true;
}
