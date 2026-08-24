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
 trace ──────┐
 atrix observe│
              ├─► incident ──► candidate ──► PR review ──► merge ──► propagate ──► prune
 a human ─────┘   atrix learn  atrix distill   human       tag      atrix sync    evals
 noticing
```

The loop has **two inputs**, and the second one is the important one. A human noticing catches the
failures people register; it misses the ones they absorb — and someone who has hit the same failure
eleven times stopped noticing at the fourth. A `PostToolUse` hook records a redacted shape of every
tool result to `.atrix/trace.jsonl`, and `atrix observe` clusters recurring failures into
candidates. Observability-driven harness evolution reports 5–15% gains over intuition-driven
(RESEARCH.md §6d).

`observe` proposes and stops. It never writes an incident — automatic capture fills the loop with
churn nobody triages, and a rule reaching every repo in the org needs a human.

1. **Capture** (`atrix learn`) — writes `learning/incidents/incident-NNNN-*.md`. Raw and specific.
2. **Distill** (`atrix distill`, phase 2) — turns an incident into a concrete proposed diff, with
   the reasoning. Separate from capture on purpose: conflating them fills the rule library with
   one-off workarounds.
3. **Gate** — a PR. **Always human-reviewed.** This is read by every repo in the org; auto-merge
   is a way to poison all of them at once.
4. **Propagate** — `atrix sync` fast-forwards the harness, rebuilds the adapters, and prints the
   new `learning/CHANGELOG.md` entries, because an update nobody reads is an update nobody applies.
   Consuming repos record the harness commit they were initialised against, so `atrix doctor`
   reports drift (`3 harness commit(s) behind`) instead of leaving a repo silently running a
   months-old rule set. `sync` refuses a dirty checkout — silently stashing someone's in-progress
   rule edit to fetch a different one is not a trade this tool gets to make.
5. **Prune** — evals flag rules that no longer change any outcome. See RESEARCH.md §2.

### The provenance invariant

Every rule carries `source: incident-NNNN` (or `founding` for the initial set). Enforced by the
Zod schema, so `atrix build` and CI both reject a rule that cannot name what went wrong.

`core/rules/typescript-strict.md` is the worked example — it exists because of
`learning/incidents/incident-0001-*`, and you can read the failure that produced it.

## Four artefacts, four questions

Contributions land in the wrong place when these blur together.

| Artefact | Answers | Scope | Direction |
|---|---|---|---|
| `AGENTS.md` | What should I do? | per repo | prescriptive |
| `UNDERSTANDINGS.md` | How does this actually work, and why? | per repo | **descriptive** |
| `learning/incidents/` | What went wrong, for everyone? | org-wide | prescriptive |
| `handoffs/` | Where is this work right now? | one task | temporary |

`UNDERSTANDINGS.md` is the one that did not exist before and is easiest to under-rate. The code
graph tells you what calls what; it cannot tell you *why the retry lives in the consumer instead
of the producer*, or that a second cron exists because the first silently stopped firing. Without
somewhere to put that, every session re-derives it.

Entries are append-only and carry three fields that do the work: **confidence**
(`confirmed` means something was executed or the definitive code was read — an entry marked
`uncertain` gets checked, a wrong entry marked `confirmed` gets trusted), **from** (specific
enough to re-verify; an understanding you cannot re-check is a rumour), and **date** (they go
stale, and an undated one cannot be judged). Superseded entries are marked, never deleted — the
record of what the team used to believe explains code written under that belief.

This repo's own [UNDERSTANDINGS.md](../UNDERSTANDINGS.md) is the worked example.

## Rule or skill? The decision that keeps this sustainable

The most common contribution mistake is writing a rule for something that should be a skill.

|  | Rules (`core/rules/`, `core/methodology/`) | Skills (`core/skills/`) |
|---|---|---|
| **Loaded** | Every session, always | Only when the description matches the task |
| **Costs** | Tokens in every session forever | ~100 tokens of metadata until used |
| **Size** | Keep tight — the bundle is capped | Up to 500 lines, plus unlimited references |
| **For** | Things true of *every* task | Things true when doing *one kind* of task |

> *"Don't swallow errors"* applies to every line of code anyone writes → **rule**.
> *"How to design a paginated endpoint"* applies only when designing an endpoint → **skill**.

A concrete demonstration: adding `failure-design` (one rule) cost **+625 tokens in every session
forever**. Adding `changing-data-safely`, `secure-coding` and `designing-apis` — three skills,
substantially more content — cost **zero**. They load when relevant and are invisible otherwise.

So the test for a proposed rule is: **would an agent doing a completely unrelated task still need
to know this?** If not, it is a skill. If it only matters in one repo, it belongs in that repo's
own `AGENTS.md`, not here.

The budget check in `atrix doctor` exists to force this conversation. When it trips, the answer is
almost always that a rule should have been a skill.

## Graphs

| Graph | Status | Approach |
|---|---|---|
| Code | **done** | **Built** on the TypeScript compiler API + `bun:sqlite`. See the reversal below. |
| Dependency / impact | phase 6 | **Build.** Workspace packages ↔ migrations ↔ env vars ↔ service-to-service calls. Nothing off-the-shelf models this. |
| Information | phase 6 | **Build.** Knowledge, handoffs, ADRs and `learning/` itself, as a queryable graph. |
| Source (org-wide) | phase 6 | **Build the federation.** Nightly CI indexes every `atrixdigital` repo → release artifact → `atrix sync`. Nobody indexes 25 repos locally. |

### Why we built the code graph instead of wrapping one

The original plan was to wrap a proven tree-sitter engine, on the reasoning that the category is
saturated and writing another parser is not where our advantage lies. A survey of the actual repos
reversed it: **the authored code across every Atrix repo is ~99% TypeScript** (the Swift is
CocoaPods, the Python is a venv and one small module).

That changes the trade completely. Tree-sitter buys breadth — 150+ languages — at the cost of
heuristic resolution: it sees `foo()` but cannot always say *which* `foo`. The TypeScript compiler
API resolves through imports, re-exports, generics and overloads because it is the same resolver
the typechecker uses. For a TypeScript monorepo, **correct beats broad** — and it costs no native
dependency, no solo-maintained pre-1.0 dependency, and no supply-chain bet.

Measured on `ezrov` (436 files): 3,507 symbols and 2,047 edges in **4.7s**, with cross-file edges
outnumbering same-file ones. The most-depended-on symbol came back as the Kysely `Database`
interface with 128 dependents — which is exactly right for that codebase.

The seam for other languages is file discovery plus a second extractor writing the same tables.
Nothing above `packages/graph-core/src/indexer.ts` needs to change.

**Five MCP tools, not twenty-eight.** `atrix_search`, `atrix_context`, `atrix_callers`,
`atrix_callees`, `atrix_impact`. Models reason better over a small distinct surface, and every tool
costs description tokens in every session whether used or not. Results render as compact lines
rather than JSON — roughly half the tokens for the same facts.

Indexes live at `.atrix/graph.db` in each repo and are gitignored — always local, never committed.

**Semantic search is opt-in.** `semantic.provider` is `null` by default in `.atrix/config.json`.
Most Atrix repos are private client work; code chunks must never reach an embedding API without an
explicit decision. Adapters planned for Ollama (local), Voyage and OpenAI.

## Phases

| | | Status |
|---|---|---|
| 0 | Spine — `AGENTS.md`, CLI, adapter generator, seed core | **done** |
| 1 | Core harness — full rule set, roles, hooks, tool budgets | **done** |
| 2 | Learning loop — `distill`, PR gate, provenance CI | next |
| 3 | Code graph — indexer, query layer, MCP server | **done** |
| 4 | Skill library — template, linter, harvest, write the taxonomy | next (linter done) |
| 5 | Playbooks — the six orchestration patterns, file-based handoffs | |
| 6 | Remaining graphs — dependency, information, org-wide source | |
| 7 | Evals — framework, ablation, anti-gaming | **done** (1 case) |

Phase 2 is deliberately early: once the loop runs, every later phase feeds itself.

## Evals: measuring which layers earn their place

Everything in `core/` is well-reasoned. That is not the same as measured, and the gap is the point
of `evals/`.

**The unit is a paired difference, not a pass rate.** "The harness scores 80%" is unfalsifiable.
"Removing `secure-coding` drops this case from 5/5 to 1/5" is a claim about a specific layer that
can be wrong. Each case names the layer it `measures`; the control arm rebuilds the bundle with
exactly that layer removed, so a difference is attributable to it rather than to the harness in
aggregate. Runs are paired on (case, run index) to control for the variance that makes single-run
agent comparisons meaningless.

**Verification never reads the agent's output.** Long-horizon coding agents demonstrably game
evaluations — weakening tests, special-casing known inputs, deleting assertions (SpecBench,
RESEARCH.md §6f) — and a keyword probe on an agent's own summary passes all of it. Every check
re-runs a command or re-reads a file in the workspace.

**Protected files are hashed.** Anything under `integrity.unchanged` that is modified or deleted
fails the case outright, whatever the assertions say — *especially* if every assertion passed,
because that is what a successful reward hack looks like. The framework is tested against a
recording of an agent doing exactly this.

**The runner is a seam.** `commandRunner` shells out to `claude`, `codex` or `gemini` from an argv
template; `replayRunner` applies recorded file mutations. Replay is what makes the framework itself
testable without spending money or depending on a model's mood — and it is the only way to test
behaviour against a *cheating* agent, since you cannot ask a real one to cheat on demand.

**Judgements are conservative.** Below five paired runs the verdict is `underpowered`, not a
finding. `no-measured-effect` is reported as exactly that — it is not a claim the layer does
nothing.

`atrix eval` with no arguments costs nothing and answers the question that matters day to day:
**which layers has nobody ever measured?** Today that is 21 of 22. Every one of them is a claim
nobody has tested — which is fine, so long as it is never mistaken for a claim that has been.

## Decisions worth knowing

**`AGENTS.md` is capped at 60 lines** and `atrix doctor` fails past it. A manual nobody reads does
nothing. It is a pilot's checklist, not a style guide.

**The rule bundle has a context budget.** Codex and Gemini load every rule at session start —
there is no progressive disclosure to fall back on, unlike Claude skills or Cursor's glob-scoped
rules. `atrix doctor` fails when the generated bundle exceeds ~12,000 tokens (currently ~47% of it).

When that trips, the fix is to **prune or scope rules, not raise the number**. A rule set that
crowds out the actual work is a harness that has become the problem it was built to solve.

**Enforcement lives in hooks, not prose.** `core/hooks/guard-destructive.ts` turns the `safety`
rule into an actual stop — it escalates destructive and outward-facing shell commands to the human.
It is deliberately `ask`, never auto-deny: a guard that blocks legitimate work gets switched off
within a week, which is strictly worse than no guard. Its false-positive tests are as load-bearing
as its true-positive ones.

**The trace is redacted by construction, not by policy.** It records the tool name, the *program*
a shell call invoked (`psql`, never the query), and an error signature with paths, hostnames,
numbers, quoted strings and hex stripped — plus the date, not the time. Its redaction tests are the
first ones in that file, because a regression there does not degrade a feature, it leaks. `.atrix/`
is gitignored by `atrix init` regardless.

**Success is silent, failure is verbose.** See `packages/cli/src/lib/log.ts`. A harness that
narrates every success trains people to ignore it.

**Generated output must be machine-independent.** `adapters/` is committed and read on machines
that did not produce it, so `atrix build` refuses to write any file containing a home directory or
a machine-local temp path. See `learning/incidents/incident-0003`, which is what this check exists
because of.

**No auto-merge of learned candidates**, and no automatic pushes into team repos. Both are
deliberate and both are in "out of scope" rather than "not yet".
