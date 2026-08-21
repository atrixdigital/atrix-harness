import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { callees, callers, context, impact, indexRepo, open, search } from './index.ts';

/**
 * Indexes a real (tiny) TypeScript project on disk. Mocking the compiler API would
 * test the mock — the whole value of using the real checker is cross-file resolution,
 * which only shows up when it actually resolves.
 */

let root: string;
let db: ReturnType<typeof open>;

const write = (path: string, body: string): void => {
  const full = join(root, path);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, body);
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'atrix-graph-'));

  write('tsconfig.json', JSON.stringify({ compilerOptions: { target: 'ESNext', module: 'ESNext', moduleResolution: 'bundler', strict: true }, include: ['src'] }));
  write('src/money.ts', `export function toMinorUnits(amount: number): number {\n  return Math.round(amount * 100);\n}\n\nexport function unused(): void {}\n`);
  write('src/booking.ts', `import { toMinorUnits } from './money.ts';\n\nexport interface Booking {\n  total: number;\n}\n\nexport function priceBooking(b: Booking): number {\n  return toMinorUnits(b.total);\n}\n`);
  write('src/api.ts', `import { priceBooking, type Booking } from './booking.ts';\n\nexport function handler(b: Booking): number {\n  return priceBooking(b);\n}\n`);

  db = open(join(root, 'graph.db'));
  indexRepo(db, { root, include: [], exclude: [] });
});

afterEach(() => {
  db.close();
  rmSync(root, { recursive: true, force: true });
});

const id = (name: string): number => {
  const hit = search(db, name).find((s) => s.name === name);
  if (hit === undefined) throw new Error(`no symbol ${name}`);
  return hit.id;
};

describe('indexing', () => {
  test('finds exported declarations', () => {
    const hit = search(db, 'toMinorUnits').find((s) => s.name === 'toMinorUnits');
    expect(hit).toBeDefined();
    expect(hit?.kind).toBe('function');
    expect(hit?.exported).toBe(true);
    expect(hit?.path).toBe('src/money.ts');
  });

  test('gives every file a module symbol so top-level code has an owner', () => {
    expect(search(db, 'api.ts').some((s) => s.kind === 'module')).toBe(true);
  });

  test('does not index trivial value constants', () => {
    // Indexing every `const x = 1` buries real symbols; only behaviour-bearing ones count.
    write('src/config.ts', 'export const RETRIES = 3;\n');
    expect(search(db, 'RETRIES')).toHaveLength(0);
  });
});

describe('resolution', () => {
  test('resolves a call across files', () => {
    // This is what the compiler API buys over heuristic parsing.
    const names = callers(db, id('toMinorUnits')).map((c) => c.name);
    expect(names).toContain('priceBooking');
  });

  test('records what a symbol reaches', () => {
    expect(callees(db, id('priceBooking')).map((c) => c.name)).toContain('toMinorUnits');
  });

  test('records import edges', () => {
    expect(callers(db, id('toMinorUnits')).some((c) => c.edge === 'imports')).toBe(true);
  });

  test('records type references', () => {
    expect(callers(db, id('Booking')).some((c) => c.edge === 'references')).toBe(true);
  });
});

describe('impact', () => {
  test('follows the chain transitively', () => {
    // handler → priceBooking → toMinorUnits, so changing toMinorUnits reaches handler.
    const result = impact(db, id('toMinorUnits'), 3);
    const names = result?.nodes.map((n) => n.name) ?? [];
    expect(names).toContain('priceBooking');
    expect(names).toContain('handler');
    expect(result?.nodes.find((n) => n.name === 'priceBooking')?.depth).toBe(1);
    expect(result?.nodes.find((n) => n.name === 'handler')?.depth).toBe(2);
  });

  test('respects the depth limit', () => {
    const names = impact(db, id('toMinorUnits'), 1)?.nodes.map((n) => n.name) ?? [];
    expect(names).toContain('priceBooking');
    expect(names).not.toContain('handler');
  });

  test('reports nothing for a symbol with no dependents', () => {
    expect(impact(db, id('unused'))?.nodes).toHaveLength(0);
  });

  test('drops the module row when a named dependent from the same file is present', () => {
    const nodes = impact(db, id('toMinorUnits'), 3)?.nodes ?? [];
    const bookingRows = nodes.filter((n) => n.path === 'src/booking.ts');
    expect(bookingRows.every((n) => n.kind !== 'module')).toBe(true);
  });
});

describe('search ranking', () => {
  test('puts the exact match first', () => {
    write('src/extra.ts', 'export function toMinorUnitsHelper(): void {}\n');
    indexRepo(db, { root, include: [], exclude: [] });
    expect(search(db, 'toMinorUnits')[0]?.name).toBe('toMinorUnits');
  });
});

test('context answers callers, callees and siblings in one call', () => {
  const ctx = context(db, id('priceBooking'));
  expect(ctx?.callers.map((c) => c.name)).toContain('handler');
  expect(ctx?.callees.map((c) => c.name)).toContain('toMinorUnits');
  expect(ctx?.siblings.map((s) => s.name)).toContain('Booking');
});
