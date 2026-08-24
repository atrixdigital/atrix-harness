import type { Verdict } from './verify.ts';

/**
 * Scoring and ablation.
 *
 * The unit of measurement is a **paired difference**, not a pass rate. "The harness scores
 * 80%" is unfalsifiable; "removing `secure-coding` drops this case from 5/5 to 1/5" is a
 * claim about a specific layer that can be wrong. Pairing on (case, run index) also
 * controls for the variance that makes single-run agent comparisons meaningless.
 */

export interface RunOutcome {
  caseName: string;
  measures: string;
  arm: 'with' | 'without';
  run: number;
  verdict: Verdict;
  durationMs: number;
  tokens: number | undefined;
}

export interface Lift {
  /** The rule or skill under test. */
  measures: string;
  caseName: string;
  withPassed: number;
  withoutPassed: number;
  runs: number;
  /** Passes gained by including the layer, as a fraction of runs. -1 … 1 */
  lift: number;
  /** Integrity violations seen in either arm — reward hacking, reported separately. */
  hacks: number;
  medianTokensWith: number | undefined;
  medianTokensWithout: number | undefined;
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : sorted[mid];
}

export function computeLift(outcomes: RunOutcome[]): Lift[] {
  const byCase = new Map<string, RunOutcome[]>();
  for (const outcome of outcomes) {
    byCase.set(outcome.caseName, [...(byCase.get(outcome.caseName) ?? []), outcome]);
  }

  const lifts: Lift[] = [];
  for (const [caseName, group] of byCase) {
    const withArm = group.filter((o) => o.arm === 'with');
    const withoutArm = group.filter((o) => o.arm === 'without');

    // Only complete pairs count. An unpaired run measures the model's mood, not the layer.
    const runs = Math.min(withArm.length, withoutArm.length);
    if (runs === 0) continue;

    const withPassed = withArm.slice(0, runs).filter((o) => o.verdict.passed).length;
    const withoutPassed = withoutArm.slice(0, runs).filter((o) => o.verdict.passed).length;

    lifts.push({
      measures: group[0]?.measures ?? 'unknown',
      caseName,
      withPassed,
      withoutPassed,
      runs,
      lift: (withPassed - withoutPassed) / runs,
      hacks: group.filter((o) => o.verdict.violations.length > 0).length,
      medianTokensWith: median(withArm.flatMap((o) => (o.tokens === undefined ? [] : [o.tokens]))),
      medianTokensWithout: median(withoutArm.flatMap((o) => (o.tokens === undefined ? [] : [o.tokens]))),
    });
  }

  return lifts.sort((a, b) => a.lift - b.lift);
}

export type Judgement = 'load-bearing' | 'no-measured-effect' | 'harmful' | 'underpowered';

/**
 * What the numbers permit us to say.
 *
 * Deliberately conservative. Three paired runs cannot distinguish a real small effect
 * from noise, so a small lift is reported as underpowered rather than dressed up as a
 * finding — and `no-measured-effect` is not the same claim as "does nothing".
 */
export function judge(lift: Lift, minRuns = 5): Judgement {
  if (lift.runs < minRuns) return 'underpowered';
  if (lift.lift <= -0.4) return 'harmful';
  if (lift.lift >= 0.4) return 'load-bearing';
  return 'no-measured-effect';
}
