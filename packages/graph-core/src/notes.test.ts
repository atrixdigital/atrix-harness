import { Database } from 'bun:sqlite';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { collectNotes, getNote, indexNotes, recall } from './notes.ts';

let harness: string;
let project: string;
let db: Database;

const write = (root: string, path: string, body: string): void => {
  const full = join(root, path);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, body);
};

beforeEach(() => {
  harness = mkdtempSync(join(tmpdir(), 'atrix-notes-h-'));
  project = mkdtempSync(join(tmpdir(), 'atrix-notes-p-'));
  db = new Database(':memory:');
});
afterEach(() => {
  db.close();
  rmSync(harness, { recursive: true, force: true });
  rmSync(project, { recursive: true, force: true });
});

const load = (): number => indexNotes(db, collectNotes(harness, project));

describe('a note is a section, not a file', () => {
  beforeEach(() => {
    write(
      project,
      'UNDERSTANDINGS.md',
      `# Understandings

Preamble explaining what this file is for. Not an entry.

## Retries live in the consumer

**Date:** 2026-08-24

The producer fires and forgets; the consumer owns idempotency.

## Payments reconcile nightly

**Date:** 2026-08-20

A second cron exists because the first silently stopped firing.
`,
    );
  });

  test('splits on headings so one entry can be retrieved without the others', () => {
    expect(load()).toBe(2);
    const hits = recall(db, 'retries consumer');
    expect(hits[0]?.title).toBe('Retries live in the consumer');
    // Returning the whole file would bury the answer among unrelated entries.
    expect(hits[0]?.body).not.toContain('reconcile nightly');
  });

  test('drops the preamble, which is boilerplate rather than knowledge', () => {
    load();
    expect(recall(db, 'preamble explaining')).toEqual([]);
  });

  test('picks up the per-entry date', () => {
    load();
    expect(recall(db, 'retries consumer')[0]?.date).toBe('2026-08-24');
  });

  test('marks a superseded entry so a reader can weigh it', () => {
    write(project, 'UNDERSTANDINGS.md', '## Old belief\n\n> **Superseded 2026-09-02** — moved in #412.\n\nbody\n');
    load();
    expect(recall(db, 'old belief')[0]?.status).toBe('superseded');
  });
});

describe('scope', () => {
  test('indexes both roots, because the useful question spans them', () => {
    write(harness, 'learning/incidents/incident-0001-a.md', '---\nid: incident-0001\ntitle: zod defaults broke\ndate: 2026-08-20\n---\n\nbody about zod\n');
    write(project, 'UNDERSTANDINGS.md', '## Local mechanism\n\nsomething repo specific\n');

    expect(load()).toBe(2);
    expect(recall(db, 'zod defaults')[0]?.kind).toBe('incident');
    expect(recall(db, 'repo specific')[0]?.kind).toBe('understanding');
  });

  test('labels harness notes so their origin is visible', () => {
    write(harness, 'learning/incidents/incident-0001-a.md', '---\ntitle: a thing\n---\n\ndetail\n');
    load();
    expect(recall(db, 'detail')[0]?.path.startsWith('harness:')).toBe(true);
  });

  test('does not double-index when harness and project are the same repo', () => {
    write(harness, 'UNDERSTANDINGS.md', '## Only once\n\nbody\n');
    expect(indexNotes(db, collectNotes(harness, harness))).toBe(1);
  });
});

describe('querying', () => {
  beforeEach(() => {
    write(harness, 'learning/incidents/incident-0001-a.md', '---\ntitle: adapters went stale\n---\n\nGenerated output drifted from source.\n');
    write(project, 'UNDERSTANDINGS.md', '## The learning loop has two inputs\n\nA human noticing, and the trace.\n');
    load();
  });

  test('a natural question with punctuation does not throw', () => {
    // FTS5 treats a bare question as a query expression; `?` and `'` are syntax errors.
    expect(() => recall(db, "why did we choose X? isn't it odd — really?")).not.toThrow();
  });

  test('ignores words that match everything', () => {
    // Under-filtering ranked an unrelated note first because "they" appeared in it.
    expect(recall(db, 'they were about that')).toEqual([]);
  });

  test('returns nothing rather than guessing when there is no match', () => {
    expect(recall(db, 'kubernetes ingress annotations')).toEqual([]);
  });

  test('getNote returns the full body for a ref', () => {
    const ref = recall(db, 'adapters stale')[0]?.ref;
    expect(getNote(db, ref ?? '')?.body).toContain('drifted from source');
  });

  test('reindexing replaces rather than duplicates', () => {
    expect(load()).toBe(2);
    expect(db.query<{ n: number }, []>('SELECT count(*) AS n FROM notes').get()?.n).toBe(2);
  });
});
