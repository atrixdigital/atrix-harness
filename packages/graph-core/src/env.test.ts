import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { analyseEnv, collectEnvDefs, collectEnvReads } from './env.ts';
import { createProgramFor } from './indexer.ts';

let root: string;

const write = (path: string, body: string): void => {
  const full = join(root, path);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, body);
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'atrix-env-'));
  write('tsconfig.json', JSON.stringify({ compilerOptions: { target: 'ESNext', moduleResolution: 'bundler' }, include: ['src'] }));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const analyse = () =>
  analyseEnv(
    collectEnvReads(createProgramFor({ root, include: [], exclude: [], project: 'test' }), root),
    collectEnvDefs(root),
    root,
  );

const kinds = (name: string) => analyse().findings.filter((f) => f.name === name).map((f) => f.kind);

describe('reading', () => {
  test('finds every access form the AST can express', () => {
    // A regex over `process.env.X` misses two of these and matches comments.
    write(
      'src/a.ts',
      `const a = process.env.PLAIN_ACCESS;
const b = process.env['BRACKET_ACCESS'];
const { DESTRUCTURED } = process.env;
const c = Bun.env.BUN_STYLE;
// process.env.IN_A_COMMENT should not count
`,
    );
    const names = new Set(collectEnvReads(createProgramFor({ root, include: [], exclude: [], project: 'test' }), root).map((r) => r.name));

    expect(names).toContain('PLAIN_ACCESS');
    expect(names).toContain('BRACKET_ACCESS');
    expect(names).toContain('DESTRUCTURED');
    expect(names).toContain('BUN_STYLE');
    expect(names).not.toContain('IN_A_COMMENT');
  });

  test('does not match an unrelated object called env', () => {
    write('src/a.ts', 'const config = { env: { NOT_REAL: 1 } };\nconst x = config.env.NOT_REAL;\n');
    expect(collectEnvReads(createProgramFor({ root, include: [], exclude: [], project: 'test' }), root)).toEqual([]);
  });
});

describe('conflicts', () => {
  test('flags the same variable defined twice with DIFFERENT values', () => {
    // The recurring failure: a migration tool loads .env while the app loads .env.local,
    // both succeed, and they were talking to different databases.
    write('src/a.ts', 'export const url = process.env.DATABASE_URL;');
    write('.env', 'DATABASE_URL=postgres://localhost/dev');
    write('.env.local', 'DATABASE_URL=postgres://prod.example.com/live');

    expect(kinds('DATABASE_URL')).toContain('conflicting');
  });

  test('the same value in two files is only a duplicate, not a conflict', () => {
    write('src/a.ts', 'export const x = process.env.SAME;');
    write('.env', 'SAME=identical');
    write('.env.local', 'SAME=identical');

    expect(kinds('SAME')).toContain('duplicate');
    expect(kinds('SAME')).not.toContain('conflicting');
  });
});

describe('noise suppression', () => {
  test('does not report platform-supplied variables as undefined', () => {
    // Reporting CI or VERCEL_ENV as missing is noise that gets the tool ignored.
    write('src/a.ts', 'export const x = process.env.CI ?? process.env.VERCEL_ENV;');
    expect(analyse().findings.filter((f) => f.kind === 'undefined')).toEqual([]);
  });

  test('treats .env.example as documentation of intent', () => {
    write('src/a.ts', 'export const x = process.env.PLANNED;');
    write('.env.example', 'PLANNED=');
    expect(kinds('PLANNED')).not.toContain('undefined');
  });

  test('does not flag keys that are meant to be public', () => {
    // Supabase anon keys ship to the browser by design.
    write('src/a.ts', 'export const k = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;');
    write('.env', 'NEXT_PUBLIC_SUPABASE_ANON_KEY=abc');
    expect(kinds('NEXT_PUBLIC_SUPABASE_ANON_KEY')).not.toContain('client-exposed-secret');
  });

  test('but does flag a real secret behind a public prefix', () => {
    write('src/a.ts', 'export const k = process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY;');
    expect(kinds('NEXT_PUBLIC_STRIPE_SECRET_KEY')).toContain('client-exposed-secret');
  });
});

describe('secrecy', () => {
  test('never carries a value out of the module', () => {
    // A config auditor that leaks credentials into a transcript is worse than the
    // problem it solves.
    write('src/a.ts', 'export const x = process.env.API_TOKEN;');
    write('.env', 'API_TOKEN=sk-live-do-not-print-me');
    write('.env.local', 'API_TOKEN=sk-live-different-value');

    const serialised = JSON.stringify(analyse());
    expect(serialised).not.toContain('do-not-print-me');
    expect(serialised).not.toContain('different-value');
    expect(serialised).toContain('API_TOKEN');
  });

  test('still detects the difference despite never reading the values out', () => {
    write('src/a.ts', 'export const x = process.env.API_TOKEN;');
    write('.env', 'API_TOKEN=one');
    write('.env.local', 'API_TOKEN=two');
    expect(kinds('API_TOKEN')).toContain('conflicting');
  });
});

test('reports variables defined but never read', () => {
  write('src/a.ts', 'export const x = 1;');
  write('.env', 'ORPHAN=value');
  expect(kinds('ORPHAN')).toContain('unused');
});
