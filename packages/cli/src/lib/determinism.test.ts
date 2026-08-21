import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { build } from '../commands/build.ts';
import { findHarnessRoot } from './paths.ts';

const root = findHarnessRoot(import.meta.dir);

function fingerprint(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (d: string): void => {
    for (const entry of readdirSync(d).sort()) {
      const full = join(d, entry);
      if (statSync(full).isDirectory()) walk(full);
      else out.set(full.slice(dir.length), Bun.hash(readFileSync(full)).toString(16));
    }
  };
  walk(dir);
  return out;
}

/**
 * Cache hits require a byte-identical prefix, so generated output must be reproducible.
 * A timestamp, an unsorted map iteration or a randomised id anywhere in the bundle costs a
 * full uncached prefix re-read on every single turn — see core/rules/cache-shape.md.
 */
test('two consecutive builds are byte-identical', () => {
  const adapters = join(root, 'adapters');

  build(root);
  const first = fingerprint(adapters);

  build(root);
  const second = fingerprint(adapters);

  expect(second.size).toBe(first.size);

  const drifted = [...first.entries()].filter(([path, hash]) => second.get(path) !== hash).map(([path]) => path);
  expect(drifted).toEqual([]);
});
