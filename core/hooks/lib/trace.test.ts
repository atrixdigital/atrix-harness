import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clusterFailures, describeCluster, parseTrace, readTrace, traceFiles } from './trace.ts';

const fail = (date: string, signature: string, program = 'bun') => ({ date, tool: 'Bash', ok: false, program, signature });

describe('clustering', () => {
  test('ignores a pattern seen fewer than three times', () => {
    const clusters = clusterFailures([fail('2026-08-01', 'a'), fail('2026-08-01', 'a')]);
    expect(clusters).toEqual([]);
  });

  test('surfaces a pattern seen three or more times', () => {
    const clusters = clusterFailures([fail('2026-08-01', 'a'), fail('2026-08-01', 'a'), fail('2026-08-02', 'a')]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.count).toBe(3);
    expect(clusters[0]?.days).toBe(2);
    expect(clusters[0]?.lastSeen).toBe('2026-08-02');
  });

  test('ranks a pattern recurring across days above a one-day burst', () => {
    // A bad afternoon is noise. The same failure across a week is a harness gap.
    const spread = ['2026-08-01', '2026-08-02', '2026-08-03'].map((d) => fail(d, 'spread'));
    const burst = Array.from({ length: 20 }, () => fail('2026-08-01', 'burst'));
    const clusters = clusterFailures([...burst, ...spread]);
    expect(clusters[0]?.signature).toBe('spread');
  });

  test('keeps different programs apart', () => {
    const rows = [
      ...Array.from({ length: 3 }, () => fail('2026-08-01', 'same', 'psql')),
      ...Array.from({ length: 3 }, () => fail('2026-08-01', 'same', 'bun')),
    ];
    expect(clusterFailures(rows)).toHaveLength(2);
  });

  test('ignores successes', () => {
    expect(clusterFailures([{ date: '2026-08-01', tool: 'Read', ok: true }])).toEqual([]);
  });
});

describe('parsing', () => {
  test('tolerates a truncated final line from a concurrent append', () => {
    const rows = parseTrace('{"date":"2026-08-01","tool":"Bash","ok":true}\n{"date":"2026-08-0');
    expect(rows).toHaveLength(1);
  });
});


describe('discovering traces across a workspace', () => {
  let ws: string;

  const seed = (relative: string, records: object[]): void => {
    const file = join(ws, relative);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, records.map((r) => JSON.stringify(r)).join('\n'));
  };

  beforeEach(() => {
    ws = mkdtempSync(join(tmpdir(), 'atrix-trace-'));
  });
  afterEach(() => rmSync(ws, { recursive: true, force: true }));

  test('finds per-project traces, not just the root one', () => {
    // The regression this file exists for: both readers looked only at
    // .atrix/trace.jsonl and reported "no trace" while records sat under projects/.
    seed('.atrix/projects/playo/trace.jsonl', [{ date: '2026-08-24', tool: 'Bash', ok: false, project: 'playo', signature: 's' }]);
    seed('.atrix/projects/ezrov/trace.jsonl', [{ date: '2026-08-24', tool: 'Bash', ok: true, project: 'ezrov' }]);

    expect(traceFiles(ws)).toHaveLength(2);
    expect(readTrace(ws)).toHaveLength(2);
  });

  test('scopes to one project when asked', () => {
    seed('.atrix/projects/playo/trace.jsonl', [{ date: '2026-08-24', tool: 'Bash', ok: false, project: 'playo', signature: 's' }]);
    seed('.atrix/projects/ezrov/trace.jsonl', [{ date: '2026-08-24', tool: 'Bash', ok: false, project: 'ezrov', signature: 's' }]);

    expect(readTrace(ws, 'playo')).toHaveLength(1);
    expect(readTrace(ws, 'playo')[0]?.project).toBe('playo');
  });

  test('the same error in two projects is two problems, not one', () => {
    // Merging them inflates a count that is supposed to mean "this keeps happening here".
    const rows = ['playo', 'ezrov'].flatMap((project) =>
      [1, 2, 3].map(() => ({ date: '2026-08-24', tool: 'Bash', ok: false, project, program: 'psql', signature: 'refused' })),
    );
    const clusters = clusterFailures(rows);
    expect(clusters).toHaveLength(2);
    expect(clusters.every((c) => c.count === 3)).toBe(true);
  });

  test('names the project in the description', () => {
    const [cluster] = clusterFailures(
      [1, 2, 3].map(() => ({ date: '2026-08-24', tool: 'Bash', ok: false, project: 'playo', program: 'psql', signature: 'refused' })),
    );
    expect(describeCluster(cluster!)).toContain('playo');
  });

  test('an empty workspace yields nothing rather than throwing', () => {
    expect(traceFiles(ws)).toEqual([]);
    expect(readTrace(ws)).toEqual([]);
  });
});
