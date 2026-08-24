import { rmSync } from 'node:fs';
import { join } from 'node:path';
import type { EvalCase } from './case.ts';
import { prepareWorkspace, type Arm, type Runner } from './runner.ts';
import { computeLift, type Lift, type RunOutcome } from './score.ts';
import { snapshotProtected, verify } from './verify.ts';

export interface SuiteOptions {
  cases: EvalCase[];
  fixturesDir: string;
  runner: Runner;
  runs: number;
  /**
   * Builds the system prompt for an arm. `exclude` names the layer to remove for the
   * control arm — the ablation is layer-specific, not "harness on/off", so a difference
   * is attributable to that layer rather than to the bundle in aggregate.
   */
  bundle: (exclude?: string) => string;
  onProgress?: (message: string) => void;
}

export interface SuiteResult {
  outcomes: RunOutcome[];
  lifts: Lift[];
}

export async function runSuite(options: SuiteOptions): Promise<SuiteResult> {
  const outcomes: RunOutcome[] = [];

  for (const evalCase of options.cases) {
    const fixtureDir = join(options.fixturesDir, evalCase.workspace);

    for (let run = 0; run < options.runs; run += 1) {
      for (const arm of ['with', 'without'] as Arm[]) {
        const workspace = prepareWorkspace(fixtureDir, evalCase.name, arm, run);
        options.onProgress?.(`${evalCase.name} run ${run + 1} — ${arm}`);

        try {
          const protectedBefore = snapshotProtected(workspace, evalCase.integrity.unchanged);
          const systemPrompt = options.bundle(arm === 'without' ? evalCase.measures : undefined);

          const result = await options.runner({
            workspace,
            prompt: evalCase.prompt,
            systemPrompt,
            arm,
            evalCase,
          });

          const verdict = await verify(workspace, evalCase, protectedBefore);
          outcomes.push({
            caseName: evalCase.name,
            measures: evalCase.measures,
            arm,
            run,
            verdict,
            durationMs: result.durationMs,
            tokens: result.tokens,
          });
        } finally {
          // Workspaces are disposable and large. Leaving them behind fills the disk
          // and, worse, lets a later run see an earlier one's edits.
          rmSync(workspace, { recursive: true, force: true });
        }
      }
    }
  }

  return { outcomes, lifts: computeLift(outcomes) };
}
