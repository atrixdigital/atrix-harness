import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import type { Doc, Skill } from './core.ts';

/**
 * Skill linting against the published Agent Skills authoring rules.
 *
 * The schema in core.ts catches malformed frontmatter. This catches the things that
 * are structurally valid but degrade discovery and progressive disclosure — which is
 * how a skill library rots: every skill parses, and none of them fire when they should.
 *
 * Enforcing this mechanically is what makes the library safe to write in parallel.
 */

export interface LintFinding {
  path: string;
  rule: string;
  message: string;
  severity: 'error' | 'warn';
}

/** Published limits. */
const SKILL_BODY_MAX_LINES = 500;
/** Reference files past this length need a table of contents, because partial reads truncate them. */
const REFERENCE_TOC_THRESHOLD_LINES = 100;

/** Markdown links to local files, ignoring URLs and anchors. */
const LOCAL_LINK = /\[[^\]]*\]\((?!https?:|#|mailto:)([^)]+)\)/g;

function localLinks(body: string): string[] {
  return [...body.matchAll(LOCAL_LINK)]
    .map((m) => (m[1] ?? '').split('#')[0] ?? '')
    .filter((href) => href !== '');
}

export function lintSkill(harnessRoot: string, skill: Doc<Skill>, listFiles: (dir: string) => string[]): LintFinding[] {
  const findings: LintFinding[] = [];
  const skillDir = join(harnessRoot, dirname(skill.path));
  const add = (rule: string, message: string, severity: LintFinding['severity'] = 'error'): void => {
    findings.push({ path: skill.path, rule, message, severity });
  };

  // — Description is the routing rule, not a summary. It is the highest-leverage line
  //   in the file: it is all the model sees when deciding whether to load the skill.
  const description = skill.meta.description;
  if (!/\b(use when|when the user|use for|use whenever|use after|use before)\b/i.test(description)) {
    add(
      'description-when',
      'description says what the skill does but not WHEN to use it — add "Use when …" with the triggers people actually say',
    );
  }
  if (/^\s*(I |I'|You |Your |We )/.test(description)) {
    add('description-person', 'description must be third person — it is injected into the system prompt');
  }

  // — Body size. Past this, progressive disclosure is the fix, not a smaller font.
  const bodyLines = skill.body.split('\n').length;
  if (bodyLines > SKILL_BODY_MAX_LINES) {
    add('body-length', `SKILL.md body is ${bodyLines} lines (max ${SKILL_BODY_MAX_LINES}) — split into references/`);
  }

  // — Links must resolve, or progressive disclosure silently points at nothing.
  const links = localLinks(skill.body);
  for (const href of links) {
    if (href.includes('\\')) {
      add('path-separator', `link "${href}" uses backslashes — always forward slashes`);
      continue;
    }
    if (!existsSync(join(skillDir, href))) {
      add('broken-link', `SKILL.md links to "${href}", which does not exist`);
    }
  }

  // — References must be one level deep. A reference that points to another reference
  //   gets partially read, and the model silently works from truncated information.
  for (const href of links) {
    const target = join(skillDir, href);
    if (!existsSync(target) || !target.endsWith('.md')) continue;

    const nested = localLinks(readFileSync(target, 'utf8')).filter((h) => h.endsWith('.md'));
    if (nested.length > 0) {
      add(
        'nested-reference',
        `${href} links onward to ${nested.join(', ')} — keep references one level deep from SKILL.md`,
      );
    }
  }

  // — Long reference files need a contents list so a partial read still shows the scope.
  for (const file of listFiles(skillDir)) {
    if (!file.endsWith('.md') || file.endsWith(`${sep}SKILL.md`)) continue;
    const contents = readFileSync(file, 'utf8');
    const lines = contents.split('\n').length;
    if (lines > REFERENCE_TOC_THRESHOLD_LINES && !/^##\s+Contents\s*$/im.test(contents)) {
      findings.push({
        path: relative(harnessRoot, file).split(sep).join('/'),
        rule: 'reference-toc',
        message: `${lines} lines with no "## Contents" section — a partial read will not reveal what is in here`,
        severity: 'warn',
      });
    }
  }

  // — Orphaned files are either dead weight or an unsignalled resource. Both are bugs.
  const referenced = new Set(links.map((href) => join(skillDir, href)));
  for (const file of listFiles(skillDir)) {
    if (file.endsWith(`${sep}SKILL.md`) || !file.endsWith('.md')) continue;
    if (!referenced.has(file)) {
      findings.push({
        path: relative(harnessRoot, file).split(sep).join('/'),
        rule: 'unreferenced-file',
        message: 'not linked from SKILL.md — it will never be loaded',
        severity: 'warn',
      });
    }
  }

  return findings;
}
