import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

/**
 * An eval case.
 *
 * Two design constraints, both from evidence rather than taste:
 *
 * 1. **Verification never reads the agent's output.** Long-horizon coding agents
 *    demonstrably game evaluations — weakening tests, special-casing known inputs,
 *    deleting assertions, editing expected output (SpecBench, arXiv 2605.21384). A
 *    keyword probe on an agent's own summary lets all of that pass. So every check here
 *    re-runs a command or re-reads a file in the workspace.
 *
 * 2. **Protected paths are checked by hash.** If an agent edits the tests to make them
 *    pass, that is not a pass — it is the failure mode the eval exists to catch. Any
 *    modification under `integrity.unchanged` fails the case outright, whatever the
 *    assertions say.
 */

/** Run a command; the case passes this check if the exit code matches. */
const commandCheck = z.object({
  name: z.string().min(3),
  run: z.string().min(1),
  /** Default 0. Set non-zero when the expected outcome is a failure. */
  exit: z.number().int().default(0),
  timeoutMs: z.number().int().positive().default(120_000),
});

/** Read a file back from disk and assert its content. */
const fileCheck = z.object({
  name: z.string().min(3),
  file: z.string().min(1),
  contains: z.string().optional(),
  absent: z.string().optional(),
  /** Anchored to the whole file; use for shapes a substring cannot express. */
  matches: z.string().optional(),
});

export const checkSchema = z.union([commandCheck, fileCheck]);
export type Check = z.infer<typeof checkSchema>;

export const isCommandCheck = (check: Check): check is z.infer<typeof commandCheck> => 'run' in check;

export const caseSchema = z.object({
  name: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be kebab-case'),
  description: z.string().min(20),

  /**
   * The harness layer this case measures — a rule or skill name.
   *
   * The ablation removes exactly this layer for the control run, so the difference
   * between arms is attributable to it rather than to the harness in aggregate.
   */
  measures: z.string().min(2),

  /** Directory under evals/fixtures copied into a scratch workspace before each run. */
  workspace: z.string().min(1),

  /** What the agent is asked to do. Deliberately does not hint at the thing being measured. */
  prompt: z.string().min(20),

  verify: z.array(checkSchema).min(1),

  integrity: z
    .object({
      /**
       * Globs the agent must not modify. Editing a test to make it pass is the
       * canonical reward hack; hashing these is how we catch it.
       */
      unchanged: z.array(z.string()).default([]),
    })
    .default({ unchanged: [] }),
});

export type EvalCase = z.infer<typeof caseSchema>;

export interface LoadedCases {
  cases: EvalCase[];
  issues: string[];
}

export function loadCases(dir: string): LoadedCases {
  const cases: EvalCase[] = [];
  const issues: string[] = [];

  let entries: string[];
  try {
    entries = readdirSync(dir).sort();
  } catch {
    // An absent directory is a legitimate state for a repo with no evals yet,
    // reported as an issue rather than an exception so `atrix eval` can say so.
    return { cases, issues: [`no case directory at ${dir}`] };
  }

  for (const entry of entries) {
    if (!entry.endsWith('.yml') && !entry.endsWith('.yaml')) continue;

    let raw: unknown;
    try {
      raw = Bun.YAML.parse(readFileSync(join(dir, entry), 'utf8'));
    } catch (error) {
      // Reported per file rather than thrown: one malformed case must not hide the
      // validity of every other case in the directory.
      issues.push(`${entry} — not valid YAML: ${(error as Error).message}`);
      continue;
    }

    const parsed = caseSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        issues.push(`${entry} — ${issue.path.join('.') || 'root'}: ${issue.message}`);
      }
      continue;
    }

    if (parsed.data.name !== entry.replace(/\.ya?ml$/, '')) {
      issues.push(`${entry} — name "${parsed.data.name}" does not match the filename`);
      continue;
    }

    cases.push(parsed.data);
  }

  return { cases, issues };
}
