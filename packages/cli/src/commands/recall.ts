import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getNote, open, recall } from '@atrix/graph-core';
import { AtrixError, bold, cyan, dim, log } from '../lib/log.ts';

/**
 * Ask the information graph a question.
 *
 * The point is the *why*: which incident produced a rule, what a past session already
 * ruled out, why a mechanism is shaped the way it is. The code graph cannot answer any
 * of that, and re-deriving it is what makes every session start from zero.
 */
export function runRecall(projectRoot: string, args: string[]): boolean {
  const dbPath = join(projectRoot, '.atrix', 'graph.db');
  if (!existsSync(dbPath)) {
    throw new AtrixError(`No index at ${dbPath}.`, 'Run `atrix index` first.');
  }

  const showFull = args.includes('--full');
  const question = args.filter((a) => a !== '--full').join(' ').trim();
  if (question === '') {
    throw new AtrixError('`atrix recall` needs a question.', 'e.g. atrix recall "why do we commit adapters"');
  }

  const db = open(dbPath);
  try {
    const hits = recall(db, question, showFull ? 1 : 8);

    if (hits.length === 0) {
      log.info('Nothing recorded about that.');
      log.detail('If you work it out, `atrix learn` or an UNDERSTANDINGS.md entry stops the next person re-deriving it.');
      return true;
    }

    if (showFull) {
      const note = getNote(db, hits[0]?.ref ?? '');
      if (note !== undefined) {
        log.info(bold(note.title));
        log.detail(`${note.kind} · ${note.path}${note.date === undefined ? '' : ` · ${note.date}`}`);
        log.blank();
        log.info(note.body);
      }
      return true;
    }

    log.info(`${hits.length} result(s) for ${cyan(question)}`);
    log.blank();
    for (const hit of hits) {
      const meta = [hit.kind, hit.date, hit.status].filter((v) => v !== undefined).join(' · ');
      log.info(`${bold(hit.title)}  ${dim(meta)}`);
      log.detail(hit.snippet);
      log.detail(dim(hit.path));
      log.blank();
    }
    log.detail('`atrix recall --full "<question>"` prints the top result in full.');
    return true;
  } finally {
    db.close();
  }
}
