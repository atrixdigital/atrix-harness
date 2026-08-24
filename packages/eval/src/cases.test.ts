import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { loadCases } from './case.ts';
import { prepareWorkspace } from './runner.ts';
import { snapshotProtected, verify } from './verify.ts';

/**
 * Validates the eval cases themselves.
 *
 * The load-bearing assertion is the second one: **a case must fail on its unmodified
 * fixture.** A case that already passes measures nothing — it will report the layer as
 * "load-bearing" whether the layer exists or not, which is worse than having no case,
 * because it manufactures confidence.
 *
 * This is "a guard only guards if the regression actually fails it", applied to the
 * guards themselves.
 */

const root = new URL('../../..', import.meta.url).pathname;
const fixtures = join(root, 'evals/fixtures');
const { cases, issues } = loadCases(join(root, 'evals/cases'));

test('every case file parses', () => {
  expect(issues).toEqual([]);
  expect(cases.length).toBeGreaterThan(0);
});

describe('case hygiene', () => {
  test('each names a layer that exists in core/', () => {
    // A case measuring a deleted rule silently stops measuring anything.
    const names = new Set<string>();
    for (const pattern of ['core/rules/*.md', 'core/methodology/*.md', 'core/skills/*/*/SKILL.md']) {
      for (const file of new Bun.Glob(pattern).scanSync({ cwd: root })) {
        const name = /^name:\s*(.+)$/m.exec(readFileSync(join(root, file), 'utf8'))?.[1]?.trim();
        if (name !== undefined) names.add(name);
      }
    }

    for (const evalCase of cases) {
      expect(names, `${evalCase.name} measures "${evalCase.measures}"`).toContain(evalCase.measures);
    }
  });

  test('a fixture that ships assertions protects them', () => {
    // The reward hack this defends against is editing a test to make it pass. It only
    // applies where the fixture *has* a pre-existing test — a case whose probes are
    // written inline by the check has nothing to protect, and demanding otherwise
    // would be cargo-culting the rule rather than applying it.
    for (const evalCase of cases) {
      const shipped = [
        ...new Bun.Glob('**/*.test.ts').scanSync({ cwd: join(fixtures, evalCase.workspace) }),
        ...new Bun.Glob('**/*.spec.ts').scanSync({ cwd: join(fixtures, evalCase.workspace) }),
      ];
      if (shipped.length === 0) continue;

      expect(
        evalCase.integrity.unchanged.length,
        `${evalCase.name} ships ${shipped.join(', ')} but protects nothing — the agent can edit the test to pass`,
      ).toBeGreaterThan(0);
    }
  });

  test('no prompt names the layer it measures', () => {
    // A prompt that says "remember tenant scoping" tests instruction-following, not
    // whether the harness layer changed the agent's default behaviour.
    for (const evalCase of cases) {
      const words = evalCase.measures.split('-').filter((w) => w.length > 4);
      for (const word of words) {
        expect(evalCase.prompt.toLowerCase(), `${evalCase.name} prompt leaks "${word}"`).not.toContain(word);
      }
    }
  });
});

describe('every case fails on its unmodified fixture', () => {
  test.each(cases.map((c) => [c.name, c] as const))('%s', async (_name, evalCase) => {
    const workspace = prepareWorkspace(join(fixtures, evalCase.workspace), evalCase.name, 'with', 999);
    try {
      const before = snapshotProtected(workspace, evalCase.integrity.unchanged);
      const verdict = await verify(workspace, evalCase, before);

      // If this passes, the case is vacuous: it would credit the layer for work the
      // fixture already does.
      expect(verdict.passed, `${evalCase.name} already passes — it measures nothing`).toBe(false);

      // And the failure must be a real check failing, not an integrity violation —
      // nothing has touched the workspace yet.
      expect(verdict.violations).toEqual([]);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  }, 60_000);
});
