import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LoopState } from './loop-guard.ts';

/**
 * Chain state on disk.
 *
 * dsh keeps this in a WeakMap because its guard runs inside the agent process. Ours runs
 * as a hook — a fresh process per tool call — so the chain has nowhere to live but a file.
 *
 * Consequences accepted deliberately: a corrupt or concurrently-written file resets the
 * chain rather than failing the tool call. This is a heuristic nudge, not a logged
 * invariant; losing a chain costs one late reminder, and blocking a tool call because a
 * JSON parse failed would be an absurd trade.
 */

const FILE = 'loop-state.json';

export function loadState(dir: string): LoopState {
  const path = join(dir, FILE);
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    return parsed !== null && typeof parsed === 'object' ? (parsed as LoopState) : {};
  } catch {
    // A corrupt or half-written state file resets the chain. This is a heuristic
    // nudge, not a logged invariant — losing a chain costs one late reminder, where
    // failing here would cost the tool call.
    return {};
  }
}

export function saveState(dir: string, state: LoopState): void {
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, FILE), JSON.stringify(state), 'utf8');
  } catch {
    // Never let bookkeeping break the session.
  }
}

/** Reads `loopGuard.thresholds` from the project config, if present. */
export function configuredThresholds(workspaceRoot: string): unknown {
  const path = join(workspaceRoot, '.atrix', 'config.json');
  if (!existsSync(path)) return undefined;
  try {
    const config = JSON.parse(readFileSync(path, 'utf8')) as { loopGuard?: { thresholds?: unknown } };
    return config.loopGuard?.thresholds;
  } catch {
    // Unreadable config means no configured thresholds, so the defaults apply.
    // Undefined says exactly that; throwing would fail a tool call over a typo.
    return undefined;
  }
}
