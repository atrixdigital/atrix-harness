import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { parseFrontmatter } from './frontmatter.ts';
import { harnessPaths } from './paths.ts';

/**
 * Incidents are the raw input to the learning loop.
 *
 * Lifecycle:
 *   captured  — written by `atrix learn`, not yet analysed
 *   distilled — a candidate change exists in learning/candidates/
 *   merged    — the candidate landed; a rule now cites this incident
 *   dismissed — analysed and found not to generalise. A valid, common outcome.
 */

export const INCIDENT_ID = /^incident-\d{4}$/;

export const incidentSchema = z.object({
  id: z.string().regex(INCIDENT_ID, 'must be "incident-NNNN"'),
  title: z.string().min(5),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD'),
  status: z.enum(['captured', 'distilled', 'merged', 'dismissed']),
  cost: z.string().default('unknown'),
});

export type IncidentMeta = z.infer<typeof incidentSchema>;

export interface Incident {
  meta: IncidentMeta;
  body: string;
  file: string;
}

/** Headings the `learn` template creates, which distillation needs filled in. */
const REQUIRED_SECTIONS = ['What happened', 'Why it happened', 'What fixed it'];

export function listIncidents(harnessRoot: string): { incidents: Incident[]; issues: string[] } {
  const dir = harnessPaths(harnessRoot).incidents;
  const incidents: Incident[] = [];
  const issues: string[] = [];

  if (!existsSync(dir)) return { incidents, issues };

  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith('.md')) continue;
    const file = join(dir, name);
    const { data, body } = parseFrontmatter(readFileSync(file, 'utf8'));
    const parsed = incidentSchema.safeParse(data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        issues.push(`learning/incidents/${name} — ${issue.path.join('.') || 'frontmatter'}: ${issue.message}`);
      }
      continue;
    }
    incidents.push({ meta: parsed.data, body, file });
  }

  return { incidents, issues };
}

export function findIncident(harnessRoot: string, id: string): Incident | undefined {
  return listIncidents(harnessRoot).incidents.find((i) => i.meta.id === id);
}

/**
 * A section counts as filled in only if it has prose. The template leaves HTML
 * comments as prompts, so a section containing nothing but comments is still empty —
 * distilling from an unfilled incident produces a rule nobody can justify later.
 */
export function unfilledSections(body: string): string[] {
  // Split on `##` headings rather than matching each one with a lookahead — the final
  // section runs to end-of-input, which a naive lookahead gets wrong.
  const sections = new Map<string, string>();
  let current: string | undefined;
  let buffer: string[] = [];

  const flush = (): void => {
    if (current !== undefined) sections.set(current, buffer.join('\n'));
    buffer = [];
  };

  for (const line of body.split(/\r?\n/)) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading !== null) {
      flush();
      current = heading[1];
    } else if (current !== undefined) {
      buffer.push(line);
    }
  }
  flush();

  return REQUIRED_SECTIONS.filter((heading) => {
    const content = sections.get(heading);
    if (content === undefined) return true;
    const prose = content
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/^\s*[-*]\s*\[[ x]\]\s.*$/gim, '')
      .trim();
    return prose === '';
  });
}

/** Every `source: incident-NNNN` on a rule must point at an incident that exists. */
export function danglingProvenance(harnessRoot: string, sources: { path: string; source: string }[]): string[] {
  const known = new Set(listIncidents(harnessRoot).incidents.map((i) => i.meta.id));
  return sources
    .filter((s) => s.source !== 'founding' && !known.has(s.source))
    .map((s) => `${s.path} — cites ${s.source}, which does not exist in learning/incidents/`);
}
