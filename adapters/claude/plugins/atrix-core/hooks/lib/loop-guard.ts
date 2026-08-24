/**
 * Loop detection — bounded recovery turned from prose into an intervention.
 *
 * `core/methodology/bounded-recovery.md` says retry ×2 → patch ×2 → replan, then stop.
 * Nothing enforced it, which made it exactly the kind of rule that gets skipped under
 * pressure. Tool errors without effective recovery are 24.6% of agent failures.
 *
 * Design taken from three implementations that converged independently:
 *
 * - **Advisory, never a veto** (dsh `repeat-tool-reminder`). The decision — retry
 *   differently, gather evidence, or finish — stays with the model. A guard that blocks
 *   legitimate work gets switched off, which is strictly worse than no guard.
 * - **Detect no-progress, not failure** (Hermes). Their guardrails missed a mutating tool
 *   that repeatedly *succeeds* while achieving nothing: an agent called the same
 *   non-existent URL 98 times, successfully, every time. Counting failures catches none
 *   of that.
 * - **Key on the result too** (OpenClaw). Identical call + identical result = no progress.
 *   If the result differs, something moved, so the chain resets.
 */

/** Consecutive identical calls at which each level of nudge fires. Ascending, ≥2. */
export const DEFAULT_THRESHOLDS = [3, 5, 8] as const;

/** Tools whose calls neither advance nor reset a chain. */
const TRANSPARENT_TOOLS = new Set(['TodoWrite']);

export interface Chain {
  /** `${tool}|${argsHash}|${resultHash}` */
  key: string;
  count: number;
  tool: string;
  /** Short, redacted preview for the detailed reminder. Never raw arguments. */
  preview: string;
  /** Epoch ms, for pruning. */
  updated: number;
}

export type LoopState = Record<string, Chain>;

/**
 * Deep key-sort before stringify, so argument objects differing only in property
 * order hash identically. Without this a model that re-emits the same call with
 * reordered keys escapes detection for free.
 */
export function canonicalise(value: unknown): string {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v !== null && typeof v === 'object') {
      return Object.fromEntries(
        Object.keys(v as Record<string, unknown>)
          .sort()
          .map((k) => [k, walk((v as Record<string, unknown>)[k])]),
      );
    }
    return v;
  };
  return JSON.stringify(walk(value)) ?? '';
}

export const hash = (input: string): string => Bun.hash(input).toString(16);

/** A short, safe description of the call for the detailed reminder. */
export function previewOf(tool: string, input: unknown): string {
  if (input === null || typeof input !== 'object') return tool;
  const record = input as Record<string, unknown>;

  // Prefer the field that identifies *what* was acted on. Never a file body.
  for (const field of ['command', 'file_path', 'path', 'pattern', 'query', 'url', 'symbol']) {
    const value = record[field];
    if (typeof value === 'string' && value.trim() !== '') {
      const trimmed = value.length > 120 ? `${value.slice(0, 117)}…` : value;
      return `${tool}(${field}: ${trimmed})`;
    }
  }
  return tool;
}

export interface Observation {
  sessionId: string;
  tool: string;
  input: unknown;
  /** Normalised result text — volatile parts (paths, numbers, hex) already stripped. */
  resultSignature: string;
  now: number;
}

export interface Nudge {
  level: number;
  count: number;
  message: string;
}

/** Keep the state file small and drop chains from sessions nobody is in any more. */
const MAX_CHAINS = 50;
const CHAIN_TTL_MS = 6 * 60 * 60 * 1000;

export function prune(state: LoopState, now: number): LoopState {
  const live = Object.entries(state)
    .filter(([, chain]) => now - chain.updated < CHAIN_TTL_MS)
    .sort(([, a], [, b]) => b.updated - a.updated)
    .slice(0, MAX_CHAINS);
  return Object.fromEntries(live);
}

function reminder(chain: Chain, level: number, thresholds: readonly number[]): string {
  if (level === 0) {
    return `You have made the same call ${chain.count} times in a row with the same result. Re-read the last result before calling it again — if nothing has changed, change approach.`;
  }

  const last = level >= thresholds.length - 1;
  const base =
    `Loop detected: \`${chain.preview}\` has now run ${chain.count} times consecutively with an identical result. ` +
    `Repeating it will not produce a different one.`;

  return last
    ? `${base}\n\nBounded recovery says stop here: retry ×2 → patch ×2 → replan, then report. ` +
        `You are past that. State what you have established, what you ruled out, and what you need — ` +
        `do not call this again. The next identical call will be escalated to the human.`
    : `${base}\n\nChange the approach or gather different evidence. If neither is available, stop and report what you know.`;
}

/**
 * Fold one tool result into the chain state.
 *
 * Returns the (possibly updated) state and a nudge when a threshold was crossed
 * exactly now — thresholds fire once each, not on every subsequent call.
 */
export function observe(
  state: LoopState,
  observation: Observation,
  thresholds: readonly number[] = DEFAULT_THRESHOLDS,
): { state: LoopState; nudge: Nudge | undefined } {
  // Bookkeeping tools must not launder a loop: a chain interleaved with TodoWrite is
  // still a chain, so these neither advance nor reset it.
  if (TRANSPARENT_TOOLS.has(observation.tool)) return { state, nudge: undefined };

  const key = `${observation.tool}|${hash(canonicalise(observation.input))}|${hash(observation.resultSignature)}`;
  const existing = state[observation.sessionId];
  const count = existing !== undefined && existing.key === key ? existing.count + 1 : 1;

  const chain: Chain = {
    key,
    count,
    tool: observation.tool,
    preview: previewOf(observation.tool, observation.input),
    updated: observation.now,
  };

  const next = prune({ ...state, [observation.sessionId]: chain }, observation.now);

  // Fire only on the exact call that reaches a threshold. Nudging every call after
  // the third turns a signal into noise the model learns to skip.
  const level = thresholds.indexOf(count);
  return {
    state: next,
    nudge: level === -1 ? undefined : { level, count, message: reminder(chain, level, thresholds) },
  };
}

/** True once a chain has passed the final threshold — the PreToolUse escalation point. */
export function shouldEscalate(
  state: LoopState,
  sessionId: string,
  tool: string,
  input: unknown,
  thresholds: readonly number[] = DEFAULT_THRESHOLDS,
): Chain | undefined {
  const chain = state[sessionId];
  if (chain === undefined) return undefined;

  const last = thresholds[thresholds.length - 1] ?? Number.POSITIVE_INFINITY;
  if (chain.count < last) return undefined;

  // Only escalate the *same* call. A different call is the model changing approach,
  // which is exactly what the nudges asked for.
  return chain.key.startsWith(`${tool}|${hash(canonicalise(input))}|`) ? chain : undefined;
}

/** Fails loud rather than silently falling back — a mis-set threshold must not read as "off". */
export function validateThresholds(value: unknown): readonly number[] {
  if (value === undefined) return DEFAULT_THRESHOLDS;
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('loopGuard.thresholds must be a non-empty array');
  }
  const seen = new Set<number>();
  for (const entry of value) {
    if (!Number.isInteger(entry) || entry < 2) {
      throw new Error(`loopGuard.thresholds entries must be integers >= 2, got ${JSON.stringify(entry)}`);
    }
    if (seen.has(entry)) throw new Error(`loopGuard.thresholds has a duplicate: ${entry}`);
    seen.add(entry);
  }
  return [...(value as number[])].sort((a, b) => a - b);
}
