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

## The workspace model

Developers clone the harness, launch their agent **at its root**, and keep every project
under `projects/`.

```
atrix-harness/          git: atrixdigital/atrix-harness   ← launch the agent here
├── AGENTS.md           the org-wide manual
├── core/               rules, methodology, skills, roles   committed, shared
├── learning/           incidents and candidates            committed, shared
├── .atrix/             index, traces, loop state           GITIGNORED, per developer
└── projects/           GITIGNORED
    ├── playo-web/      git: its own remote
    └── ezrov/          git: its own remote
```

Projects are **independent git repos, gitignored here**. Client code never merges into a shared
org repo, each project keeps its own history and remote, and nobody deals with submodules.

### What this breaks, and how each is handled

The working directory is now the *workspace*, not the project. Everything that assumed
`process.cwd()` identified what was being worked on had to change.

| Concern | Resolution |
|---|---|
| **Code graph** | One `.atrix/graph.db` with `project` as a column. Searches scope to the active project; `allProjects: true` spans the workspace, which is what makes "has anyone already solved this" answerable. A target never indexes another target's files — the workspace tsconfig reaches into `projects/`, which would index everything twice. |
| **Which project?** | `cwd` if the developer has `cd`'d in, else `ATRIX_PROJECT`. Hooks cannot use either — they run at the root — so they resolve it from the tool payload: a `file_path`, or `cd projects/x` in a command. Undefined is a real answer meaning "the workspace itself", which is what a rule edit is. |
| **Environment** | Analysed **per project**. Two projects each defining `DATABASE_URL` differently is correct; only a disagreement *within* one project means something is about to talk to the wrong system. |
| **Traces and loop state** | `.atrix/projects/<name>/`, so twenty repos do not share one stream. A loop in playo-web must not nudge someone working on ezrov, and a recurrence count pooled across repos is meaningless. |
| **Incident ids** | `incident-YYYY-MM-DD-slug`, not a sequence. Two developers capturing on the same afternoon both computed "the next free number" and both wrote `incident-0006` — a git conflict in the one directory whose purpose is collecting independent notes. Sequential ids remain valid so existing rules keep resolving. |
| **UNDERSTANDINGS.md** | Lives in **each project's own repo** and is committed there, so it travels with the code and reaches whoever works on it. The information graph indexes all of them plus the harness's own. |

### `atrix init` has two modes

Run at the workspace root it wires the graph server and index config **once** — one server covers
every project, so a copy per project would be wrong and would fight the workspace-level one.

Run inside `projects/<name>` it scaffolds the two files that belong to *that repo* and are
committed to it: `AGENTS.md` for its conventions and `UNDERSTANDINGS.md` for how it works. Both
travel with the code, so whoever clones that project gets them without needing the harness.

Picking the wrong mode is the destructive case — writing a project's `AGENTS.md` over the org-wide
manual — so it is asserted by a test rather than left to the resolution logic being right.

### Setup is the agent's job

Making a human run CLI setup in an *agent* harness is a design smell, and for a while this one had
it: `atrix init` existed, and nothing in the shipped bundle told an agent it did. An agent knew the
MCP tools and nothing about the workspace lifecycle, so a developer who cloned a repo into
`projects/` got an agent that could not see the code and did not know why.

Three changes close it. `AGENTS.md` states that setting a project up is the agent's job. The
`onboarding-a-project` skill covers the whole sequence. And the session-start hook flags any
project under `projects/` with no `AGENTS.md`, so the offer happens without being asked.

The division that matters: **`atrix init` does the scaffold; the agent does the part that requires
reading the repo.** A template with blank Stack and Commands sections is worth little — the value
is a manual that names the real script names, because `type-check` and `typecheck` are both common
and only one of them exists in any given repo. A human running `init` alone never gets that.

### Shared versus private

| Shared, committed | Private, gitignored |
|---|---|
| `core/` — rules, skills, roles | `.atrix/graph.db` — each developer indexes locally |
| `learning/` — incidents merge across the team | `.atrix/**/trace.jsonl` — your failures are yours |
| each project's `UNDERSTANDINGS.md`, in that project | `.atrix/**/loop-state.json` |

Only *distilled* knowledge is shared. A trace is raw and per-developer; an incident is reviewed
and reaches everyone.

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

### The environment graph

