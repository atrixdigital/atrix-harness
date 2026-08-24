# Understandings — atrix-harness

How this codebase actually works, and why. **Descriptive, not prescriptive** — rules live in
[AGENTS.md](./AGENTS.md); this is what is already true.

Append entries; never rewrite one. When an understanding is overtaken, mark it superseded and add
a new entry — the record of what the team used to believe explains code written under that belief.

See the `recording-understanding` skill for when an entry is worth writing.

---

## `adapters/` is generated output that is nonetheless committed

**Date:** 2026-08-24
**Confidence:** confirmed
**From:** `packages/cli/src/commands/build.ts`, `.github/workflows/ci.yml`

Normally generated output is gitignored. Here it is committed, because a consumer installing the
Claude plugin gets the repo as-is and cannot be asked to run a build step first.

That choice has two consequences the code defends against:

- It drifts silently from `core/`. CI reruns `atrix build` and fails on any diff
  (`learning/incidents/incident-0002`).
- Anything machine-specific in it breaks for everyone else. `write()` in `build.ts` refuses to
  emit a home directory or machine-local temp path (`incident-0003`).

Ruled out: making adapters a release artifact instead. It would remove both problems and add a
release step to every rule change, which for a repo whose whole point is frequent small rule
changes is the wrong trade.

## The MCP server resolves `${ATRIX_HOME}` at launch, not at build

**Date:** 2026-08-24
**Confidence:** confirmed
**From:** `packages/cli/src/commands/build.ts` `mcpConfig()`, `packages/graph-mcp/src/server.ts`

`.mcp.json` contains a literal `${ATRIX_HOME}` string. The agent runtime expands it when it spawns
the server, which is why the config can be committed and shared.

The server then reads `.atrix/graph.db` **relative to its working directory**, not to
`ATRIX_HOME` — that is how one server binary serves whichever repo the agent is working in.
`ATRIX_PROJECT_ROOT` overrides it when the cwd is not the project.

The consequence: if `ATRIX_HOME` is unset, the tools fail at launch with a path that looks
malformed rather than a clear "not configured" error. `atrix init` prints the export line for
this reason.

## The code graph indexes TypeScript with the compiler API, not tree-sitter

**Date:** 2026-08-24
**Confidence:** confirmed
**From:** `packages/graph-core/src/indexer.ts`, plus indexing ezrov (436 files, 4.7s)

The original plan was to wrap a tree-sitter engine. Surveying the repos changed it: authored code
across Atrix is ~99% TypeScript (the Swift is CocoaPods, the Python is a venv). Tree-sitter buys
breadth at the cost of heuristic resolution; the compiler API resolves through imports,
re-exports and generics because it *is* the typechecker's resolver.

Two non-obvious mechanisms hold it together:

- **Every file gets a `module` symbol at offset `-1`.** Top-level code — route registration,
  middleware wiring — has no enclosing declaration, so without a module symbol those edges are
  silently dropped. `-1` because offset `0` is a real position that collides with a file starting
  `export function`.
- **Discovery unions every `tsconfig.json`, not the nearest one.** Most Atrix repos are monorepos
  with no root config. Falling back to a glob loses module resolution and therefore most
  cross-file edges — measured at 422 edges versus 2,047 on the same repo.

## The rule bundle has a context budget; skills do not

**Date:** 2026-08-24
**Confidence:** confirmed
**From:** `packages/cli/src/commands/doctor.ts`, measured across two commits

Codex and Gemini load every rule at session start with no progressive disclosure. Skills load only
when their description matches. Measured: adding one rule cost 625 tokens in every session
forever; adding three skills of substantially more content cost zero.

This is why `doctor` fails past ~12,000 tokens of bundle, and why the answer when it trips is
almost always "this should have been a skill".

## The learning loop has two inputs, and the automated one is the important half

**Date:** 2026-08-24
**Confidence:** confirmed
**From:** `core/hooks/record-trace.ts`, `packages/cli/src/commands/observe.ts`

`atrix learn` depends on a human noticing. That catches failures people register and misses the
ones they absorb — somebody who has hit the same failure eleven times stopped noticing at the
fourth.

The `PostToolUse` hook records a redacted shape of every tool result; `atrix observe` clusters
recurring failures and ranks patterns recurring across days above single-day bursts, because a bad
afternoon is noise and a week is a harness gap.

`observe` deliberately proposes rather than writes. Automatic incident creation fills the loop
with churn nobody triages.

## Verification never reads agent output, anywhere in this repo

**Date:** 2026-08-24
**Confidence:** confirmed
**From:** `packages/eval/src/verify.ts`, `core/roles/evaluator.md`, `core/methodology/testing-policy.md`

Every check re-runs a command or re-reads a file. This is not stylistic: long-horizon coding
agents demonstrably weaken tests, special-case known inputs and delete assertions, and a keyword
probe on an agent's own summary passes all of it.

The eval framework additionally hashes files listed under `integrity.unchanged` and fails the case
on any modification **regardless of whether the assertions passed** — especially then, because a
green suite plus an edited test is exactly what a successful reward hack looks like.

Proven against a recording of an agent doing precisely that, since a real one cannot be asked to
cheat on demand.
