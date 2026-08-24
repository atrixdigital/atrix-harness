import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { findHarnessRoot } from './paths.ts';

/**
 * Structural rules that are otherwise true only by discipline.
 *
 * Each of these holds today because nobody has broken it yet. That is not a guarantee —
 * it is the state immediately before someone adds an import at six in the evening, and
 * two of these fail at *runtime in someone else's session*, which is the worst place to
 * discover a layering mistake.
 */

const root = findHarnessRoot(import.meta.dir);

function sources(glob: string): { path: string; text: string }[] {
  return [...new Bun.Glob(glob).scanSync({ cwd: root })]
    .filter((p) => !p.endsWith('.test.ts') && !p.includes('node_modules'))
    .map((p) => ({ path: p, text: readFileSync(join(root, p), 'utf8') }));
}

/** Import specifiers, ignoring type-only noise. */
const importsOf = (text: string): string[] =>
  [...text.matchAll(/^\s*import\s+(?:type\s+)?[\s\S]*?from\s+'([^']+)'/gm)].map((m) => m[1] ?? '');

describe('hooks must stay self-contained', () => {
  const hooks = sources('core/hooks/**/*.ts');

  test('there are hooks to check', () => {
    expect(hooks.length).toBeGreaterThan(3);
  });

  test.each(hooks.map((h) => [h.path, h] as const))('%s imports nothing from packages/', (_path, hook) => {
    // core/hooks/ is COPIED into the Claude plugin. The plugin receives that directory
    // and nothing else, so an import from packages/ resolves at author time, passes
    // typecheck, ships — and throws in a user's session with a module-not-found.
    for (const specifier of importsOf(hook.text)) {
      expect(specifier, `${hook.path} imports ${specifier}`).not.toMatch(/packages\/|@atrix\/(graph|eval|cli)/);
    }
  });

  test.each(hooks.map((h) => [h.path, h] as const))('%s imports only node:, bun: or a sibling', (_path, hook) => {
    for (const specifier of importsOf(hook.text)) {
      const allowed = specifier.startsWith('node:') || specifier.startsWith('bun:') || specifier.startsWith('./');
      expect(allowed, `${hook.path} imports ${specifier}`).toBe(true);
    }
  });
});

describe('dependency direction', () => {
  test.each(['packages/graph-core/**/*.ts', 'packages/graph-mcp/**/*.ts', 'packages/eval/**/*.ts'])(
    '%s does not depend on the CLI',
    (glob) => {
      // The CLI composes these; a dependency back would make the graph unusable on its
      // own and turn any CLI change into a change to the indexer.
      for (const source of sources(glob)) {
        for (const specifier of importsOf(source.text)) {
          expect(specifier, `${source.path} imports ${specifier}`).not.toMatch(/cli\//);
        }
      }
    },
  );

  test('nothing tunnels out of a package with a deep relative path', () => {
    // `../../../../core/hooks/lib/trace.ts` is unsearchable and breaks silently when a
    // directory moves. Cross-boundary imports go through a named tsconfig path so the
    // coupling is explicit and greppable.
    for (const source of sources('packages/**/*.ts')) {
      for (const specifier of importsOf(source.text)) {
        expect(specifier, `${source.path} imports ${specifier}`).not.toMatch(/^(\.\.\/){3,}/);
      }
    }
  });
});

describe('the generated adapters carry no source dependency', () => {
  test('adapters/ contains no import from packages/', () => {
    // What ships must run standalone in whatever agent installs it.
    for (const source of sources('adapters/**/*.ts')) {
      for (const specifier of importsOf(source.text)) {
        expect(specifier, `${relative(root, source.path)} imports ${specifier}`).not.toMatch(/packages\//);
      }
    }
  });
});

describe('we follow our own failure-design rule', () => {
  /**
   * `core/rules/failure-design.md`: "If a failure is genuinely acceptable, say so in a
   * comment with the reason."
   *
   * We shipped 24 bare catch blocks with 17 unexplained before this test existed. A rule
   * the harness does not itself follow is one nobody else will either — and each of those
   * is a decision to lose information that a future reader cannot audit.
   */
  const CATCH = /\}\s*catch\s*(?:\(\s*\w+\s*\))?\s*\{\s*$/;

  /** Handles the error rather than discarding it, so no justification is owed. */
  const HANDLES_ERROR = /catch\s*\(\s*\w+\s*\)/;

  test('every swallowed error explains why', () => {
    const unexplained: string[] = [];

    for (const source of [...sources('packages/**/*.ts'), ...sources('core/hooks/**/*.ts')]) {
      const lines = source.text.split('\n');
      for (const [i, line] of lines.entries()) {
        if (!CATCH.test(line) || HANDLES_ERROR.test(line)) continue;

        let j = i + 1;
        while (j < lines.length && (lines[j] ?? '').trim() === '') j += 1;
        const next = (lines[j] ?? '').trim();

        if (!next.startsWith('//') && !next.startsWith('/*')) {
          unexplained.push(`${source.path}:${i + 1}`);
        }
      }
    }

    expect(unexplained).toEqual([]);
  });
});
