import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { checkpoint, collectNotes, indexNotes, indexRepo, open } from '@atrix/graph-core';
import { log } from '../lib/log.ts';

const configSchema = z.object({
  index: z
    .object({
      include: z.array(z.string()).default([]),
      exclude: z.array(z.string()).default(['node_modules', 'dist', '.next']),
    })
    .default({ include: [], exclude: ['node_modules', 'dist', '.next'] }),
});

export function runIndex(projectRoot: string, harnessRoot: string): void {
  const configPath = join(projectRoot, '.atrix', 'config.json');
  const parsed = existsSync(configPath)
    ? configSchema.safeParse(JSON.parse(readFileSync(configPath, 'utf8')))
    : configSchema.safeParse({});

  const config = parsed.success ? parsed.data : configSchema.parse({});
  if (!parsed.success) log.warn('.atrix/config.json is malformed — using defaults');

  const dir = join(projectRoot, '.atrix');
  mkdirSync(dir, { recursive: true });
  const dbPath = join(dir, 'graph.db');

  const db = open(dbPath);
  try {
    const result = indexRepo(db, { root: projectRoot, ...config.index });
    const seconds = (result.durationMs / 1000).toFixed(1);
    log.ok(`indexed ${result.files} files — ${result.symbols} symbols, ${result.edges} edges in ${seconds}s`);

    // Knowledge indexing is cheap and spans both roots: org-wide incidents live in the
    // harness, repo-specific understandings live here, and the useful question crosses them.
    const notes = indexNotes(db, collectNotes(harnessRoot, projectRoot));
    log.ok(`indexed ${notes} note(s) — incidents, understandings, ADRs and handoffs`);
    if (result.skipped.length > 0) {
      // Never let a partial index look like a complete one.
      log.warn(`${result.skipped.length} file(s) skipped`);
      for (const file of result.skipped.slice(0, 5)) log.detail(file);
    }
  } finally {
    checkpoint(db);
    db.close();
  }
}
