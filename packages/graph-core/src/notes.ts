import type { Database } from 'bun:sqlite';
import { existsSync, readFileSync } from 'node:fs';
import { basename, relative } from 'node:path';

/**
 * The information graph.
 *
 * Everything this system accumulates — incidents, candidates, understandings, ADRs,
 * handoffs — is markdown nobody can search. The code graph answers "what calls what";
 * this answers "why is it like that", "what broke last time we touched payments", and
 * "did we already try this".
 *
 * Two decisions do most of the work:
 *
 * - **A note is a section, not a file.** `UNDERSTANDINGS.md` is one file holding many
 *   independent claims; returning the whole file for a query about one of them buries the
 *   answer. Splitting on `##` makes each entry separately retrievable.
 * - **Both roots are indexed.** Org-wide knowledge lives in the harness, repo-specific
 *   knowledge lives in the project, and the useful question spans them.
 */

export type NoteKind = 'incident' | 'candidate' | 'understanding' | 'adr' | 'handoff' | 'knowledge';

export interface Note {
  /** Stable identity: where it came from plus its heading. */
  ref: string;
  kind: NoteKind;
  title: string;
  /** Repo-relative path, prefixed with the root label when it is the harness. */
  path: string;
  /** ISO date if the note carries one, else undefined. */
  date: string | undefined;
  status: string | undefined;
  body: string;
}

interface Source {
  kind: NoteKind;
  /** Glob relative to the root. */
  pattern: string;
  /** Split the file into one note per `##` section. */
  bySection: boolean;
}

const HARNESS_SOURCES: Source[] = [
  { kind: 'incident', pattern: 'learning/incidents/*.md', bySection: false },
  { kind: 'candidate', pattern: 'learning/candidates/*.md', bySection: false },
  { kind: 'understanding', pattern: 'UNDERSTANDINGS.md', bySection: true },
];

const PROJECT_SOURCES: Source[] = [
  { kind: 'understanding', pattern: 'UNDERSTANDINGS.md', bySection: true },
  { kind: 'adr', pattern: 'docs/adr/*.md', bySection: false },
  { kind: 'handoff', pattern: 'handoffs/*.md', bySection: false },
  { kind: 'knowledge', pattern: 'knowledge/*.md', bySection: false },
];

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function field(block: string, key: string): string | undefined {
  const match = new RegExp(`^${key}:\\s*(.+)$`, 'im').exec(block);
  return match?.[1]?.trim().replace(/^["']|["']$/g, '');
}

/** Any ISO date in the text, for notes without frontmatter. */
const looseDate = (text: string): string | undefined => /\b(\d{4}-\d{2}-\d{2})\b/.exec(text)?.[1];

function fileToNotes(root: string, label: string, file: string, source: Source): Note[] {
  const raw = readFileSync(file, 'utf8');
  const rel = relative(root, file);
  const path = label === '' ? rel : `${label}:${rel}`;

  const fm = FRONTMATTER.exec(raw);
  const meta = fm?.[1] ?? '';
  const content = fm === null ? raw : raw.slice(fm[0].length);

  if (!source.bySection) {
    const title = field(meta, 'title') ?? /^#\s+(.+)$/m.exec(content)?.[1]?.trim() ?? basename(file, '.md');
    return [
      {
        ref: path,
        kind: source.kind,
        title,
        path,
        date: field(meta, 'date') ?? looseDate(content),
        status: field(meta, 'status'),
        body: content.trim(),
      },
    ];
  }

  // One note per `##` section. The preamble before the first heading is boilerplate
  // explaining the file's purpose, not an entry, so it is dropped.
  const notes: Note[] = [];
  const lines = content.split(/\r?\n/);
  let title: string | undefined;
  let buffer: string[] = [];

  const flush = (): void => {
    if (title === undefined) return;
    const body = buffer.join('\n').trim();
    if (body !== '') {
      notes.push({
        ref: `${path}#${title}`,
        kind: source.kind,
        title,
        path,
        date: looseDate(body),
        status: /\bSuperseded\b/i.test(body) ? 'superseded' : undefined,
        body,
      });
    }
    buffer = [];
  };

  for (const line of lines) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading !== null) {
      flush();
      title = heading[1];
    } else if (title !== undefined) {
      buffer.push(line);
    }
  }
  flush();

  return notes;
}

/**
 * Gather notes across the workspace.
 *
 * `extraRoots` carries the projects. Each project's UNDERSTANDINGS.md is committed to
 * that project's own repo — so it travels with the code and reaches whoever works on it,
 * rather than living in a harness only Atrix engineers clone.
 */
export function collectNotes(harnessRoot: string, projectRoot: string, extraRoots: string[] = []): Note[] {
  const notes: Note[] = [];
  const seenRoots = new Set<string>();

  const gather = (root: string, label: string, sources: Source[]): void => {
    const key = `${root}|${label}`;
    if (seenRoots.has(key)) return;
    seenRoots.add(key);

    for (const source of sources) {
      for (const file of new Bun.Glob(source.pattern).scanSync({ cwd: root, absolute: true })) {
        if (!existsSync(file)) continue;
        notes.push(...fileToNotes(root, label, file, source));
      }
    }
  };

  gather(harnessRoot, 'harness', HARNESS_SOURCES);
  if (projectRoot !== harnessRoot) gather(projectRoot, '', PROJECT_SOURCES);

  for (const root of extraRoots) {
    if (root === harnessRoot) {
      // The harness's own UNDERSTANDINGS.md, already covered by HARNESS_SOURCES.
      continue;
    }
    gather(root, basename(root), PROJECT_SOURCES);
  }

  return notes;
}

