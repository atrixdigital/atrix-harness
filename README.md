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

Clone the harness. **This is your workspace** — launch your agent here, and keep every project
inside it.

```bash
git clone https://github.com/atrixdigital/atrix-harness.git
cd atrix-harness && bun install && bun run atrix build

export ATRIX_HOME="$PWD"
alias atrix="bun run $ATRIX_HOME/packages/cli/src/index.ts"
```

Then bring your projects in. They stay independent repos and are gitignored here, so client code
never merges into the shared harness:

```bash
git clone git@github.com:you/playo-web.git projects/playo-web
atrix index --all        # one index across every project
```

```
atrix-harness/          ← launch Claude, Codex or Orca here
├── AGENTS.md           the manual every agent reads
├── core/               rules, skills, roles          shared
├── learning/           incidents                     shared
├── .atrix/             index, traces                 yours only, gitignored
└── projects/           gitignored
    ├── playo-web/      its own git remote
    └── ezrov/          its own git remote
```

Searches scope to whichever project you are in; `allProjects` spans the workspace, so
"has anyone already solved this" is answerable across every repo at once.

### Claude Code

```
/plugin marketplace add ./adapters/claude
/plugin install atrix-core@atrix-harness
/plugin install atrix-skills@atrix-harness
/plugin install atrix-graphs@atrix-harness
```

### Codex, Gemini, Cursor

Point the agent at `adapters/codex/AGENTS.md`, `adapters/gemini/GEMINI.md`, or copy
`adapters/cursor/.cursor/` into place. `adapters/*/mcp.json` carries the graph server.

### Staying current

```bash
atrix sync      # pull the harness, rebuild adapters, print what it learned
```

`atrix doctor` tells you when you are behind.

---

## Commands

| | |
|---|---|
| `atrix status` | Everything at a glance — content, learning, graphs, coverage |
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

Read **[CONTRIBUTING.md](CONTRIBUTING.md)** — most of it is about what *not* to add.

The short version: edit `core/`, never `adapters/`. A practice that applies to every task is a
rule; one that applies to a kind of task is a skill; one that applies to a single repo belongs in
that repo. Every rule names the incident behind it, and CI enforces that the citation resolves.

```bash
bun run atrix build && bun run atrix doctor && bun run atrix lint && bun run atrix eval
bun test && bun x tsc --noEmit
```

Why any of this is shaped the way it is: [docs/RESEARCH.md](docs/RESEARCH.md).
How it fits together: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
