import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Reading the trace back.
 *
 * Traces are written per project, so anything reading them must discover every file
 * rather than assume one. `atrix observe` and the session-start hook both got this
 * wrong independently — each read `.atrix/trace.jsonl`, found nothing, and reported
 * "no trace recorded" while four records sat in `.atrix/projects/playo/`.
 *
 * That is why this lives in one place: two readers of the same format drifted apart
 * within a day of the format changing.
 */

export interface TraceRecord {
  date: string;
  tool: string;
  ok: boolean;
  project?: string;
  program?: string;
  signature?: string;
}

export interface Cluster {
  tool: string;
  program: string | undefined;
  project: string | undefined;
  signature: string;
  count: number;
  /** Distinct days seen. A week beats a bad afternoon. */
  days: number;
  lastSeen: string;
}

/** Below this a repeated failure is an incident, not a standing problem. */
export const MIN_RECURRENCE = 3;

export function parseTrace(contents: string): TraceRecord[] {
  const records: TraceRecord[] = [];
  for (const line of contents.split('\n')) {
    if (line.trim() === '') continue;
    try {
      records.push(JSON.parse(line) as TraceRecord);
    } catch {
      // A truncated final line is normal for an append-only log written concurrently.
    }
  }
  return records;
}

/** Every trace in the workspace: the root one, plus one per project. */
export function traceFiles(workspaceRoot: string): string[] {
  const atrix = join(workspaceRoot, '.atrix');
  const files: string[] = [];

  const root = join(atrix, 'trace.jsonl');
  if (existsSync(root)) files.push(root);

  const projectsDir = join(atrix, 'projects');
  if (existsSync(projectsDir)) {
    for (const name of readdirSync(projectsDir)) {
      const file = join(projectsDir, name, 'trace.jsonl');
      if (existsSync(file)) files.push(file);
    }
  }

  return files;
}

export function readTrace(workspaceRoot: string, project?: string): TraceRecord[] {
  const records: TraceRecord[] = [];
  for (const file of traceFiles(workspaceRoot)) {
    try {
      records.push(...parseTrace(readFileSync(file, 'utf8')));
    } catch {
      // An unreadable trace must never break the caller.
    }
  }
  return project === undefined ? records : records.filter((r) => r.project === project);
}

/**
 * Group repeated failures.
 *
 * Keyed by project as well as signature: the same error in two repos is two problems,
 * and merging them inflates a count that is supposed to mean "this keeps happening here".
 */
export function clusterFailures(records: TraceRecord[], minRecurrence = MIN_RECURRENCE): Cluster[] {
  const groups = new Map<string, { cluster: Cluster; dates: Set<string> }>();

  for (const record of records) {
    if (record.ok || record.signature === undefined) continue;
    const key = `${record.project ?? ''}|${record.tool}|${record.program ?? ''}|${record.signature}`;
    const existing = groups.get(key);

    if (existing === undefined) {
      groups.set(key, {
        cluster: {
          tool: record.tool,
          program: record.program,
          project: record.project,
          signature: record.signature,
          count: 1,
          days: 1,
          lastSeen: record.date,
        },
        dates: new Set([record.date]),
      });
      continue;
    }

    existing.cluster.count += 1;
    existing.dates.add(record.date);
    if (record.date > existing.cluster.lastSeen) existing.cluster.lastSeen = record.date;
  }

  return [...groups.values()]
    .map(({ cluster, dates }) => ({ ...cluster, days: dates.size }))
    .filter((c) => c.count >= minRecurrence)
    // Recurring across days beats a single bad afternoon.
    .sort((a, b) => b.days - a.days || b.count - a.count);
}

export const describeCluster = (c: Cluster): string =>
  `${c.project === undefined ? '' : `${c.project} · `}${c.program ?? c.tool}: ${c.signature}`;