const DDL = `
CREATE TABLE IF NOT EXISTS notes (
  id     INTEGER PRIMARY KEY,
  ref    TEXT NOT NULL UNIQUE,
  kind   TEXT NOT NULL,
  title  TEXT NOT NULL,
  path   TEXT NOT NULL,
  date   TEXT,
  status TEXT,
  body   TEXT NOT NULL
);
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(title, body, content=notes, content_rowid=id);
`;

export function indexNotes(db: Database, notes: Note[]): number {
  db.run(DDL);
  db.run('DELETE FROM notes');
  db.run("INSERT INTO notes_fts(notes_fts) VALUES('rebuild')");

  const insert = db.prepare(
    'INSERT INTO notes (ref, kind, title, path, date, status, body) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
  );
  const insertFts = db.prepare('INSERT INTO notes_fts(rowid, title, body) VALUES (?, ?, ?)');

  db.transaction(() => {
    for (const note of notes) {
      const row = insert.get(note.ref, note.kind, note.title, note.path, note.date ?? null, note.status ?? null, note.body) as {
        id: number;
      };
      insertFts.run(row.id, note.title, note.body);
    }
  })();

  return notes.length;
}

export interface Recalled extends Note {
  /** Matched fragment with the query terms in context. */
  snippet: string;
}

/**
 * FTS5 treats a bare question as a query expression, so `why did we choose X?` throws on
 * the `?`. Reduce to terms and OR them — recall matters more than precision here, because
 * the ranking sorts it out and an empty result is the worst outcome.
 */
function toMatchExpression(question: string): string {
  const terms = question
    .toLowerCase()
    .split(/[^a-z0-9_-]+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
  return terms.length === 0 ? '' : terms.map((t) => `"${t}"*`).join(' OR ');
}

/**
 * Words that match everything and therefore rank nothing.
 *
 * Under-filtering is not harmless: a query for "why are adapters committed" matched a note
 * on the learning loop because the word "they" appeared in it, and that note outranked the
 * one actually titled "adapters is generated output that is nonetheless committed".
 */
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'was', 'why', 'how', 'what', 'when', 'did', 'does', 'are', 'this', 'that',
  'with', 'from', 'have', 'has', 'our', 'you', 'not', 'but', 'all', 'can', 'its', 'were', 'about',
  'they', 'them', 'their', 'there', 'then', 'than', 'these', 'those', 'who', 'whom', 'whose',
  'will', 'would', 'should', 'could', 'shall', 'may', 'might', 'must', 'been', 'being',
  'into', 'onto', 'over', 'under', 'some', 'any', 'one', 'two', 'get', 'got', 'use', 'used',
  'make', 'made', 'also', 'just', 'only', 'very', 'much', 'more', 'most', 'same', 'each', 'such',
  'here', 'where', 'which', 'while', 'because', 'before', 'after', 'again', 'other', 'both',
  'need', 'needs', 'want', 'like', 'see', 'say', 'said', 'now', 'out', 'off', 'own', 'via',
]);

export function recall(db: Database, question: string, limit = 8): Recalled[] {
  const expression = toMatchExpression(question);
  if (expression === '') return [];

  try {
    const rows = db
      .query<
        { ref: string; kind: string; title: string; path: string; date: string | null; status: string | null; body: string; snippet: string },
        [string, number]
      >(
        `SELECT n.ref, n.kind, n.title, n.path, n.date, n.status, n.body,
                snippet(notes_fts, 1, '«', '»', '…', 24) AS snippet
         FROM notes_fts
         JOIN notes n ON n.id = notes_fts.rowid
         WHERE notes_fts MATCH ?1
         ORDER BY bm25(notes_fts, 4.0, 1.0), n.date DESC
         LIMIT ?2`,
      )
      .all(expression, limit);

    return rows.map((r) => ({
      ref: r.ref,
      kind: r.kind as NoteKind,
      title: r.title,
      path: r.path,
      date: r.date ?? undefined,
      status: r.status ?? undefined,
      body: r.body,
      snippet: r.snippet.replace(/\s+/g, ' ').trim(),
    }));
  } catch {
    // A malformed expression must return nothing, never crash the caller's session.
    return [];
  }
}

export function getNote(db: Database, ref: string): Note | undefined {
  const row = db
    .query<{ ref: string; kind: string; title: string; path: string; date: string | null; status: string | null; body: string }, [string]>(
      'SELECT ref, kind, title, path, date, status, body FROM notes WHERE ref = ?1',
    )
    .get(ref);
  if (row === null) return undefined;
  return { ...row, kind: row.kind as NoteKind, date: row.date ?? undefined, status: row.status ?? undefined };
}
