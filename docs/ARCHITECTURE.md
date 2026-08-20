# Architecture

## The central constraint: agent-agnostic

Atrix engineers launch agents through [Orca](https://github.com/stablyai/orca), which runs 30+ CLI
agents in parallel git worktrees. Claude Code, Codex, Cursor, Gemini, Copilot and Grok all appear.
A Claude-Code-native harness would lock the org to one vendor and make every future agent a rewrite.

So: **`core/` is the source of truth, `adapters/` is generated output.**

```
core/            adapters/
  rules/     ──► claude/   .claude-plugin/marketplace.json + plugins/*
  methodology/   codex/    AGENTS.md + skills/
  skills/    ──► gemini/   GEMINI.md + skills/
  roles/         cursor/   .cursor/rules/*.mdc
  playbooks/     orca/     atrix-agents.json
```

`atrix build` runs the compilation. Adding an agent means writing one function in
`packages/cli/src/commands/build.ts` — not restructuring content.

**Never hand-edit `adapters/`.** `atrix build` deletes and regenerates it.

## Why markdown + frontmatter

Every agent can read markdown. The frontmatter is deliberately restricted to flat scalars and
inline lists (see `packages/cli/src/lib/frontmatter.ts`) — richer structures would not round-trip
into every target format, and the constraint is what keeps adapters cheap to write.

Zod schemas in `packages/cli/src/lib/core.ts` are the contract. If it validates there, every
adapter can emit it.

## The learning loop

```
 incident ──► candidate ──► PR review ──► merge ──► propagate ──► prune
 atrix learn  atrix distill   human        tag      atrix sync    evals
```

1. **Capture** (`atrix learn`) — writes `learning/incidents/incident-NNNN-*.md`. Raw and specific.
2. **Distill** (`atrix distill`, phase 2) — turns an incident into a concrete proposed diff, with
   the reasoning. Separate from capture on purpose: conflating them fills the rule library with
   one-off workarounds.
3. **Gate** — a PR. **Always human-reviewed.** This is read by every repo in the org; auto-merge
   is a way to poison all of them at once.
4. **Propagate** — merge, tag, `atrix sync` / `/plugin marketplace update`.
5. **Prune** — evals flag rules that no longer change any outcome. See RESEARCH.md §2.

### The provenance invariant

Every rule carries `source: incident-NNNN` (or `founding` for the initial set). Enforced by the
Zod schema, so `atrix build` and CI both reject a rule that cannot name what went wrong.

`core/rules/typescript-strict.md` is the worked example — it exists because of
`learning/incidents/incident-0001-*`, and you can read the failure that produced it.

## Graphs

| Graph | Status | Approach |
|---|---|---|
| Code | phase 3 | **Wrap** proven engines (LSP-over-MCP for symbols, tree-sitter+SQLite for call graph). Saturated category — writing another parser is not where our advantage is. |
| Dependency / impact | phase 6 | **Build.** Workspace packages ↔ migrations ↔ env vars ↔ service-to-service calls. Nothing off-the-shelf models this. |
| Information | phase 6 | **Build.** Knowledge, handoffs, ADRs and `learning/` itself, as a queryable graph. |
| Source (org-wide) | phase 6 | **Build the federation.** Nightly CI indexes every `atrixdigital` repo → release artifact → `atrix sync`. Nobody indexes 25 repos locally. |

Indexes live at `.atrix/graph.db` in each repo and are gitignored — always local, never committed.

**Semantic search is opt-in.** `semantic.provider` is `null` by default in `.atrix/config.json`.
Most Atrix repos are private client work; code chunks must never reach an embedding API without an
explicit decision. Adapters planned for Ollama (local), Voyage and OpenAI.

## Phases

| | | Status |
|---|---|---|
| 0 | Spine — `AGENTS.md`, CLI, adapter generator, seed core | **done** |
| 1 | Core harness — full rule set, roles, hooks, tool budgets | next |
| 2 | Learning loop — `distill`, PR gate, provenance CI | |
| 3 | Code graph — MCP wiring, `atrix index`, incremental watch | |
| 4 | Skill library — template, linter, harvest, write the taxonomy | |
| 5 | Playbooks — the six orchestration patterns, file-based handoffs | |
| 6 | Remaining graphs — dependency, information, org-wide source | |
| 7 | Evals, docs, rollout | |

Phase 2 is deliberately early: once the loop runs, every later phase feeds itself.

## Decisions worth knowing

**`AGENTS.md` is capped at 60 lines** and `atrix doctor` fails past it. A manual nobody reads does
nothing. It is a pilot's checklist, not a style guide.

**Success is silent, failure is verbose.** See `packages/cli/src/lib/log.ts`. A harness that
narrates every success trains people to ignore it.

**No auto-merge of learned candidates**, and no automatic pushes into team repos. Both are
deliberate and both are in "out of scope" rather than "not yet".
