import { describe, expect, test } from 'bun:test';
import { danglingProvenance, incidentSchema, unfilledSections } from './incidents.ts';

const HARNESS = new URL('../../../..', import.meta.url).pathname;

describe('incident frontmatter', () => {
  const valid = { id: 'incident-0001', title: 'a real title', date: '2026-08-20', status: 'captured' };

  test('accepts a well-formed incident', () => {
    expect(incidentSchema.safeParse(valid).success).toBe(true);
  });

  test.each([
    ['id', { ...valid, id: 'incident-1' }],
    ['date', { ...valid, date: '20-08-2026' }],
    ['status', { ...valid, status: 'in-progress' }],
  ])('rejects a bad %s', (_field, payload) => {
    expect(incidentSchema.safeParse(payload).success).toBe(false);
  });
});

describe('unfilledSections', () => {
  const template = `## What happened

<!-- The observable failure. -->

## Why it happened

<!-- Root cause. -->

## What fixed it

<!-- The actual fix. -->
`;

  test('treats a section holding only template comments as empty', () => {
    // The trap this guards: a template looks filled in to a naive non-empty check.
    expect(unfilledSections(template)).toEqual(['What happened', 'Why it happened', 'What fixed it']);
  });

  test('accepts a section once it has prose', () => {
    const filled = template.replace('<!-- The observable failure. -->', 'The build failed on a type error.');
    expect(unfilledSections(filled)).toEqual(['Why it happened', 'What fixed it']);
  });

  test('reports a missing heading as unfilled', () => {
    expect(unfilledSections('## What happened\n\nsomething broke\n')).toEqual(['Why it happened', 'What fixed it']);
  });

  test('does not count an unticked checklist as prose', () => {
    const withChecklist = template.replace('<!-- The actual fix. -->', '- [ ] New rule\n- [ ] Nothing');
    expect(unfilledSections(withChecklist)).toContain('What fixed it');
  });
});

describe('danglingProvenance', () => {
  test('passes founding rules, which cite no incident', () => {
    expect(danglingProvenance(HARNESS, [{ path: 'core/rules/x.md', source: 'founding' }])).toEqual([]);
  });

  test('flags a citation that resolves to nothing', () => {
    const dangling = danglingProvenance(HARNESS, [{ path: 'core/rules/x.md', source: 'incident-9999' }]);
    expect(dangling).toHaveLength(1);
    expect(dangling[0]).toContain('incident-9999');
  });

  test('passes a citation that resolves', () => {
    expect(danglingProvenance(HARNESS, [{ path: 'core/rules/x.md', source: 'incident-0001' }])).toEqual([]);
  });
});
