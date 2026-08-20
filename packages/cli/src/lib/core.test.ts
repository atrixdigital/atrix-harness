import { describe, expect, test } from 'bun:test';
import { ruleSchema, skillSchema } from './core.ts';
import { parseFrontmatter, stringifyFrontmatter } from './frontmatter.ts';

describe('frontmatter', () => {
  test('parses scalars, quoted values and inline lists', () => {
    const { data, body } = parseFrontmatter(
      `---\nname: a-rule\ndescription: "has: a colon"\napplies: [src/**, test/**]\n---\n\nbody text\n`,
    );
    expect(data['name']).toBe('a-rule');
    expect(data['description']).toBe('has: a colon');
    expect(data['applies']).toEqual(['src/**', 'test/**']);
    expect(body.trim()).toBe('body text');
  });

  test('returns the whole document as body when there is no frontmatter', () => {
    const { data, body } = parseFrontmatter('# just markdown\n');
    expect(data).toEqual({});
    expect(body).toBe('# just markdown\n');
  });

  test('round-trips through stringify', () => {
    const original = { name: 'x-y', applies: ['**'] };
    const { data } = parseFrontmatter(stringifyFrontmatter(original, 'body'));
    expect(data).toEqual(original);
  });
});

describe('rule provenance', () => {
  const base = { name: 'a-rule', description: 'a description long enough to pass' };

  test('accepts an incident reference', () => {
    expect(ruleSchema.safeParse({ ...base, source: 'incident-0001' }).success).toBe(true);
  });

  test('accepts the founding marker', () => {
    expect(ruleSchema.safeParse({ ...base, source: 'founding' }).success).toBe(true);
  });

  test('rejects a rule with no provenance at all', () => {
    // The whole invariant: a rule that cannot name what went wrong does not belong.
    expect(ruleSchema.safeParse(base).success).toBe(false);
  });

  test('rejects a hand-waved provenance string', () => {
    expect(ruleSchema.safeParse({ ...base, source: 'because I said so' }).success).toBe(false);
  });

  test('defaults applies to everything', () => {
    const parsed = ruleSchema.parse({ ...base, source: 'founding' });
    expect(parsed.applies).toEqual(['**']);
  });
});

describe('naming', () => {
  test.each([
    ['ship-a-feature', true],
    ['tdd', true],
    ['Ship-A-Feature', false],
    ['ship_a_feature', false],
    ['-leading', false],
  ])('%s is valid: %p', (name, valid) => {
    const result = skillSchema.safeParse({
      name,
      description: 'a description that is comfortably long enough to satisfy the minimum',
      group: 'engineering',
    });
    expect(result.success).toBe(valid);
  });
});
