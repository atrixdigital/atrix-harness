---
id: incident-0009
title: the graph MCP server never started, on any machine
date: 2026-08-26
status: merged
cost: 50m
---

## What happened

A user reported "atrix graph is not working". It was not working for anybody, and had never
worked outside a shell where someone had manually exported a variable.

Two independent bugs, both silent.

## 1 · The server could not be located

The generated MCP config was:

```json
{ "command": "bun", "args": ["run", "${ATRIX_HOME}/packages/graph-mcp/src/server.ts"] }
```

`ATRIX_HOME` is set by nothing. `atrix init` **printed** the export as a suggested next step and
moved on. With it unset the path resolved to `/packages/graph-mcp/src/server.ts` and bun failed:

```
error: Module not found "/packages/graph-mcp/src/server.ts"
```

That failure happens before any of our code runs, so nothing could report it. From the agent's side
there was no error — the seven graph tools simply did not exist, and it fell back to reading files.

## 2 · The database was looked for in the wrong directory

Even with the variable set, the server resolved the index from the working directory:

```ts
const dbPath = join(process.cwd(), '.atrix', 'graph.db');
```

There is **one workspace index**, at `<harness>/.atrix/graph.db`. All real work happens in
`projects/<name>`, one level down — where that path does not exist. So every query from a project
answered "No code graph. Run `atrix index` first", while a populated 315KB index sat one directory
up.

The same assumption broke scoping: `activeProject` read `ATRIX_PROJECT`, also set by nothing, so
queries that did run were silently unscoped across every repo in the workspace.

## Root cause

**Three environment variables, none of them set by anything, each failing silently.** The design
required every engineer to configure their shell correctly and gave no signal when they had not.

## The fix

- `core/mcp/launch.ts` — the config now names a launcher, not the server. It resolves the harness
  from `$ATRIX_HOME`, then by walking up from the working directory, then from its own location,
  and **prints what to do** when it cannot. The plugin config uses `${CLAUDE_PLUGIN_ROOT}`, which
  the runtime always expands.
- The server derives the workspace by walking up for `.atrix/graph.db`, and derives the active
  project from its position under `projects/`. Both work with **no environment variables at all**.
- `atrix init` writes an absolute path into the project-local `.mcp.json`. That file is gitignored,
  so a machine-specific path is correct there — [[incident-0003]] was about paths baked into
  *committed* adapters, which is a different thing.

## Why nothing caught it

`atrix doctor` had nine checks. One was "code graph indexed", which tests that a **file exists**.
None asked whether a query **returns an answer**. `atrix verify --live` probed rules, hooks and
skills — not the graph.

Two tests actively encoded the bug: they asserted the config *must* contain `${ATRIX_HOME}` and
that the path existed relative to the repo root. Both passed. Both were wrong.

Added: a `graph tools respond` doctor check that starts the server over stdio **with ATRIX_HOME
deliberately removed** and counts the tools it lists. Confirmed red by reintroducing the original
bug, green after reverting.

## The rule

**A check that an artifact exists is not a check that it works.** For anything with a runtime — a
server, a hook, a plugin — the check must exercise the runtime and assert on its output.

And: **configuration that depends on a human remembering a step is a defect, not a prerequisite.**
If it can be discovered, discover it; if it cannot, fail loudly with the fix in the message.

Same family as [[incident-0007]] — a delivery path that was structurally perfect and inert — and
[[incident-0008]], where a renamed convention compiled and never ran.