Built before the rest of the dependency graph because config mismatches are the recurring,
expensive failure in these repos — a migration tool loading `.env` while the app runs on
`.env.local`, pointed at two different databases, both reporting success.

Reads are found through the TypeScript AST rather than a regex: a regex over `process.env.X`
misses `process.env['X']` and destructuring, and matches the string inside a comment. The
indexer already builds a Program, so this costs nothing extra and is exact.

**Values are never read out.** Definitions are compared by hash, so the tool can say two
definitions differ without printing a credential into a terminal or a transcript. A config
auditor that leaks secrets is a worse problem than the one it solves — asserted by a test that
seeds a fake token and greps the serialised output for it.

Findings are ranked by what can actually hurt: a secret behind a public prefix, then conflicting
definitions, then reads with no definition, then duplicates and dead config. Two suppression lists
keep the signal clean, because a tool with false positives gets ignored and takes its true
positives with it — platform-supplied variables (`CI`, `VERCEL_ENV`) are not "undefined", and keys
designed to be public (`*_ANON_KEY`, `*_PUBLISHABLE_KEY`) are not leaked secrets.

Run against `PlayO-web` on its first outing it found four conflicting definitions, including
`DATABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in both `.env` and `.env.local` with different
values.

### The information graph

The code graph answers *what calls what*. This answers *why is it like that*, *what broke last
time we touched this*, and *did we already try that* — the questions that otherwise make every
session start from zero.

Two decisions do most of the work:

- **A note is a section, not a file.** `UNDERSTANDINGS.md` holds many independent claims;
  returning the whole file for a query about one buries the answer. Splitting on `##` makes each
  entry separately retrievable, dated and individually markable as superseded.
- **Both roots are indexed.** Org-wide incidents live in the harness, repo-specific understandings
  live in the project, and the useful question spans them. Harness notes are labelled so their
  origin stays visible.

Storage is SQLite FTS5, already in Bun. Queries are natural questions, so the expression is built
from terms rather than passed through — FTS5 treats `why did we choose X?` as syntax and throws on
the `?`. Stop-word filtering is not cosmetic: under-filtering ranked an unrelated note first
because the word *they* appeared in it.

Exposed as `atrix recall` and the `atrix_recall` MCP tool, and named in `AGENTS.md` — a knowledge
base agents do not know to ask is a knowledge base nobody reads.

### How the rules actually reach each agent

Not the same way, and the difference mattered more than expected.

| Agent | Mechanism |
|---|---|
| Codex, Gemini | handed `adapters/*/AGENTS.md` directly — the bundle *is* the file they load |
| Cursor | `.cursor/rules/*.mdc`, one per rule, glob-scoped |
| **Claude Code** | the SessionStart hook injects the bundle via `additionalContext` |

The Claude path exists because **plugins ship skills, agents, commands, hooks and MCP servers —
not rule files.** A bundle placed inside the plugin is loaded by nothing; `claude plugin details`
lists no such component. That was true here for the entire life of the adapter, and a live session
asked for a rule and answered *"NOT LOADED"* while every offline check passed.

The general lesson is in `learning/incidents/incident-2026-08-25-*`: **structural verification
cannot answer "does the model see this".** The file existed, the manifests validated, the tests
were green, and none of that was the question.

So `doctor` now runs `claude plugin validate` when the CLI is present — it was available from the
first day and nobody ran it — and anything whose purpose is to reach a model gets one live
assertion per delivery path.

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
| Information | **done** | **Built.** Incidents, understandings, ADRs and handoffs in SQLite FTS5. See below. |
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
| 2 | Learning loop — `distill`, PR gate, provenance CI, observability | **done** |
| 3 | Code graph — indexer, query layer, MCP server | **done** |
| 4 | Skill library — template, linter, harvest, 13 skills | **done** (ongoing) |
| 5 | Loop engineering — bounded recovery enforced by hooks | **done** |
| 6 | Graphs — code, environment, information | **done**; org-wide source deferred |
| 7 | Evals — framework, ablation, anti-gaming | **done**; 1 of 31 layers covered |

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

## Loop engineering: the only layer we legitimately own

We do not own the agent loop — Claude Code, Codex and Orca do, and becoming a runtime was
explicitly rejected. But `bounded-recovery` existed only as prose, which made the second-largest
failure category (tool errors without effective recovery, 24.6%) enforced by nothing. That
contradicted this repo's own principle that enforcement lives in hooks, not prose.

