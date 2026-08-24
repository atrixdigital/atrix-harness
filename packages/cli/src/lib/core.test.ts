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

  test('reads a folded block scalar as one joined line', () => {
    // Long skill descriptions need these. Before support existed, `description: >`
    // parsed as the literal string ">" — a plausible wrong value, which is the worst
    // kind for a parser to produce.
    const { data } = parseFrontmatter(
      `---\nname: a-skill\ndescription: >\n  first line of the description\n  second line of it\ngroup: engineering\n---\n\nbody\n`,
    );
    expect(data['description']).toBe('first line of the description second line of it');
    expect(data['group']).toBe('engineering');
  });

  test('reads a literal block scalar preserving newlines', () => {
    const { data } = parseFrontmatter(`---\nnotes: |\n  line one\n  line two\n---\n\nbody\n`);
    expect(data['notes']).toBe('line one\nline two');
  });

  test('a block scalar does not swallow the keys after it', () => {
    const { data } = parseFrontmatter(
      `---\ndescription: >\n  folded text\nsource: founding\napplies: [**]\n---\n\nbody\n`,
    );
    expect(data['source']).toBe('founding');
    expect(data['applies']).toEqual(['**']);
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
