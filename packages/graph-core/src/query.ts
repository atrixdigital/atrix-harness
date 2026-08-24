import type { Database } from 'bun:sqlite';

/**
 * The query surface agents actually use.
 *
 * Every result is shaped to be *read*, not paged through: narrow rows, hard limits,
 * and no field an agent would have to make a second call to interpret. A graph tool
 * that returns 400 rows has just reinvented the file dump it was meant to replace.
 */

export interface SymbolRow {
  id: number;
  name: string;
  kind: string;
  /** Which repo in the workspace this lives in. */
  project: string;
  path: string;
  line: number;
  exported: boolean;
}

export interface EdgeRow extends SymbolRow {
  edge: string;
  /** Where the relationship occurs, which is rarely the same as where the symbol lives. */
  atPath: string;
  atLine: number;
}

const DEFAULT_LIMIT = 30;
/** Beyond this, an impact answer stops being actionable and becomes a file listing. */
const MAX_IMPACT_NODES = 200;

const SELECT_SYMBOL = `
  SELECT s.id, s.name, s.kind, f.project, f.path, s.line, s.exported
  FROM symbols s JOIN files f ON f.id = s.file_id
`;

interface RawSymbol {
  id: number;
  name: string;
  kind: string;
  project: string;
  path: string;
  line: number;
  exported: number;
}

const toSymbol = (r: RawSymbol): SymbolRow => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  project: r.project,
  path: r.path,
  line: r.line,
  exported: r.exported === 1,
});

/**
 * Find declarations by name. Exact matches first, then prefix, then substring —
 * an agent searching "createBooking" wants that symbol, not the 40 things containing it.
 */
export function search(db: Database, term: string, limit = DEFAULT_LIMIT, project?: string): SymbolRow[] {
  // Scope defaults to the active project. Searching every repo by default would answer
  // a question about playo-web with a symbol from ezrov — technically a match, and wrong.
  const scope = project === undefined ? '' : 'AND f.project = ?5';
  const rows = db
    .query<RawSymbol, [string, string, string, number] | [string, string, string, number, string]>(
      `${SELECT_SYMBOL}
       WHERE (s.name = ?1 OR s.name LIKE ?2 OR s.name LIKE ?3) ${scope}
       ORDER BY
         CASE WHEN s.name = ?1 THEN 0 WHEN s.name LIKE ?2 THEN 1 ELSE 2 END,
         s.exported DESC,
         length(s.name),
         f.project,
         f.path
       LIMIT ?4`,
    )
    .all(...((project === undefined
      ? [term, `${term}%`, `%${term}%`, limit]
      : [term, `${term}%`, `%${term}%`, limit, project]) as [string, string, string, number]));
  return rows.map(toSymbol);
}

/** Projects present in the index, for reporting and for `--all` disambiguation. */
export function projects(db: Database): { project: string; files: number }[] {
  return db
    .query<{ project: string; files: number }, []>(
      'SELECT project, count(*) AS files FROM files GROUP BY project ORDER BY project',
    )
    .all();
}

function related(db: Database, id: number, direction: 'in' | 'out', limit: number): EdgeRow[] {
  const [self, other] = direction === 'in' ? ['to_id', 'from_id'] : ['from_id', 'to_id'];
  const rows = db
    .query<RawSymbol & { edge: string; at_path: string; at_line: number }, [number, number]>(
      `SELECT s.id, s.name, s.kind, f.path, s.line, s.exported,
              e.kind AS edge, ef.path AS at_path, e.line AS at_line
       FROM edges e
       JOIN symbols s ON s.id = e.${other}
       JOIN files f  ON f.id = s.file_id
       JOIN files ef ON ef.id = e.file_id
       WHERE e.${self} = ?1
       ORDER BY e.kind, f.path, e.line
       LIMIT ?2`,
    )
    .all(id, limit);

  return rows.map((r) => ({ ...toSymbol(r), edge: r.edge, atPath: r.at_path, atLine: r.at_line }));
}

/** Who reaches this symbol. The question before any edit to shared code. */
export const callers = (db: Database, id: number, limit = DEFAULT_LIMIT): EdgeRow[] =>
  related(db, id, 'in', limit);

/** What this symbol reaches. The question when reading unfamiliar code. */
export const callees = (db: Database, id: number, limit = DEFAULT_LIMIT): EdgeRow[] =>
  related(db, id, 'out', limit);

export interface Context {
  symbol: SymbolRow;
  callers: EdgeRow[];
  callees: EdgeRow[];
  siblings: SymbolRow[];
}

/**
 * Everything about a symbol in one call — the whole point of the graph. Siblings are
 * the other declarations in its file, which is usually what a reader needs next.
 */
export function context(db: Database, id: number): Context | undefined {
  const row = db.query<RawSymbol, [number]>(`${SELECT_SYMBOL} WHERE s.id = ?1`).get(id);
  if (row === null) return undefined;

  const siblings = db
    .query<RawSymbol, [number, number]>(
      `${SELECT_SYMBOL} WHERE s.file_id = (SELECT file_id FROM symbols WHERE id = ?1) AND s.id != ?1
       ORDER BY s.line LIMIT ?2`,
    )
    .all(id, DEFAULT_LIMIT)
    .map(toSymbol);

  return { symbol: toSymbol(row), callers: callers(db, id), callees: callees(db, id), siblings };
}

export interface ImpactNode extends SymbolRow {
  /** Edges away from the changed symbol. 1 = direct caller. */
  depth: number;
}

export interface Impact {
  symbol: SymbolRow;
  nodes: ImpactNode[];
  files: string[];
  truncated: boolean;
}

/**
 * Transitive callers — the blast radius of changing this symbol.
 *
 * Breadth-first so the closest (and most likely to actually break) come first, and
 * truncated rather than allowed to return the whole repo: an unbounded answer to
 * "what does this affect" is indistinguishable from no answer.
 */
export function impact(db: Database, id: number, maxDepth = 3): Impact | undefined {
  const root = db.query<RawSymbol, [number]>(`${SELECT_SYMBOL} WHERE s.id = ?1`).get(id);
  if (root === null) return undefined;

  const stmt = db.query<RawSymbol, [number]>(
    `${SELECT_SYMBOL} JOIN edges e ON e.from_id = s.id WHERE e.to_id = ?1`,
  );

  const seen = new Set<number>([id]);
  const nodes: ImpactNode[] = [];
  let frontier = [id];
  let truncated = false;

  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth += 1) {
    const next: number[] = [];
    for (const current of frontier) {
      for (const row of stmt.all(current)) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        if (nodes.length >= MAX_IMPACT_NODES) {
          truncated = true;
          break;
        }
        nodes.push({ ...toSymbol(row), depth });
        next.push(row.id);
      }
      if (truncated) break;
    }
    if (truncated) break;
    frontier = next;
  }

  // A file's module symbol is a real dependent (it imports the symbol), but when a
  // named declaration from that same file is also affected, the module row adds no
  // information and doubles the output. Token efficiency is the entire point here.
  const filesWithNamedDependents = new Set(nodes.filter((n) => n.kind !== 'module').map((n) => n.path));
  const pruned = nodes.filter((n) => n.kind !== 'module' || !filesWithNamedDependents.has(n.path));

  return {
    symbol: toSymbol(root),
    nodes: pruned,
    files: [...new Set(pruned.map((n) => n.path))].sort(),
    truncated,
  };
}
