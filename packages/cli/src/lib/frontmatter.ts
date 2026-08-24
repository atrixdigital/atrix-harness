/**
 * Minimal YAML-frontmatter reader.
 *
 * Deliberately not a full YAML parser: frontmatter here is a flat map of scalars,
 * simple inline lists, and block scalars. A real YAML dependency would let contributors
 * write structures the adapters cannot round-trip into every agent's format.
 *
 * Block scalars (`key: >` folded, `key: |` literal) are supported because long
 * descriptions genuinely need them — a skill description can run to 1,024 characters and
 * forcing that onto one line makes it unreadable and unreviewable in a diff.
 *
 * Anything else unsupported becomes an empty value, which schema validation rejects
 * loudly. That is the point: this parser must never silently produce a *plausible wrong*
 * value. It previously read `description: >` as the literal string ">" — valid-looking,
 * one character long, and only caught because a length check happened to exist.
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
  const lines = (match[1] ?? '').split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i] ?? '';
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;

    const sep = line.indexOf(':');
    if (sep === -1) continue;

    const key = line.slice(0, sep).trim();
    let value = line.slice(sep + 1).trim();
    if (key === '') continue;

    // Block scalar: gather the indented lines that follow.
    if (value === '>' || value === '|') {
      const folded = value === '>';
      const body: string[] = [];
      while (i + 1 < lines.length) {
        const next = lines[i + 1] ?? '';
        if (next.trim() !== '' && !/^\s/.test(next)) break;
        body.push(next.trim());
        i += 1;
      }
      while (body.length > 0 && body[body.length - 1] === '') body.pop();
      data[key] = folded ? body.join(' ').trim() : body.join('\n').trim();
      continue;
    }

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