The hook surface is enough. Three implementations converged on the design independently:

- **Advisory, never a veto** (dsh `repeat-tool-reminder`). The decision stays with the model. A
  guard that blocks legitimate work gets switched off, which is worse than no guard.
- **Detect no-progress, not failure** (Hermes). Their guardrails missed a mutating tool that
  repeatedly *succeeded* while achieving nothing — an agent hit the same non-existent URL 98
  times, successfully. Counting failures finds none of that.
- **Key on the result too** (OpenClaw). Identical call *and* identical result means no progress;
  a changed result means something moved, so the chain resets.

So the signature is `(tool, argsHash, resultHash)`, and `signatureOf` — written for redaction —
doubles as the volatile-metadata stripper, since two runs of the same operation differ by path,
pid and duration.

| Count | Hook | Action |
|---|---|---|
| 3 | PostToolUse | short nudge via `additionalContext` |
| 5 | PostToolUse | detailed — names the tool, run length and arguments |
| ≥8 | PreToolUse | `ask` — the human decides |

Two details that make it work rather than annoy:

- **Bookkeeping tools are transparent** — `TodoWrite` neither advances nor resets a chain, so
  interleaving it cannot launder a loop.
- **Escalation only fires on the *same* call.** A different call is the model changing approach,
  which is exactly what the nudges asked for.

State lives in `.atrix/loop-state.json` because hooks are separate processes — dsh can use a
WeakMap, we cannot. A corrupt or concurrently-written file resets the chain rather than failing
the tool call: this is a heuristic nudge, not a logged invariant, and blocking work because a JSON
parse failed would be an absurd trade.

## Structural rules, enforced

Three invariants held only by discipline until `packages/cli/src/lib/architecture.test.ts`
existed. Two of them fail **at runtime in someone else's session**, which is the worst place to
find a layering mistake.

- **Hooks import nothing from `packages/`.** `core/hooks/` is copied wholesale into the Claude
  plugin, which receives that directory and nothing else. An import from `packages/` resolves at
  author time, passes typecheck, ships, and throws a module-not-found in a user's session.
- **`graph-core`, `graph-mcp` and `eval` never depend on the CLI.** The CLI composes them; a
  dependency back would make the graph unusable standalone and turn any CLI change into a change
  to the indexer.
- **Nothing tunnels out of a package with `../../../..`.** Cross-boundary imports go through a
  named tsconfig path (`@atrix/hooks/*` → `core/hooks/lib/`) so the coupling is explicit and
  greppable rather than a relative path that breaks silently when a directory moves.

Plus one that turns a rule on ourselves: **every swallowed error explains why.**
`core/rules/failure-design.md` requires it, and we shipped 24 bare `catch` blocks with 17
unexplained before the test existed. A rule the harness does not follow is one nobody else will
either. Each guard was proven by introducing its regression and watching it go red.

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

**The session-start hook earns its place or says nothing.** Harness-Bench's first
recommendation is execution legibility — make pending obligations and recoverable failures
explicit rather than leaving them to be rediscovered. `SessionStart` is the only surface that can
do that before work begins, and it previously reported almost nothing while occupying it.

It now surfaces exactly the facts that change what an agent does next: env values that differ
between files (read from a cached analysis, because a hook has no budget for a TypeScript
Program), a failure that has already recurred three times here, a stale or missing index, and
undistilled incidents. Everything else is silence. A banner that recites repo statistics trains
people to skip it, and then the one line that mattered gets skipped too.

`atrix status` is the human-facing equivalent. It is deliberately separate from `doctor`: doctor
is a gate that must stay fast and binary for CI, and folding advice into a gate makes it noisy to
run there.

**Success is silent, failure is verbose.** See `packages/cli/src/lib/log.ts`. A harness that
narrates every success trains people to ignore it.

**Generated output must be machine-independent.** `adapters/` is committed and read on machines
that did not produce it, so `atrix build` refuses to write any file containing a home directory or
a machine-local temp path. See `learning/incidents/incident-0003`, which is what this check exists
because of.

**No auto-merge of learned candidates**, and no automatic pushes into team repos. Both are
deliberate and both are in "out of scope" rather than "not yet".
