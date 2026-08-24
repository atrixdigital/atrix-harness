import { existsSync, readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import ts from 'typescript';

/**
 * The environment graph: which variables the code reads, where they are defined, and
 * where those two sets disagree.
 *
 * This exists because config mismatches are a recurring, expensive failure across these
 * repos — a migration tool reading `.env` while the app runs on `.env.local`, pointed at
 * two different databases, both reporting success. Measured on one live repo: 62 variables
 * read, 51 defined, and `DATABASE_URL` defined in two files at once.
 *
 * SECURITY — values are never read out. Definitions are compared by hash so the tool can
 * say "these differ" without printing a credential. A config auditor that leaks secrets
 * into a transcript is a worse problem than the one it solves.
 */

export interface EnvRead {
  name: string;
  path: string;
  line: number;
  /** True for a prefix the framework ships to the browser bundle. */
  clientExposed: boolean;
}

export interface EnvDef {
  name: string;
  file: string;
  /** Hash only. The value itself never leaves this module. */
  valueHash: string;
  empty: boolean;
}

export interface EnvFinding {
  kind: 'undefined' | 'conflicting' | 'duplicate' | 'unused' | 'client-exposed-secret';
  name: string;
  detail: string;
  /** Where to look. */
  locations: string[];
}

/** Prefixes that mean "this ends up in the browser bundle". */
const CLIENT_PREFIXES = ['NEXT_PUBLIC_', 'VITE_', 'PUBLIC_', 'EXPO_PUBLIC_', 'REACT_APP_'];

/** Substrings that mean a value must never reach a client bundle. */
const SECRET_MARKERS = /(SECRET|PRIVATE|_KEY|PASSWORD|TOKEN|CREDENTIAL|SERVICE_ROLE)/;

/**
 * Keys that contain "KEY" and are *designed* to be public.
 *
 * Supabase anon and publishable keys are meant to ship to the browser — flagging them is
 * a false positive, and a tool that cries wolf gets switched off, taking the true
 * positives with it.
 */
const INTENTIONALLY_PUBLIC = /(ANON_KEY|PUBLISHABLE_KEY|PUBLIC_KEY|CLIENT_KEY|SITE_KEY|MEASUREMENT_ID)$/;

/**
 * Variables the environment supplies, not the repo.
 *
 * Reporting these as "defined nowhere" is noise: the platform sets them.
 */
const AMBIENT = new Set([
  'CI',
  'NODE_ENV',
  'PORT',
  'HOME',
  'PATH',
  'PWD',
  'TZ',
  'USER',
  'SHELL',
  'TERM',
  'VERCEL',
  'VERCEL_ENV',
  'VERCEL_URL',
  'VERCEL_REGION',
  'GITHUB_ACTIONS',
  'RAILWAY_ENVIRONMENT',
  'FLY_APP_NAME',
  'AWS_REGION',
  'LAMBDA_TASK_ROOT',
]);

const isClientExposed = (name: string): boolean => CLIENT_PREFIXES.some((p) => name.startsWith(p));

/**
 * Find environment reads via the AST rather than a regex.
 *
 * A regex over `process.env.X` misses `process.env['X']` and destructuring, and matches
 * the string inside a comment. Since the indexer already builds a Program, using it costs
 * nothing extra and is exact.
 */
export function collectEnvReads(program: ts.Program, root: string): EnvRead[] {
  const reads: EnvRead[] = [];
  const seen = new Set<string>();

  const record = (name: string, source: ts.SourceFile, node: ts.Node): void => {
    if (!/^[A-Z_][A-Z0-9_]*$/.test(name)) return;
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    const path = relative(root, source.fileName);
    const key = `${name}|${path}|${line}`;
    if (seen.has(key)) return;
    seen.add(key);
    reads.push({ name, path, line, clientExposed: isClientExposed(name) });
  };

  /**
   * `process.env`, `Bun.env`, or `import.meta.env`.
   *
   * Matched structurally rather than by `getText()`: synthesized nodes have no source
   * file, and asking one for its text throws.
   */
  const isEnvObject = (node: ts.Node): boolean => {
    if (!ts.isPropertyAccessExpression(node) || node.name.text !== 'env') return false;
    const target = node.expression;
    if (ts.isIdentifier(target)) return target.text === 'process' || target.text === 'Bun';
    // import.meta.env
    return target.kind === ts.SyntaxKind.MetaProperty;
  };

  for (const source of program.getSourceFiles()) {
    if (source.isDeclarationFile || source.fileName.includes('/node_modules/')) continue;

    const visit = (node: ts.Node): void => {
      // process.env.FOO
      if (ts.isPropertyAccessExpression(node) && isEnvObject(node.expression)) {
        record(node.name.text, source, node);
      }
      // process.env['FOO']
      else if (
        ts.isElementAccessExpression(node) &&
        isEnvObject(node.expression) &&
        node.argumentExpression !== undefined &&
        ts.isStringLiteral(node.argumentExpression)
      ) {
        record(node.argumentExpression.text, source, node);
      }
      // const { FOO, BAR } = process.env
      else if (
        ts.isVariableDeclaration(node) &&
        node.initializer !== undefined &&
        isEnvObject(node.initializer) &&
        ts.isObjectBindingPattern(node.name)
      ) {
        for (const element of node.name.elements) {
          const key = element.propertyName ?? element.name;
          if (ts.isIdentifier(key)) record(key.text, source, element);
        }
      }

      ts.forEachChild(node, visit);
    };

    ts.forEachChild(source, visit);
  }

  return reads;
}

/** Files a loader might read, in the order frameworks usually apply them. */
const ENV_FILES = ['.env', '.env.local', '.env.development', '.env.development.local', '.env.production', '.env.production.local'];

export function collectEnvDefs(root: string): EnvDef[] {
  const defs: EnvDef[] = [];

  for (const file of ENV_FILES) {
    const path = join(root, file);
    if (!existsSync(path)) continue;

    for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (line === '' || line.startsWith('#')) continue;

      const eq = line.indexOf('=');
      if (eq <= 0) continue;

      const name = line.slice(0, eq).replace(/^export\s+/, '').trim();
      if (!/^[A-Z_][A-Z0-9_]*$/.test(name)) continue;

      const value = line
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, '');

      // Hash immediately. The plaintext must not survive this function.
      defs.push({ name, file, valueHash: Bun.hash(value).toString(16), empty: value === '' });
    }
  }

  return defs;
}

