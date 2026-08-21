import { describe, expect, test } from 'bun:test';
import { clusterFailures, parseTrace } from './observe.ts';

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
