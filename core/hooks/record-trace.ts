#!/usr/bin/env bun
/**
 * PostToolUse trace recorder — the observability half of the learning loop.
 *
 * Until now the loop only fired when a human remembered to run `/learn`, which means it
 * caught the failures people noticed and missed the ones they absorbed. Observability-driven
 * harness evolution reports 5–15% gains from mining traces instead of memory
 * (arXiv 2604.25850); `atrix observe` is what reads this file.
 *
 * PRIVACY — this file is written into the working repo and must never become a keystroke
 * log. It records a normalised *shape* of what happened, never contents:
 *
 *   - the tool name, and for a shell call only the program invoked (`psql`, not the query)
 *   - an error signature with paths, hostnames, numbers, quoted strings and hex stripped
 *   - the date, not the time
 *
 * No file contents, no arguments, no output, no secrets. `.atrix/` is gitignored by
 * `atrix init`, so it stays local even so.
 */

import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { observe, validateThresholds } from './lib/loop-guard.ts';
import { configuredThresholds, loadState, saveState } from './lib/loop-state.ts';
import { projectOf, stateDir, workspaceRoot } from './lib/project.ts';

interface Payload {
  session_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown> & { command?: string };
  tool_response?: unknown;
}

export interface TraceRecord {
  date: string;
  tool: string;
  ok: boolean;
  /** Which repo in the workspace. Absent means the workspace itself. */
  project?: string;
  /** For Bash, the program invoked. Never the arguments. */
  program?: string;
  /** Normalised error text, safe to aggregate across runs. */
  signature?: string;
}

/**
 * The program a shell command actually runs.
 *
 * Naively taking the first word attributes `cd projects/playo && psql -c '…'` to `cd`,
 * which is both wrong and useless — every compound command in a workspace starts that
 * way, so every failure would cluster under one meaningless label.
 *
 * So: split on shell separators and take the first segment whose leading word is a real
 * command rather than navigation or a wrapper.
 */
const NAVIGATION = new Set(['cd', 'pushd', 'popd', 'source', '.', 'export', 'set']);
const WRAPPERS = new Set(['sudo', 'time', 'env', 'nohup', 'xargs', 'npx', 'bunx', 'pnpm', 'dlx']);

function leadingWord(segment: string): string | undefined {
  const words = segment
    .trim()
    .split(/\s+/)
    .filter((w) => w !== '' && !/^[A-Z_][A-Z0-9_]*=/.test(w));

  for (const word of words) {
    if (WRAPPERS.has(word)) continue;
    const program = word.split('/').pop();
    return program === undefined || program === '' ? undefined : program;
  }
  return undefined;
}

export function programOf(command: string): string | undefined {
  // Split on && || ; and | — not inside quotes, but a heuristic is fine here: a
  // misattributed program degrades a label, it does not break anything.
  const segments = command.split(/\s*(?:&&|\|\||;|\|)\s*/);

  let fallback: string | undefined;
  for (const segment of segments) {
    const word = leadingWord(segment);
    if (word === undefined) continue;
    fallback ??= word;
    if (!NAVIGATION.has(word)) return word;
  }

  // Everything was navigation — `cd somewhere` on its own is a legitimate answer.
  return fallback;
}

/**
 * Reduce an error to something that aggregates.
 *
 * Two runs of the same failure differ by path, pid, port and line number. Stripping those
 * is what turns 40 unique strings into one cluster with a count of 40 — which is the whole
 * point, and also incidentally removes most of what could be sensitive.
 */
