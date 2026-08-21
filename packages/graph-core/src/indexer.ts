import type { Database } from 'bun:sqlite';
import { statSync } from 'node:fs';
import { basename, dirname, relative } from 'node:path';
import ts from 'typescript';
import type { EdgeKind, SymbolKind } from './schema.ts';

/**
 * Indexes TypeScript using the TypeScript compiler API rather than tree-sitter.
 *
 * The trade is deliberate. Tree-sitter buys breadth — 150+ languages — at the cost of
 * heuristic resolution: it sees `foo()` but cannot always tell you *which* `foo`.
 * The compiler API resolves through imports, re-exports, generics and overloads
 * because it is the same resolver the typechecker uses. For a codebase that is
 * ~99% TypeScript, correct beats broad, and it costs no native dependency.
 *
 * The seam for other languages is `indexRepo`'s file discovery plus a second
 * extractor writing the same tables — nothing above this layer needs to change.
 */

export interface IndexResult {
  files: number;
  symbols: number;
  edges: number;
  durationMs: number;
  skipped: string[];
}

interface Ctx {
  db: Database;
  root: string;
  checker: ts.TypeChecker;
  /** `${absPath}#${start}` → symbols.id, so edges can point at declarations. */
  symbolIds: Map<string, number>;
  fileIds: Map<string, number>;
  /** absPath → the file's module symbol, which owns top-level code. */
  moduleIds: Map<string, number>;
}

const declKey = (file: string, start: number): string => `${file}#${start}`;

/** Sentinel offset for the per-file module symbol. No AST node can start here. */
const MODULE_START = -1;

function kindOf(node: ts.Node): SymbolKind | undefined {
  if (ts.isFunctionDeclaration(node)) return 'function';
  if (ts.isClassDeclaration(node)) return 'class';
  if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) return 'method';
  if (ts.isInterfaceDeclaration(node)) return 'interface';
  if (ts.isTypeAliasDeclaration(node)) return 'type';
  if (ts.isEnumDeclaration(node)) return 'enum';
  if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) return 'property';
  if (ts.isVariableDeclaration(node)) {
    // Only variables that hold behaviour or a component — indexing every `const x = 1`
    // buries the useful symbols in noise.
    const init = node.initializer;
    if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init) || ts.isClassExpression(init))) {
      return 'variable';
    }
    return undefined;
  }
  return undefined;
}

function isExported(node: ts.Node): boolean {
  const flags = ts.getCombinedModifierFlags(node as ts.Declaration);
  if ((flags & ts.ModifierFlags.Export) !== 0) return true;
  // `const x = …` carries its export on the VariableStatement, two levels up.
  const statement = node.parent?.parent;
  return statement !== undefined && ts.isVariableStatement(statement)
    ? (ts.getCombinedModifierFlags(statement as unknown as ts.Declaration) & ts.ModifierFlags.Export) !== 0
    : false;
}

/** The declaration a reference sits inside — the `from` end of every edge. */
function enclosingDeclaration(node: ts.Node): ts.Node | undefined {
  let current: ts.Node | undefined = node.parent;
  while (current !== undefined) {
    if (kindOf(current) !== undefined) return current;
    current = current.parent;
  }
  return undefined;
}

function nameOf(node: ts.Node): string | undefined {
  const named = node as ts.NamedDeclaration;
  if (named.name === undefined) return undefined;
  return ts.isIdentifier(named.name) || ts.isStringLiteral(named.name) ? named.name.text : undefined;
}