export interface EnvAnalysis {
  reads: EnvRead[];
  defs: EnvDef[];
  findings: EnvFinding[];
}

/** `.env.example` documents intent; a var listed there is not "undefined by accident". */
function documented(root: string): Set<string> {
  const path = join(root, '.env.example');
  if (!existsSync(path)) return new Set();
  return new Set(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l !== '' && !l.startsWith('#'))
      .map((l) => l.slice(0, l.indexOf('=')).replace(/^export\s+/, '').trim())
      .filter((n) => /^[A-Z_][A-Z0-9_]*$/.test(n)),
  );
}

export function analyseEnv(reads: EnvRead[], defs: EnvDef[], root: string): EnvAnalysis {
  const findings: EnvFinding[] = [];
  const readNames = new Map<string, EnvRead[]>();
  for (const read of reads) readNames.set(read.name, [...(readNames.get(read.name) ?? []), read]);

  const defsByName = new Map<string, EnvDef[]>();
  for (const def of defs) defsByName.set(def.name, [...(defsByName.get(def.name) ?? []), def]);

  const documentedNames = documented(root);

  // Read but never defined — undefined at runtime, and the failure is usually far away.
  for (const [name, sites] of readNames) {
    if (defsByName.has(name) || documentedNames.has(name) || AMBIENT.has(name)) continue;
    findings.push({
      kind: 'undefined',
      name,
      detail: `read in ${sites.length} place(s), defined nowhere and not in .env.example`,
      locations: sites.slice(0, 3).map((s) => `${s.path}:${s.line}`),
    });
  }

  // Defined more than once. Conflicting values are the dangerous case: two tools loading
  // different files silently talk to different systems.
  for (const [name, group] of defsByName) {
    if (group.length < 2) continue;
    const hashes = new Set(group.map((d) => d.valueHash));
    const files = group.map((d) => d.file);

    findings.push(
      hashes.size > 1
        ? {
            kind: 'conflicting',
            name,
            detail: `defined in ${group.length} files with DIFFERENT values — whichever file the running tool loads decides which system it talks to`,
            locations: files,
          }
        : { kind: 'duplicate', name, detail: 'defined more than once with the same value', locations: files },
    );
  }

  // A secret behind a public prefix ships to every browser that loads the page.
  for (const name of new Set([...readNames.keys(), ...defsByName.keys()])) {
    if (isClientExposed(name) && SECRET_MARKERS.test(name) && !INTENTIONALLY_PUBLIC.test(name)) {
      findings.push({
        kind: 'client-exposed-secret',
        name,
        detail: 'a public prefix puts this in the browser bundle, and the name reads like a secret',
        locations: (readNames.get(name) ?? []).slice(0, 2).map((s) => `${s.path}:${s.line}`),
      });
    }
  }

  // Defined but never read. Low severity, but dead config hides the live config.
  for (const [name, group] of defsByName) {
    if (readNames.has(name)) continue;
    findings.push({
      kind: 'unused',
      name,
      detail: 'defined but never read in this repo',
      locations: group.map((d) => d.file),
    });
  }

  const severity: Record<EnvFinding['kind'], number> = {
    'client-exposed-secret': 0,
    conflicting: 1,
    undefined: 2,
    duplicate: 3,
    unused: 4,
  };
  findings.sort((a, b) => severity[a.kind] - severity[b.kind] || a.name.localeCompare(b.name));

  return { reads, defs, findings };
}

/**
 * Persist findings so a session-start hook can surface them without paying for a
 * TypeScript Program — analysis takes seconds, and a hook has a five-second budget.
 */
export function storeEnvFindings(db: import('bun:sqlite').Database, findings: EnvFinding[]): void {
  db.run(`CREATE TABLE IF NOT EXISTS env_findings (
    id INTEGER PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL,
    detail TEXT NOT NULL, locations TEXT NOT NULL
  )`);
  db.run('DELETE FROM env_findings');
  const insert = db.prepare('INSERT INTO env_findings (kind, name, detail, locations) VALUES (?, ?, ?, ?)');
  db.transaction(() => {
    for (const f of findings) insert.run(f.kind, f.name, f.detail, f.locations.join('\n'));
  })();
}

export function loadEnvFindings(db: import('bun:sqlite').Database): EnvFinding[] {
  try {
    return db
      .query<{ kind: string; name: string; detail: string; locations: string }, []>(
        'SELECT kind, name, detail, locations FROM env_findings',
      )
      .all()
      .map((r) => ({ kind: r.kind as EnvFinding['kind'], name: r.name, detail: r.detail, locations: r.locations.split('\n') }));
  } catch {
    // Table absent means the repo has not been indexed since this shipped.
    return [];
  }
}

export const envFileOrder = (): readonly string[] => ENV_FILES;
export const fileLabel = (file: string): string => basename(file);
