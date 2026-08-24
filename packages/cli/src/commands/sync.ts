import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from './build.ts';
import { AtrixError, bold, dim, log } from '../lib/log.ts';
import { commitsBehind, describe, harnessVersion } from '../lib/version.ts';

/**
 * The propagate step of the learning loop.
 *
 * A merged rule that never reaches a working checkout has not been learned by anything.
 * `sync` pulls the harness, rebuilds the adapters, and — the part that matters — says
 * *what changed*, because an update nobody reads is an update nobody applies.
 *
 * It refuses to touch a dirty checkout. Silently stashing someone's in-progress rule
 * edit to fetch a different one is not a trade this tool gets to make.
 */

interface GitResult {
  ok: boolean;
  out: string;
}

function git(cwd: string, args: string[]): GitResult {
  const proc = Bun.spawnSync(['git', ...args], { cwd, stdout: 'pipe', stderr: 'pipe' });
  return {
    ok: proc.exitCode === 0,
    out: `${proc.stdout.toString()}${proc.stderr.toString()}`.trim(),
  };
}

/** New entries in the learning changelog — what the harness actually learned. */
function learnedSince(harnessRoot: string, sinceCommit: string): string[] {
  const path = 'learning/CHANGELOG.md';
  const before = git(harnessRoot, ['show', `${sinceCommit}:${path}`]);
  if (!before.ok) return [];

  const previous = new Set(before.out.split('\n').filter((l) => l.startsWith('|')));
  const current = readFileSync(join(harnessRoot, path), 'utf8').split('\n');

  return current
    .filter((line) => line.startsWith('|') && !previous.has(line) && !line.includes('---'))
    .map((line) => {
      const cells = line.split('|').map((c) => c.trim());
      return `${cells[1] ?? ''}  ${cells[3] ?? ''}  ${(cells[4] ?? '').slice(0, 90)}`;
    })
    .filter((l) => l.trim() !== '' && !l.startsWith('Date'));
}

export function sync(harnessRoot: string, projectRoot: string, args: string[]): boolean {
  const before = harnessVersion(harnessRoot);

  if (before.dirty && !args.includes('--force')) {
    throw new AtrixError(
      'The harness checkout has uncommitted changes.',
      'Commit or stash them first. Pass --force only if you are certain they can be rebased.',
    );
  }

  if (!args.includes('--offline')) {
    log.step('fetching');
    const pull = git(harnessRoot, ['pull', '--ff-only']);
    if (!pull.ok) {
      throw new AtrixError(
        'Could not fast-forward the harness.',
        `${pull.out}\n\nResolve by hand in ${harnessRoot} — sync never rewrites history.`,
      );
    }
  }

  const after = harnessVersion(harnessRoot);
  const moved = before.commit !== after.commit;

  if (moved && before.commit !== undefined) {
    const learned = learnedSince(harnessRoot, before.commit);
    log.ok(`updated ${describe(before)} → ${describe(after)}`);
    if (learned.length > 0) {
      log.blank();
      log.info(bold('The harness learned:'));
      for (const entry of learned) log.detail(entry);
      log.blank();
    }
  } else {
    log.ok(`already current — ${describe(after)}`);
  }

  // Adapters are generated, so a pull without a rebuild leaves consumers on stale
  // packaging. Rebuilding here is the difference between "pulled" and "applied".
  build(harnessRoot);

  // Stamp the consuming repo so doctor can report drift from now on.
  const configPath = join(projectRoot, '.atrix', 'config.json');
  if (harnessRoot !== projectRoot && existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
      config['harness'] = {
        ...(config['harness'] as Record<string, unknown>),
        version: after.version,
        commit: after.commit ?? null,
      };
      writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
    } catch {
      // Warned rather than swallowed: the sync itself succeeded, but drift reporting
      // will now be wrong, and the user needs to know which of the two happened.
      log.warn('.atrix/config.json is malformed — version not stamped');
    }
  }

  if (moved) {
    log.blank();
    log.detail(dim('Rules changed. Reindex if the harness touched the graph: atrix index'));
  }

  return true;
}

/** Reported by `doctor`: how far this repo is behind the harness it was initialised against. */
export function driftReport(harnessRoot: string, projectRoot: string): string | undefined {
  const configPath = join(projectRoot, '.atrix', 'config.json');
  if (harnessRoot === projectRoot || !existsSync(configPath)) return undefined;

  let recorded: string | undefined;
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as { harness?: { commit?: string | null } };
    recorded = config.harness?.commit ?? undefined;
  } catch {
    // No readable config means no recorded baseline, so drift is unknowable.
    // Undefined says exactly that; zero would claim the repo is current.
    return undefined;
  }

  const behind = commitsBehind(harnessRoot, recorded);
  if (behind === undefined || behind === 0) return undefined;
  return `${behind} harness commit(s) behind — run \`atrix sync\``;
}
