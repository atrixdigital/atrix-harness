import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';
import { log } from '../lib/log.ts';

/**
 * Scaffold a consuming repository.
 *
 * Only what genuinely must live inside the repo goes here: the pointer to the
 * harness, repo-specific conventions, and index config. Everything shared stays
 * in the harness so it can be updated centrally.
 */

export function init(harnessRoot: string, projectRoot: string): void {
  if (harnessRoot === projectRoot) {
    log.warn('This is the harness itself — nothing to initialise.');
    return;
  }

  const created: string[] = [];
  const skipped: string[] = [];

  const put = (rel: string, contents: string): void => {
    const file = join(projectRoot, rel);
    if (existsSync(file)) {
      skipped.push(rel);
      return;
    }
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, contents, 'utf8');
    created.push(rel);
  };

  // A relative path is friendlier when the harness sits nearby, but degenerates into
  // `../../../../..` noise once the project lives elsewhere. Fall back to absolute.
  const rel = relative(projectRoot, harnessRoot);
  const harnessRel = rel === '' || rel.split(sep).filter((s) => s === '..').length > 2 ? harnessRoot : rel;

  put(
    '.atrix/config.json',
    `${JSON.stringify(
      {
        harness: { version: '0.1.0', path: harnessRel },
        index: { include: ['src', 'app', 'packages', 'apps'], exclude: ['node_modules', 'dist', '.next'] },
        // Off by default: most Atrix repos are private client work and code
        // chunks must never leave the machine without an explicit decision.
        semantic: { provider: null },
      },
      null,
      2,
    )}\n`,
  );

  put(
    'AGENTS.md',
    `# ${basename(projectRoot)}

## Harness

This repository is operated under the Atrix harness. **Read \`${harnessRel}/AGENTS.md\` first** —
it carries the rules, methodology, recovery policy and skills that apply everywhere.

Repo-specific context below overrides the harness on conventions, never on safety.

## Stack

<!-- Runtime, framework, database, package manager. One line each. -->

## Commands

\`\`\`bash
# install
# dev
# typecheck
# test
\`\`\`

## Conventions

<!-- Only what is specific to THIS repo and not already in the harness rules.
     If you find yourself writing a general rule here, it belongs in the harness:
     run \`atrix learn\` instead. -->

## Gotchas

<!-- Things that have bitten people. Each one should have an incident behind it. -->
`,
  );

  put(
    'CLAUDE.md',
    `# Pointer\n\nRead **[AGENTS.md](./AGENTS.md)**, then \`${harnessRel}/AGENTS.md\`.\n`,
  );

  for (const rel of created) log.ok(`created ${rel}`);
  for (const rel of skipped) log.detail(`kept existing ${rel}`);

  log.blank();
  log.info('Next:');
  log.detail('1. Fill in Stack and Commands in AGENTS.md');
  log.detail('2. Run `atrix index` to build the code graph (phase 3)');
}
