import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Doc, Skill } from './core.ts';
import { lintSkill } from './lint.ts';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'atrix-lint-'));
  mkdirSync(join(root, 'core/skills/g/s/references'), { recursive: true });
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function listFiles(dir: string): string[] {
  const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
  return readdirSync(dir).flatMap((e: string) => {
    const full = join(dir, e);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });
}

function skill(body: string, description = 'Does a thing to some files. Use when the user asks for the thing.'): Doc<Skill> {
  const path = 'core/skills/g/s/SKILL.md';
  writeFileSync(join(root, path), body);
  return { meta: { name: 's', description, group: 'engineering' }, body, path };
}

const ref = (name: string, contents: string) => writeFileSync(join(root, 'core/skills/g/s/references', name), contents);

const rules = (findings: { rule: string }[]) => findings.map((f) => f.rule);

describe('description', () => {
  test('accepts one that says what and when', () => {
    expect(rules(lintSkill(root, skill('body'), listFiles))).not.toContain('description-when');
  });

  test('flags one that omits when to use it', () => {
    const findings = lintSkill(root, skill('body', 'Extracts text and tables from PDF documents.'), listFiles);
    expect(rules(findings)).toContain('description-when');
  });

  test('flags first person, which breaks discovery from the system prompt', () => {
    const findings = lintSkill(root, skill('body', 'I can help you process PDFs. Use when the user mentions PDFs.'), listFiles);
    expect(rules(findings)).toContain('description-person');
  });
});

describe('links', () => {
  test('flags a link that resolves to nothing', () => {
    const findings = lintSkill(root, skill('See [references/gone.md](references/gone.md)'), listFiles);
    expect(rules(findings)).toContain('broken-link');
  });

  test('flags backslash paths, which break on unix', () => {
    const findings = lintSkill(root, skill('See [ref](references\\a.md)'), listFiles);
    expect(rules(findings)).toContain('path-separator');
  });

  test('flags a reference that links onward to another reference', () => {
    // Nested references get partially read, so the agent silently works from truncated content.
    ref('a.md', 'see [b.md](b.md)');
    ref('b.md', 'the actual content');
    const findings = lintSkill(root, skill('See [references/a.md](references/a.md)'), listFiles);
    expect(rules(findings)).toContain('nested-reference');
  });

  test('accepts references that are one level deep', () => {
    ref('a.md', 'content, no onward links');
    const findings = lintSkill(root, skill('See [references/a.md](references/a.md)'), listFiles);
    expect(rules(findings)).not.toContain('nested-reference');
  });

  test('ignores external URLs and anchors', () => {
    const findings = lintSkill(root, skill('[docs](https://example.com) and [top](#heading)'), listFiles);
    expect(rules(findings)).not.toContain('broken-link');
  });
});

describe('reference files', () => {
  test('warns when a long reference has no contents list', () => {
    ref('a.md', `# Long\n${'line\n'.repeat(120)}`);
    const findings = lintSkill(root, skill('See [references/a.md](references/a.md)'), listFiles);
    expect(rules(findings)).toContain('reference-toc');
  });

  test('accepts a long reference that has one', () => {
    ref('a.md', `# Long\n\n## Contents\n- a\n${'line\n'.repeat(120)}`);
    const findings = lintSkill(root, skill('See [references/a.md](references/a.md)'), listFiles);
    expect(rules(findings)).not.toContain('reference-toc');
  });

  test('warns about a file nothing links to', () => {
    ref('orphan.md', 'nobody points here');
    expect(rules(lintSkill(root, skill('body'), listFiles))).toContain('unreferenced-file');
  });
});

test('body over 500 lines must be split', () => {
  const findings = lintSkill(root, skill('x\n'.repeat(600)), listFiles);
  expect(rules(findings)).toContain('body-length');
});
