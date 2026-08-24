#!/usr/bin/env bun
/**
 * PreToolUse guard for shell commands.
 *
 * Enforcement, not aspiration: the `safety` rule says destructive and outward-facing
 * commands need a human yes, and a rule that only lives in a prompt is a rule that gets
 * skipped under pressure. This turns it into a stop.
 *
 * Silent on success — it prints nothing for the overwhelming majority of commands.
 *
 * Reads a PreToolUse payload on stdin, emits a permission decision on stdout.
 */

import { shouldEscalate, validateThresholds } from './lib/loop-guard.ts';
import { configuredThresholds, loadState } from './lib/loop-state.ts';

interface Payload {
  session_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown> & { command?: string };
}

interface Rule {
  /** Why this is dangerous — shown to the human making the call. */
  reason: string;
  test: RegExp;
}

/**
 * `ask` escalates to the human. Nothing here is auto-denied: a blanket block just
 * teaches people to disable the hook, and some of these are legitimately needed.
 */
const RULES: Rule[] = [
  { reason: 'recursive force delete', test: /\brm\s+(-[a-zA-Z]*\s+)*-[a-zA-Z]*[rR][a-zA-Z]*f|\brm\s+-[a-zA-Z]*f[a-zA-Z]*[rR]/ },
  { reason: 'discards uncommitted work irreversibly', test: /\bgit\s+reset\s+--hard\b/ },
  { reason: 'rewrites history on a remote others may have pulled', test: /\bgit\s+push\b.*(--force\b|(?<!-)-f\b)/ },
  { reason: 'deletes a remote branch', test: /\bgit\s+push\b.*(--delete\b|\s:\S)/ },
  { reason: 'drops or truncates a database object', test: /\b(DROP\s+(TABLE|DATABASE|SCHEMA|COLUMN)|TRUNCATE)\b/i },
  { reason: 'destructive migration — resets the database', test: /\b(migrate\s+(dev|reset)|db\s+push\s+--accept-data-loss|prisma\s+migrate\s+reset)\b/ },
  { reason: 'deletes a live Kubernetes resource', test: /\bkubectl\s+delete\b/ },
  { reason: 'targets a production environment', test: /(?<![a-z0-9])prod(uction)?(?![a-z0-9])/i },
  { reason: 'publishes a package or release', test: /\b(npm|bun|yarn|pnpm)\s+publish\b|\bgh\s+release\s+create\b/ },
  { reason: 'deploys', test: /\b(vercel|eas\s+submit|eas\s+build|fly\s+deploy|gcloud\s+run\s+deploy)\b(?!.*--help)/ },
];

/** A command may be several statements; the whole string is checked, which is deliberate. */
export function evaluate(command: string): string[] {
  return RULES.filter((rule) => rule.test.test(command)).map((rule) => rule.reason);
}

/**
 * The escalation end of loop detection.
 *
 * PostToolUse can only advise — it cannot block, which is correct for the first
 * reminders. But a chain that has passed the final threshold and is about to repeat the
 * *same* call again has ignored every advisory, and at that point the decision belongs
 * to a human rather than to the model that is stuck.
 *
 * Still `ask`, never `deny`: a legitimately repeated call must be one keystroke away.
 */
function loopEscalation(payload: Payload): string | undefined {
  const sessionId = payload.session_id;
  const tool = payload.tool_name;
  if (sessionId === undefined || tool === undefined) return undefined;

  const chain = shouldEscalate(
    loadState(process.cwd()),
    sessionId,
    tool,
    payload.tool_input ?? {},
    validateThresholds(configuredThresholds(process.cwd())),
  );
  if (chain === undefined) return undefined;

  return (
    `atrix loop guard — \`${chain.preview}\` has already run ${chain.count} times in a row with an ` +
    `identical result, and this is the same call again. Bounded recovery ran out several attempts ago. ` +
    `Approve only if you know something changed; otherwise tell the agent to stop and report.`
  );
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
    // Never block work because the guard could not parse its own input.
    return;
  }

  const ask = (reason: string): void => {
    console.log(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: reason },
      }),
    );
  };

  // Loop escalation applies to every tool, not just Bash — an agent can loop on Read,
  // Edit or a graph query just as easily as on a shell command.
  const looping = loopEscalation(payload);
  if (looping !== undefined) {
    ask(looping);
    return;
  }

  const command = payload.tool_input?.command;
  if (payload.tool_name !== 'Bash' || typeof command !== 'string') return;

  const reasons = evaluate(command).join('; ');
  if (reasons === '') return;

  ask(`atrix safety guard — ${reasons}. State what will be lost, then get an explicit yes.`);
}

// Importable for tests; reads stdin only when executed as a hook.
if (import.meta.main) await runAsHook();