function collectDeclarations(ctx: Ctx, source: ts.SourceFile, fileId: number): number {
  const insert = ctx.db.prepare(
    'INSERT INTO symbols (file_id, name, kind, line, start, exported) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
  );
  let count = 0;

  // A module symbol per file. Without it, every top-level call — route registration,
  // middleware wiring, config construction — has no `from` end and is silently dropped.
  // start = -1 because offset 0 is a real position: a file beginning with
  // `export function foo` would collide with the module symbol.
  const moduleRow = insert.get(fileId, basename(source.fileName), 'module', 1, MODULE_START, 1) as { id: number };
  ctx.moduleIds.set(source.fileName, moduleRow.id);
  count += 1;

  const visit = (node: ts.Node): void => {
    const kind = kindOf(node);
    const name = kind === undefined ? undefined : nameOf(node);
    if (kind !== undefined && name !== undefined) {
      const start = node.getStart(source);
      const line = source.getLineAndCharacterOfPosition(start).line + 1;
      const row = insert.get(fileId, name, kind, line, start, isExported(node) ? 1 : 0) as { id: number };
      // Record the id now so pass two can resolve references without a second query.
      ctx.symbolIds.set(declKey(source.fileName, start), row.id);
      count += 1;
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(source, visit);
  return count;
}

/** Resolve an identifier to the declaration we indexed, if we indexed it. */
function resolveTarget(ctx: Ctx, node: ts.Node): number | undefined {
  let symbol = ctx.checker.getSymbolAtLocation(node);
  if (symbol === undefined) return undefined;
  if ((symbol.flags & ts.SymbolFlags.Alias) !== 0) symbol = ctx.checker.getAliasedSymbol(symbol);

  for (const decl of symbol.declarations ?? []) {
    const file = decl.getSourceFile();
    const id = ctx.symbolIds.get(declKey(file.fileName, decl.getStart(file)));
    if (id !== undefined) return id;
  }
  return undefined;
}

function collectEdges(ctx: Ctx, source: ts.SourceFile, fileId: number): number {
  const insert = ctx.db.prepare('INSERT INTO edges (from_id, to_id, kind, file_id, line) VALUES (?, ?, ?, ?, ?)');
  const seen = new Set<string>();
  let count = 0;

  const record = (from: number, to: number, kind: EdgeKind, line: number): void => {
    // One edge per (from, to, kind): callers/callees want distinct relationships,
    // not one row per call site. Line is the first occurrence.
    const key = `${from}:${to}:${kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    insert.run(from, to, kind, fileId, line);
    count += 1;
  };

  const visit = (node: ts.Node): void => {
    let kind: EdgeKind | undefined;
    let target: ts.Node | undefined;

    if (ts.isCallExpression(node)) {
      kind = 'calls';
      const callee = node.expression;
      target = ts.isPropertyAccessExpression(callee) ? callee.name : callee;
    } else if (ts.isNewExpression(node)) {
      kind = 'calls';
      target = node.expression;
    } else if (ts.isImportSpecifier(node) || ts.isImportClause(node)) {
      kind = 'imports';
      target = ts.isImportSpecifier(node) ? node.name : node.name;
    } else if (ts.isExpressionWithTypeArguments(node) && ts.isHeritageClause(node.parent)) {
      kind = node.parent.token === ts.SyntaxKind.ExtendsKeyword ? 'extends' : 'implements';
      target = node.expression;
    } else if (ts.isTypeReferenceNode(node)) {
      kind = 'references';
      target = node.typeName;
    }

    if (kind !== undefined && target !== undefined) {
      const from = enclosingDeclaration(node);
      const fromId =
        from === undefined
          ? ctx.moduleIds.get(source.fileName)
          : ctx.symbolIds.get(declKey(source.fileName, from.getStart(source)));
      const toId = resolveTarget(ctx, target);
      if (fromId !== undefined && toId !== undefined && fromId !== toId) {
        record(fromId, toId, kind, source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1);
      }
    }

    ts.forEachChild(node, visit);
  };

  ts.forEachChild(source, visit);
  return count;
}

export interface IndexOptions {
  root: string;
  include: string[];
  exclude: string[];
}

/**
 * Discover the project's files.
 *
 * A single root tsconfig is the easy case. Monorepos — which most Atrix repos are —
 * have no root config and one per app/package, so we union them. Getting this wrong
 * silently degrades resolution rather than failing, which is why it is worth the code.
 */
function discover(options: IndexOptions): { files: string[]; compilerOptions: ts.CompilerOptions } {
  const configs = [...new Bun.Glob('**/tsconfig.json').scanSync({ cwd: options.root, absolute: true })].filter(
    (f) => !f.includes('/node_modules/'),
  );

  const files = new Set<string>();
  let compilerOptions: ts.CompilerOptions | undefined;

  // Shallowest first, so the root-most config supplies the shared options.
  for (const configPath of configs.sort((a, b) => a.split('/').length - b.split('/').length)) {
    const read = ts.readConfigFile(configPath, ts.sys.readFile);
    if (read.error !== undefined) continue;
    const parsed = ts.parseJsonConfigFileContent(read.config ?? {}, ts.sys, dirname(configPath));
    for (const file of parsed.fileNames) files.add(file);
    compilerOptions ??= parsed.options;
  }

  if (files.size > 0) {
    return { files: [...files], compilerOptions: compilerOptions ?? {} };
  }

  const glob = new Bun.Glob('**/*.{ts,tsx,js,jsx,mts,cts}');
  const scanned = [...glob.scanSync({ cwd: options.root, absolute: true })].filter(
    (f) => !options.exclude.some((ex) => f.includes(`/${ex}/`)),
  );
  return {
    files: scanned,
    compilerOptions: {
      allowJs: true,
      target: ts.ScriptTarget.ESNext,
      // Without a config, assume the modern default — otherwise imports do not resolve
      // and every cross-file edge is lost.
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
    },
  };
}

export function indexRepo(db: Database, options: IndexOptions): IndexResult {
  const started = Date.now();
  const { files, compilerOptions } = discover(options);
  const skipped: string[] = [];

  const program = ts.createProgram(files, { ...compilerOptions, noEmit: true });
  const ctx: Ctx = {
    db,
    root: options.root,
    checker: program.getTypeChecker(),
    symbolIds: new Map(),
    fileIds: new Map(),
    moduleIds: new Map(),
  };

  const sources = program
    .getSourceFiles()
    .filter((s) => !s.isDeclarationFile && !s.fileName.includes('/node_modules/'));

  db.run('DELETE FROM edges');
  db.run('DELETE FROM symbols');
  db.run('DELETE FROM files');

  const insertFile = db.prepare('INSERT INTO files (path, mtime) VALUES (?, ?) RETURNING id');

  // Two passes: every declaration must exist before any edge can point at it.
  db.transaction(() => {
    for (const source of sources) {
      let mtime = 0;
      try {
        mtime = Math.floor(statSync(source.fileName).mtimeMs);
      } catch {
        skipped.push(source.fileName);
        continue;
      }
      const row = insertFile.get(relative(options.root, source.fileName), mtime) as { id: number };
      ctx.fileIds.set(source.fileName, row.id);
      collectDeclarations(ctx, source, row.id);
    }
  })();

  let edges = 0;
  db.transaction(() => {
    for (const source of sources) {
      const fileId = ctx.fileIds.get(source.fileName);
      if (fileId !== undefined) edges += collectEdges(ctx, source, fileId);
    }
  })();

  const symbols = db.query<{ n: number }, []>('SELECT count(*) AS n FROM symbols').get()?.n ?? 0;

  return { files: ctx.fileIds.size, symbols, edges, durationMs: Date.now() - started, skipped };
}
