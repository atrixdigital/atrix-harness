# atrix-harness

The Atrix agent operating system — rules, methodology, skills, code graphs and orchestration
patterns that every Atrix engineer's agent starts from, whichever agent that is.

**One core, every agent.** Everything lives once in `core/` as plain markdown. `atrix build`
compiles it into native packaging for Claude Code, Codex, Cursor, Gemini and Orca. Adding a new
agent is an adapter, not a rewrite.

**It compounds.** The harness watches itself work: a hook records a redacted shape of every tool
result, and `atrix observe` surfaces failures that keep recurring. Those, plus anything a human
flags with `atrix learn`, get distilled, reviewed and merged into rules everyone gets. Every rule
carries the incident that produced it — and rules that stop mattering get pruned. A harness that
only grows is a harness that rots.

---

## Install

```bash
git clone https://github.com/atrixdigital/atrix-harness.git
cd atrix-harness && bun install && bun run atrix build
```

Add to your shell so `atrix` works from any repo:

```bash
export ATRIX_HOME="$HOME/path/to/atrix-harness"
alias atrix="bun run $ATRIX_HOME/packages/cli/src/index.ts"
```

### Claude Code

```
/plugin marketplace add <path-to>/atrix-harness/adapters/claude
/plugin install atrix-core@atrix-harness
/plugin install atrix-skills@atrix-harness
```

### Codex, Gemini, Cursor

Point the agent at the generated bundle — `adapters/codex/AGENTS.md`,
`adapters/gemini/GEMINI.md`, or copy `adapters/cursor/.cursor/` into the repo.

### Any repo

```bash
cd ~/your-project
atrix init      # AGENTS.md, CLAUDE.md, .atrix/config.json, and the graph MCP server
atrix index     # build the code graph
```

`init` merges into an existing `.mcp.json` rather than replacing it, never overwrites an
`AGENTS.md` you already have, and records which harness commit you started from.

### Staying current

```bash
atrix sync      # pull the harness, rebuild adapters, and print what it learned
```

`atrix doctor` tells you when your repo is behind:

```
✗ harness up to date — 3 harness commit(s) behind — run `atrix sync`
```

---

## Commands

| | |
|---|---|
| `atrix build` | Regenerate `adapters/` from `core/` |
| `atrix init` | Scaffold the current repo to use the harness |
| `atrix doctor` | Check everything is wired up |
| `atrix lint` | Check skills against the authoring rules |
| `atrix index` | Build this repo's code graph |
| `atrix env` | Audit env vars — reads, definitions, conflicts (never prints values) |
| `atrix recall <question>` | Ask why something is the way it is |
| `atrix observe` | Mine the local trace for recurring failure patterns |
| `atrix learn "<what bit you>"` | Capture an incident — the start of the loop |
| `atrix distill [id]` | Turn an incident into a reviewable change |
| `atrix eval` | Which layers are measured (free); `--run` to measure them |

`sync` and `eval` land in later phases — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## The code graph

`atrix index` builds a local index of your repo — declarations and the edges between them — and
`atrix-graphs` serves it over MCP as five tools: `atrix_search`, `atrix_context`, `atrix_callers`,
`atrix_callees`, `atrix_impact`.

Ask "what breaks if I change this" in one call instead of a dozen file reads:

```
atrix_impact createBooking
→ Changing createBooking affects 23 symbols across 11 files.
  Direct dependents (6): ...
```

Built on the TypeScript compiler API, so resolution is real rather than heuristic — it follows
imports, re-exports and generics. 436 files index in under 5 seconds. The index is local and
gitignored; nothing leaves your machine.

---

## Layout

```
AGENTS.md         the operating manual every agent reads — capped at 60 lines
UNDERSTANDINGS.md how this codebase actually works, and why — descriptive, append-only
core/          the portable source of truth: rules, methodology, skills, roles, playbooks
graphs/        code, dependency, information and org-wide source graphs (served over MCP)
learning/      incidents → candidates → merged rules. The compounding loop.
adapters/      GENERATED per-agent packaging. Never hand-edited.
packages/      the atrix CLI, graph engine and MCP server
evals/         measures which harness layers still earn their place
```

## Contributing

**Rule or skill?** Rules load in every session forever; skills load only when relevant. If a
practice applies to every task, it is a rule. If it applies when doing one *kind* of task —
designing an API, running a migration, writing a form — it is a skill. When in doubt, skill.

Add a rule only when you can name the incident behind it — CI enforces the `source:` field — and
give it an `expires_when` if you can say what would make it obsolete.

Edit `core/`, never `adapters/`. Run `atrix build && atrix lint && bun test && bun run typecheck`
before opening a PR.

Why any of this is shaped the way it is: [docs/RESEARCH.md](docs/RESEARCH.md).
