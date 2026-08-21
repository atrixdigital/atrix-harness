import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bold, cyan, dim, log } from '../lib/log.ts';

/**
 * Mine the local trace for failure patterns worth turning into incidents.
 *
 * This is the half of the learning loop that does not depend on somebody remembering.
 * A failure that happened once is noise; the same failure eleven times is a harness gap,
 * and the person who hit it eleven times had stopped noticing by the fourth.
 *
 * It proposes; it never writes. `atrix learn` is still a deliberate act — automatic
 * incident creation would fill the loop with churn nobody triages.
 */

interface TraceRecord {
  date: string;
  tool: string;
  ok: boolean;
  program?: string;
  signature?: string;
}

export interface Cluster {
  tool: string;
  program: string | undefined;
  signature: string;
  count: number;
  days: number;
  lastSeen: string;
}

/** Below this a pattern is an incident, not a trend. */
const MIN_OCCURRENCES = 3;

export function clusterFailures(records: TraceRecord[]): Cluster[] {
  const groups = new Map<string, { c: Cluster; dates: Set<string> }>();

  for (const record of records) {
    if (record.ok || record.signature === undefined) continue;
    const key = `${record.tool}|${record.program ?? ''}|${record.signature}`;
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, {
        c: {
          tool: record.tool,
          program: record.program,
          signature: record.signature,
          count: 1,
          days: 1,
          lastSeen: record.date,
        },
        dates: new Set([record.date]),
      });
      continue;
    }
    existing.c.count += 1;
    existing.dates.add(record.date);
    if (record.date > existing.c.lastSeen) existing.c.lastSeen = record.date;
  }

  return [...groups.values()]
    .map(({ c, dates }) => ({ ...c, days: dates.size }))
    .filter((c) => c.count >= MIN_OCCURRENCES)
    // Recurring across several days beats a single bad afternoon.
    .sort((a, b) => b.days - a.days || b.count - a.count);
}

export function parseTrace(contents: string): TraceRecord[] {
  const records: TraceRecord[] = [];
  for (const line of contents.split('\n')) {
    if (line.trim() === '') continue;
    try {
      records.push(JSON.parse(line) as TraceRecord);
    } catch {
      // A truncated final line is normal for an append-only log being written concurrently.
    }
  }
  return records;
}

export function observe(projectRoot: string): void {
  const tracePath = join(projectRoot, '.atrix', 'trace.jsonl');

  if (!existsSync(tracePath)) {
    log.info('No trace recorded yet.');
    log.detail('Install the atrix-core plugin and work normally — the PostToolUse hook records as you go.');
    log.detail(`Expected at ${tracePath}`);
    return;
  }

  const records = parseTrace(readFileSync(tracePath, 'utf8'));
  const failures = records.filter((r) => !r.ok);
  const rate = records.length === 0 ? 0 : Math.round((failures.length / records.length) * 100);

  log.info(`${records.length} tool calls recorded, ${failures.length} failed (${rate}%)`);
  log.blank();

  const clusters = clusterFailures(records);
  if (clusters.length === 0) {
    log.ok(`no failure pattern recurred ${MIN_OCCURRENCES}+ times — nothing to learn from yet`);
    return;
  }

  log.info(bold(`${clusters.length} recurring failure pattern(s):`));
  log.blank();

  for (const [i, cluster] of clusters.entries()) {
    const where = cluster.program === undefined ? cluster.tool : `${cluster.tool} → ${cluster.program}`;
    log.info(`${cyan(`${i + 1}.`)} ${bold(where)}  ${cluster.count}× across ${cluster.days} day(s)`);
    log.detail(cluster.signature);
    log.detail(dim(`last seen ${cluster.lastSeen}`));
    log.blank();
  }

  log.info('These are candidates, not conclusions. For any that cost real time:');
  log.detail('atrix learn "<what actually went wrong>"');
  log.blank();
  log.detail('Ask first whether a check, a hook or a type could prevent it — that beats a rule.');
}
