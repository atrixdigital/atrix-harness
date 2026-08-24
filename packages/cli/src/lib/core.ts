import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { z } from 'zod';
import { parseFrontmatter } from './frontmatter.ts';
import { harnessPaths } from './paths.ts';

/**
 * Every artefact in core/ is markdown with frontmatter. These schemas are the
 * contract the adapters compile against — if it validates here, every agent
 * format can be generated from it.
 */

const slug = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be kebab-case');

/**
 * Provenance: a rule that cannot name where it came from does not belong.
 *
 *   incident-NNNN   we hit this ourselves; the write-up is in learning/incidents/
 *   research-<ref>  published evidence, cited in docs/RESEARCH.md
 *   founding        the initial set, predating the loop
 *
 * `research-` is deliberately distinct from `founding`: a rule justified by someone
 * else's measurements is a weaker claim than one justified by our own failure, and
 * the reader is entitled to know which they are looking at.
 */
const provenance = z
  .string()
  .regex(
    /^(incident-\d{4}|research-[a-z0-9][a-z0-9.-]*|founding)$/,
    'must be "incident-NNNN", "research-<ref>", or "founding"',
  );

export const ruleSchema = z.object({
  name: slug,
  description: z.string().min(10),
  source: provenance,
  applies: z.array(z.string()).default(['**']),
  /**
   * The condition under which this rule becomes dead scaffolding.
   *
   * Every rule encodes an assumption about what the model cannot do on its own, and models
   * change: scaffolding that was load-bearing for one release is pure overhead by the next.
   * Declaring the expiry at authoring time is the only moment anyone actually knows it —
   * afterwards nobody remembers why the rule exists, so nobody dares delete it.
   *
   * `doctor` lists these so pruning is a periodic action rather than an intention.
   */
  expires_when: z.string().min(10).optional(),
});

/**
 * Constraints from the official Agent Skills spec, enforced here so a skill that
 * validates in this repo is one every runtime will accept.
 */
export const SKILL_NAME_MAX = 64;
export const SKILL_DESCRIPTION_MAX = 1024;
const RESERVED_SKILL_WORDS = /\b(anthropic|claude)\b/i;

export const skillSchema = z.object({
  name: slug
    .max(SKILL_NAME_MAX, `must be at most ${SKILL_NAME_MAX} characters`)
    .refine((n) => !RESERVED_SKILL_WORDS.test(n), 'must not contain the reserved words "anthropic" or "claude"'),
  description: z.string().min(20).max(SKILL_DESCRIPTION_MAX, `must be at most ${SKILL_DESCRIPTION_MAX} characters`),
  group: z.enum([
    'engineering',
    'methodology',
    'delivery',
    'infra',
    'documents',
    'communication',
    'product',
    'stack',
  ]),
});

export const roleSchema = z.object({
  name: slug,
  description: z.string().min(10),
  model: z.enum(['opus', 'sonnet', 'haiku', 'inherit']).default('inherit'),
  tools: z.array(z.string()).default([]),
});

export type Rule = z.infer<typeof ruleSchema>;
export type Skill = z.infer<typeof skillSchema>;
export type Role = z.infer<typeof roleSchema>;

export interface Doc<T> {
  meta: T;
  body: string;
  /** Path relative to the harness root, for error messages and adapter layout. */
  path: string;
}

export interface CoreIssue {
  path: string;
  message: string;
}

export interface CoreSet {
  rules: Doc<Rule>[];
  methodology: Doc<Rule>[];
  skills: Doc<Skill>[];
  roles: Doc<Role>[];
  issues: CoreIssue[];
}

function walk(dir: string, match: (p: string) => boolean): string[] {
  let out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(walk(full, match));
    else if (match(full)) out.push(full);
  }
  return out;
}

function load<S extends z.ZodTypeAny>(
  root: string,
  files: string[],
  schema: S,
  issues: CoreIssue[],
): Doc<z.infer<S>>[] {
  const docs: Doc<z.infer<S>>[] = [];
  for (const file of files) {
    const rel = relative(root, file).split(sep).join('/');
    const { data, body } = parseFrontmatter(readFileSync(file, 'utf8'));
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        issues.push({ path: rel, message: `${issue.path.join('.') || 'frontmatter'}: ${issue.message}` });
      }
      continue;
    }
    if (body.trim() === '') {
      issues.push({ path: rel, message: 'body is empty' });
      continue;
    }
    docs.push({ meta: parsed.data, body: body.trim(), path: rel });
  }
  return docs;
}

/** Read and validate everything under core/. Never throws — issues are returned. */
export function loadCore(harnessRoot: string): CoreSet {
  const p = harnessPaths(harnessRoot);
  const issues: CoreIssue[] = [];
  const md = (f: string) => f.endsWith('.md');
  // Skills are directories containing SKILL.md, so references/ and scripts/ can sit beside them.
  const skillFile = (f: string) => f.endsWith(`${sep}SKILL.md`);

  const set: CoreSet = {
    rules: load(harnessRoot, walk(p.rules, md), ruleSchema, issues),
    methodology: load(harnessRoot, walk(p.methodology, md), ruleSchema, issues),
    skills: load(harnessRoot, walk(p.skills, skillFile), skillSchema, issues),
    roles: load(harnessRoot, walk(p.roles, md), roleSchema, issues),
    issues,
  };

  const seen = new Map<string, string>();
  for (const doc of [...set.rules, ...set.methodology, ...set.skills, ...set.roles]) {
    const key = `${doc.meta.name}`;
    const prior = seen.get(key);
    if (prior) issues.push({ path: doc.path, message: `duplicate name "${key}", already used by ${prior}` });
    else seen.set(key, doc.path);
  }

  return set;
}
