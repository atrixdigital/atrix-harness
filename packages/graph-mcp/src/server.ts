#!/usr/bin/env bun
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { callees, callers, context, impact, open, search, type SymbolRow } from '@atrix/graph-core';
import { renderAmbiguous, renderCallees, renderCallers, renderContext, renderImpact, renderSymbols } from './render.ts';

/**
 * The code graph, over MCP.
 *
 * Deliberately five tools, not twenty-eight. Models reason better over a small,
 * distinct tool surface, and every additional tool costs description tokens in every
 * session whether or not it is used. These five cover the questions that actually
 * precede an edit; anything rarer is better served by grep.
 */

const projectRoot = process.env.ATRIX_PROJECT_ROOT ?? process.cwd();
const dbPath = join(projectRoot, '.atrix', 'graph.db');

const text = (body: string) => ({ content: [{ type: 'text' as const, text: body }] });

function withDb<T>(fn: (db: ReturnType<typeof open>) => T): T | string {
  if (!existsSync(dbPath)) {
    return `No code graph at ${dbPath}. Run \`atrix index\` in ${projectRoot} first.`;
  }
  const db = open(dbPath);
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

/**
 * Resolve a human-supplied name to one declaration.
 *
 * Accepts "name" or "path:name" to disambiguate. Returns the candidate list rather
 * than guessing when a bare name is ambiguous — a wrong silent pick produces confident
 * nonsense downstream, which is the worst failure this tool can have.
 */
function resolve(db: ReturnType<typeof open>, query: string): SymbolRow | string {
  const lastColon = query.lastIndexOf(':');
  const hasPath = lastColon > 0;
  const name = hasPath ? query.slice(lastColon + 1) : query;
  const pathHint = hasPath ? query.slice(0, lastColon) : undefined;

  let matches = search(db, name, 50).filter((s) => s.name === name);
  if (matches.length === 0) matches = search(db, name, 50);
  if (matches.length === 0) return renderSymbols([], query);

  if (pathHint !== undefined) {
    const narrowed = matches.filter((s) => s.path.includes(pathHint));
    if (narrowed.length === 1) return narrowed[0] as SymbolRow;
    if (narrowed.length > 1) return renderAmbiguous(narrowed, query);
    return `No symbol "${name}" in a path containing "${pathHint}". Candidates:\n${renderSymbols(matches, name)}`;
  }

  if (matches.length === 1) return matches[0] as SymbolRow;

  // An exported declaration is almost always the one meant when the rest are local.
  const exported = matches.filter((s) => s.exported);
  if (exported.length === 1) return exported[0] as SymbolRow;

  return renderAmbiguous(matches.slice(0, 10), query);
}

const server = new McpServer({ name: 'atrix-graph', version: '0.1.0' });

server.tool(
  'atrix_search',
  'Find declarations by name across the repository. Use this before reading files — it answers "where is X" in one call. Returns kind, export status and location for each match.',
  { query: z.string().describe('Symbol name or fragment, e.g. "createBooking"'), limit: z.number().int().min(1).max(100).default(30) },
  ({ query, limit }) => text(withDb((db) => renderSymbols(search(db, query, limit), query)) as string),
);

server.tool(
  'atrix_context',
  'Everything about one symbol in a single call: what references it, what it references, and what else lives in its file. Use when reading unfamiliar code — it replaces several file reads.',
  { symbol: z.string().describe('Symbol name, or "path:name" when the name is ambiguous') },
  ({ symbol }) =>
    text(
      withDb((db) => {
        const found = resolve(db, symbol);
        if (typeof found === 'string') return found;
        const ctx = context(db, found.id);
        return ctx === undefined ? `Symbol ${symbol} vanished from the index — rerun \`atrix index\`.` : renderContext(ctx);
      }) as string,
    ),
);

server.tool(
  'atrix_callers',
  'What references this symbol. Use before changing or deleting anything shared, and to find usage examples of an unfamiliar function.',
  { symbol: z.string().describe('Symbol name, or "path:name"') },
  ({ symbol }) =>
    text(
      withDb((db) => {
        const found = resolve(db, symbol);
        return typeof found === 'string' ? found : renderCallers(callers(db, found.id));
      }) as string,
    ),
);

server.tool(
  'atrix_callees',
  'What this symbol references. Use to understand what a function depends on without reading its whole body and following imports by hand.',
  { symbol: z.string().describe('Symbol name, or "path:name"') },
  ({ symbol }) =>
    text(
      withDb((db) => {
        const found = resolve(db, symbol);
        return typeof found === 'string' ? found : renderCallees(callees(db, found.id));
      }) as string,
    ),
);

server.tool(
  'atrix_impact',
  'Transitive blast radius of changing a symbol — every dependent, grouped by distance, and the files involved. Run this BEFORE editing shared code; a surprising result is a signal to narrow the change.',
  {
    symbol: z.string().describe('Symbol name, or "path:name"'),
    depth: z.number().int().min(1).max(5).default(3).describe('How many edges to follow. 1 = direct dependents only.'),
  },
  ({ symbol, depth }) =>
    text(
      withDb((db) => {
        const found = resolve(db, symbol);
        if (typeof found === 'string') return found;
        const result = impact(db, found.id, depth);
        return result === undefined ? `Symbol ${symbol} vanished from the index — rerun \`atrix index\`.` : renderImpact(result);
      }) as string,
    ),
);

await server.connect(new StdioServerTransport());