export function signatureOf(text: string): string {
  return text
    .split('\n')
    .find((line) => line.trim() !== '')
    ?.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '<str>')
    .replace(/\/(?:[\w.@-]+\/)+[\w.@-]+/g, '<path>')
    // Hostnames: three-plus labels, or two labels ending in a common TLD. Deliberately
    // not "anything with a dot" — that would eat `package.json` and `db.ts` and make
    // signatures useless for clustering.
    .replace(/\b[a-z0-9-]+(?:\.[a-z0-9-]+){2,}\b/gi, '<host>')
    .replace(/\b[a-z0-9-]+\.(com|net|org|io|dev|ai|co|sh|app|cloud|internal|local)\b/gi, '<host>')
    .replace(/\b0x[0-9a-f]+\b/gi, '<hex>')
    .replace(/\b\d+\b/g, '<n>')
    .trim()
    .slice(0, 160) ?? '';
}

/** Best-effort failure detection across the shapes different tools return. */
export function failedFrom(response: unknown): { failed: boolean; text: string } {
  if (typeof response === 'string') {
    return { failed: /\b(error|failed|exception|not found|refused)\b/i.test(response), text: response };
  }
  if (response !== null && typeof response === 'object') {
    const record = response as Record<string, unknown>;
    const flagged = record['is_error'] === true || (typeof record['exit_code'] === 'number' && record['exit_code'] !== 0);
    const text = [record['stderr'], record['error'], record['content'], record['stdout']]
      .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
      .join('\n');
    if (flagged) return { failed: true, text };
    return { failed: /\b(error|failed|exception)\b/i.test(text), text };
  }
  return { failed: false, text: '' };
}

export function toRecord(payload: Payload, today: string): TraceRecord | undefined {
  const tool = payload.tool_name;
  if (tool === undefined || tool === '') return undefined;

  const { failed, text } = failedFrom(payload.tool_response);

  // Successes are recorded as counts only — they are useful as a denominator and
  // uninteresting individually.
  const record: TraceRecord = { date: today, tool, ok: !failed };

  const command = payload.tool_input?.command;
  if (typeof command === 'string') {
    const program = programOf(command);
    if (program !== undefined) record.program = program;
  }

  if (failed) {
    const signature = signatureOf(text);
    if (signature !== '') record.signature = signature;
  }

  return record;
}

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of Bun.stdin.stream()) chunks.push(chunk);
  return new TextDecoder().decode(Buffer.concat(chunks));
}

async function runAsHook(): Promise<void> {
  const raw = await readStdin();
  if (raw.trim() === '') return;

  let payload: Payload;
  try {
    payload = JSON.parse(raw) as Payload;
  } catch {
    // Malformed payload: nothing useful to record, and a hook must never
    // interfere with a tool call it failed to understand.
    return;
  }

  const record = toRecord(payload, new Date().toISOString().slice(0, 10));
  if (record === undefined) return;

  // Hooks run at the workspace root, so the project comes from the payload rather than
  // the working directory. Without this, twenty repos share one trace and every
  // recurrence count is meaningless.
  const workspace = workspaceRoot() ?? process.cwd();
  const project = projectOf(payload, workspace);
  if (project !== undefined) record.project = project;

  const dir = stateDir(workspace, project);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  appendFileSync(join(dir, 'trace.jsonl'), `${JSON.stringify(record)}\n`, 'utf8');

  // Loop detection rides the same payload rather than spawning a second hook process
  // per tool call — this runs on every single one, so the process cost is the design
  // constraint, not code tidiness.
  const sessionId = payload.session_id;
  if (sessionId === undefined) return;

  const { text } = failedFrom(payload.tool_response);
  // The redaction normaliser doubles as the volatile-metadata stripper: two runs of the
  // same operation differ by path, pid and duration, and those must not read as progress.
  const resultSignature = signatureOf(text);

  const { state, nudge } = observe(
    loadState(dir),
    { sessionId, tool: record.tool, input: payload.tool_input ?? {}, resultSignature, now: Date.now() },
    validateThresholds(configuredThresholds(workspace)),
  );
  saveState(dir, state);

  if (nudge !== undefined) {
    console.log(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: nudge.message },
      }),
    );
  }
}

if (import.meta.main) await runAsHook();
