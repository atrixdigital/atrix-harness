import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { EvalCase } from './case.ts';

/**
 * The runner seam.
 *
 * Which agent executes a case is a swappable provider, not a property of the harness —
 * the same case must be runnable under Claude Code, Codex, Gemini or a replay of a
 * recorded session. Results are reported per (agent, arm), never as a single number,
 * because harness effects are model-dependent: weaker models vary far more across
 * harnesses than stronger ones.
 */

/** Which arm of the ablation this run belongs to. */
export type Arm = 'with' | 'without';

export interface RunRequest {
  workspace: string;
  prompt: string;
  /** The rule bundle for this arm — full, or with the measured layer removed. */
  systemPrompt: string;
  arm: Arm;
  evalCase: EvalCase;
}

export interface RunResult {
  /** Wall clock, which is the only cost signal every runner can supply. */
  durationMs: number;
  /** Present when the runner reports usage; absent is honest, zero is not. */
  tokens?: number;
  turns?: number;
  /** Non-zero means the agent errored out, which is distinct from failing the checks. */
  exitCode: number;
  /** Kept for debugging only. Never read by verification — see verify.ts. */
  transcript: string;
}

export type Runner = (request: RunRequest) => Promise<RunResult>;

/**
 * Shell out to an agent CLI.
 *
 * `{{prompt}}` and `{{system}}` are substituted into the argv template. The template is
 * per-agent config rather than code so adding an agent is a line, not a fork.
 */
export function commandRunner(template: string[], label: string): Runner {
  return async ({ workspace, prompt, systemPrompt }) => {
    const systemFile = join(workspace, '.atrix-eval-system.md');
    writeFileSync(systemFile, systemPrompt, 'utf8');

    const argv = template.map((arg) =>
      arg.replace('{{prompt}}', prompt).replace('{{system}}', systemFile).replace('{{label}}', label),
    );

    const started = Date.now();
    const proc = Bun.spawn(argv, { cwd: workspace, stdout: 'pipe', stderr: 'pipe' });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    return {
      durationMs: Date.now() - started,
      exitCode,
      transcript: `${stdout}\n${stderr}`,
    };
  };
}

/**
 * Replay a recorded run.
 *
 * Exists so the framework itself is testable without spending money or depending on a
 * model's mood. A fixture applies its recorded file mutations to the workspace, which
 * lets us assert that verification, integrity checking and scoring behave — including
 * against a recording of an agent that cheated.
 */
export interface Recording {
  durationMs: number;
  tokens?: number;
  turns?: number;
  exitCode: number;
  transcript: string;
  /** Path → new contents. A null value deletes the file. */
  writes: Record<string, string | null>;
}

export function replayRunner(recordings: Record<string, Recording>): Runner {
  return async ({ workspace, arm, evalCase }) => {
    const key = `${evalCase.name}:${arm}`;
    const recording = recordings[key];
    if (recording === undefined) {
      throw new Error(`No recording for ${key}. Record one, or run with a real agent.`);
    }

    for (const [path, contents] of Object.entries(recording.writes)) {
      const full = join(workspace, path);
      if (contents === null) {
        rmSync(full, { force: true });
        continue;
      }
      mkdirSync(join(full, '..'), { recursive: true });
      writeFileSync(full, contents, 'utf8');
    }

    const { writes: _writes, ...result } = recording;
    return result;
  };
}

/** Fresh workspace per run: arms must not see each other's edits. */
export function prepareWorkspace(fixtureDir: string, caseName: string, arm: Arm, run: number): string {
  const workspace = join(tmpdir(), `atrix-eval-${caseName}-${arm}-${run}-${Bun.hash(fixtureDir).toString(16)}`);
  rmSync(workspace, { recursive: true, force: true });
  mkdirSync(workspace, { recursive: true });
  cpSync(fixtureDir, workspace, { recursive: true });
  return workspace;
}
