import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

/**
 * Which project a tool call touched.
 *
 * Hooks run with the working directory at the *workspace* root, because that is where the
 * developer launched their agent. So `process.cwd()` identifies the workspace, never the
 * project — and a trace keyed on cwd would mix twenty repos into one undifferentiated
 * stream, making every recurrence count meaningless.
 *
 * The tool payload does carry the answer: a file path, or a `cd` in a shell command.
 */

const PROJECTS = 'projects';

/** Walk up to the workspace: the directory holding both AGENTS.md and core/rules. */
export function workspaceRoot(start: string = process.cwd()): string | undefined {
  const fromEnv = process.env.ATRIX_HOME;
  if (fromEnv !== undefined && existsSync(join(fromEnv, 'core', 'rules'))) return fromEnv;

  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, 'AGENTS.md')) && existsSync(join(dir, 'core', 'rules'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

function fromPath(workspace: string, candidate: string): string | undefined {
  const absolute = isAbsolute(candidate) ? candidate : join(workspace, candidate);
  const rel = relative(workspace, resolve(absolute));
  if (rel.startsWith('..')) return undefined;

  const segments = rel.split(sep);
  return segments[0] === PROJECTS && segments[1] !== undefined && segments[1] !== '' ? segments[1] : undefined;
}

/** Paths a tool payload might carry, in the order they identify the target. */
const PATH_FIELDS = ['file_path', 'path', 'notebook_path', 'cwd'];

export interface PayloadLike {
  tool_input?: Record<string, unknown> | undefined;
}

/**
 * Resolve the project, or undefined for work on the workspace itself.
 *
 * Undefined is a real answer, not a failure: editing a rule, or running a workspace-wide
 * command, genuinely belongs to no project.
 */
export function projectOf(payload: PayloadLike, workspace: string | undefined): string | undefined {
  if (workspace === undefined) return undefined;
  const input = payload.tool_input;
  if (input === undefined) return undefined;

  for (const field of PATH_FIELDS) {
    const value = input[field];
    if (typeof value === 'string' && value.trim() !== '') {
      const project = fromPath(workspace, value);
      if (project !== undefined) return project;
    }
  }

  // A shell command usually names its target: `cd projects/playo-web && bun test`,
  // or a path argument. Take the first projects/<name> the string mentions.
  const command = input['command'];
  if (typeof command === 'string') {
    const match = /(?:^|[\s"'`=])(?:\.\/)?projects\/([A-Za-z0-9._-]+)/.exec(command);
    if (match?.[1] !== undefined) return match[1];
  }

  // ATRIX_PROJECT is the explicit override for a session that never leaves the root.
  const named = process.env.ATRIX_PROJECT;
  return named !== undefined && named !== '' ? named : undefined;
}

/** Where per-developer state for this scope lives. Always inside the gitignored .atrix. */
export function stateDir(workspace: string, project: string | undefined): string {
  return project === undefined ? join(workspace, '.atrix') : join(workspace, '.atrix', 'projects', project);
}
