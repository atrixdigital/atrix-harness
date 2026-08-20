/**
 * Minimal YAML-frontmatter reader.
 *
 * Deliberately not a full YAML parser: frontmatter in this repo is a flat map of
 * scalars and simple inline lists, and that constraint is enforced by the linter.
 * A real YAML dependency would let contributors write structures the adapters
 * cannot round-trip into every agent's format.
 */

export interface Parsed {
  data: Record<string, string | string[]>;
  body: string;
}

const FM = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseFrontmatter(source: string): Parsed {
  const match = FM.exec(source);
  if (!match) return { data: {}, body: source };

  const data: Record<string, string | string[]> = {};
  const block = match[1] ?? '';

  for (const rawLine of block.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;

    const sep = line.indexOf(':');
    if (sep === -1) continue;

    const key = line.slice(0, sep).trim();
    let value = line.slice(sep + 1).trim();
    if (key === '') continue;

    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }

    if (value.startsWith('[') && value.endsWith(']')) {
      data[key] = value
        .slice(1, -1)
        .split(',')
        .map((v) => v.trim().replace(/^["']|["']$/g, ''))
        .filter((v) => v !== '');
      continue;
    }

    data[key] = value;
  }

  return { data, body: source.slice(match[0].length) };
}

export function stringifyFrontmatter(data: Record<string, string | string[]>, body: string): string {
  const lines = Object.entries(data).map(([k, v]) =>
    Array.isArray(v) ? `${k}: [${v.join(', ')}]` : `${k}: ${v}`,
  );
  return `---\n${lines.join('\n')}\n---\n\n${body.replace(/^\n+/, '')}`;
}
