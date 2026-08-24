import type { Context, EdgeRow, Impact, SymbolRow } from '@atrix/graph-core';

/**
 * Rendering for agent consumption.
 *
 * These results are read by a model, so the format is the product. JSON would be
 * correct and roughly twice the tokens for the same information — braces, quotes and
 * repeated keys on every row. Compact lines carry the same facts and read better.
 *
 * The rule throughout: every line must be actionable without a follow-up call.
 */

/**
 * Include the project only when it disambiguates. A workspace search returning
 * `playo-web/src/a.ts` and `ezrov/src/a.ts` is unreadable without it; a single-project
 * result prefixed with the same name on every line is noise.
 */
const loc = (s: SymbolRow): string =>
  s.project === '' || s.project === '.harness' ? `${s.path}:${s.line}` : `${s.project}/${s.path}:${s.line}`;

export function renderSymbols(rows: SymbolRow[], term: string): string {
  if (rows.length === 0) {
    return `No symbol matching "${term}". Try a shorter term, or grep — it may be a string, a route path, or in a language the index does not cover.`;
  }

  const lines = rows.map((s) => `${s.name}  ${s.kind}${s.exported ? ' exported' : ''}  ${loc(s)}`);
  return `${rows.length} match${rows.length === 1 ? '' : 'es'} for "${term}":\n${lines.join('\n')}`;
}

function renderEdges(rows: EdgeRow[], heading: string, empty: string): string {
  if (rows.length === 0) return `${heading}: ${empty}`;
  const lines = rows.map((r) => `  ${r.edge.padEnd(10)} ${r.name} (${r.kind})  at ${r.atPath}:${r.atLine}`);
  return `${heading} (${rows.length}):\n${lines.join('\n')}`;
}

export const renderCallers = (rows: EdgeRow[]): string =>
  renderEdges(rows, 'Referenced by', 'nothing in this repo references it — it may be dead, an entry point, or reached dynamically');

export const renderCallees = (rows: EdgeRow[]): string =>
  renderEdges(rows, 'References', 'nothing — it is a leaf');

export function renderContext(ctx: Context): string {
  const { symbol } = ctx;
  const parts = [
    `${symbol.name}  ${symbol.kind}${symbol.exported ? ' exported' : ''}  ${loc(symbol)}`,
    '',
    renderCallers(ctx.callers),
    '',
    renderCallees(ctx.callees),
  ];

  if (ctx.siblings.length > 0) {
    parts.push('', `Also in ${symbol.path}:`, ctx.siblings.map((s) => `  ${s.name} (${s.kind}) :${s.line}`).join('\n'));
  }

  return parts.join('\n');
}

export function renderImpact(result: Impact): string {
  if (result.nodes.length === 0) {
    return `${result.symbol.name} (${loc(result.symbol)}) has no dependents in this repo. Safe to change locally — but check for dynamic access and external consumers.`;
  }

  const byDepth = new Map<number, string[]>();
  for (const node of result.nodes) {
    const list = byDepth.get(node.depth) ?? [];
    list.push(`${node.name} (${node.kind}) ${loc(node)}`);
    byDepth.set(node.depth, list);
  }

  const sections = [...byDepth.entries()]
    .sort(([a], [b]) => a - b)
    .map(([depth, names]) => {
      const label = depth === 1 ? 'Direct dependents' : `Depth ${depth}`;
      return `${label} (${names.length}):\n${names.map((n) => `  ${n}`).join('\n')}`;
    });

  const header = `Changing ${result.symbol.name} (${loc(result.symbol)}) affects ${result.nodes.length} symbol(s) across ${result.files.length} file(s).`;
  const footer = result.truncated
    ? '\n\nTRUNCATED — the blast radius exceeds the reporting limit. Treat this as a wide-reaching change and reduce the scope of the edit.'
    : '';

  return `${header}\n\n${sections.join('\n\n')}${footer}`;
}

/**
 * When a name matches several declarations, say so rather than silently picking one.
 * A graph tool that guesses is worse than grep, because the agent trusts it.
 */
export function renderAmbiguous(rows: SymbolRow[], term: string): string {
  const lines = rows.map((s, i) => `  ${i + 1}. ${s.name} (${s.kind}) ${loc(s)}`);
  return `"${term}" matches ${rows.length} declarations — narrow it by passing "path:name", e.g. "${rows[0]?.path}:${term}":\n${lines.join('\n')}`;
}
