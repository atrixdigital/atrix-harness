import { Database } from 'bun:sqlite';

/**
 * The code graph store.
 *
 * SQLite because it ships inside Bun — no native module to build, no server to run,
 * and the index is a single file the agent can be told to delete and rebuild.
 */

export const SCHEMA_VERSION = 1;

const DDL = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
  id    INTEGER PRIMARY KEY,
  path  TEXT NOT NULL UNIQUE,
  mtime INTEGER NOT NULL
);

-- A declaration. Identity is (file, start offset), which is stable across renames
-- of the symbol but not across edits — that is why reindexing is per-file.
CREATE TABLE IF NOT EXISTS symbols (
  id       INTEGER PRIMARY KEY,
  file_id  INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  kind     TEXT NOT NULL,
  line     INTEGER NOT NULL,
  start    INTEGER NOT NULL,
  exported INTEGER NOT NULL DEFAULT 0,
  UNIQUE (file_id, start)
);

CREATE TABLE IF NOT EXISTS edges (
  id        INTEGER PRIMARY KEY,
  from_id   INTEGER NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
  to_id     INTEGER NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
  kind      TEXT NOT NULL,
  file_id   INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  line      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id);
CREATE INDEX IF NOT EXISTS idx_edges_from   ON edges(from_id);
CREATE INDEX IF NOT EXISTS idx_edges_to     ON edges(to_id);
`;

export type SymbolKind =
  /** One per file, so top-level code and imports have somewhere to hang. */
  | 'module'
  | 'function'
  | 'class'
  | 'method'
  | 'interface'
  | 'type'
  | 'enum'
  | 'variable'
  | 'property';

export type EdgeKind = 'calls' | 'imports' | 'extends' | 'implements' | 'references';

/**
 * Fold the write-ahead log back into the database file.
 *
 * Without this, `graph.db` is a 4KB stub and the real index lives in `graph.db-wal` —
 * which reads as "the index is empty" to anyone inspecting it, and breaks copying the
 * index around (which the org-wide source graph will do).
 */
export function checkpoint(db: Database): void {
  db.run('PRAGMA wal_checkpoint(TRUNCATE)');
}

export function open(path: string): Database {
  const db = new Database(path, { create: true });
  db.exec('PRAGMA foreign_keys = ON');
  db.run(DDL);

  const stored = db.query<{ value: string }, []>("SELECT value FROM meta WHERE key = 'schema_version'").get();
  if (stored === null) {
    db.run("INSERT INTO meta (key, value) VALUES ('schema_version', ?)", [String(SCHEMA_VERSION)]);
  } else if (Number(stored.value) !== SCHEMA_VERSION) {
    // Migrating an index is never worth it — it is derived data that rebuilds in seconds.
    db.close();
    throw new Error(
      `Index at ${path} is schema v${stored.value}, this build expects v${SCHEMA_VERSION}. Delete it and run \`atrix index\`.`,
    );
  }

  return db;
}
