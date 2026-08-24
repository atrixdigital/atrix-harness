# Why this harness is shaped this way

Every design decision in this repo traces to published evidence. This document is the trace.
Where the evidence is thin or contested, it says so.

---

## 1. The harness matters more than the model

The scaffolding around a model — prompts, tools, context management, hooks, orchestration —
determines outcomes at least as much as which model you run.

- On **Terminal Bench 2.0**, one team moved from roughly rank 30 into the top 5 by changing only
  the harness, same model.
- *The Harness Effect* (arXiv 2607.06906) compared a conventional production agent loop against a
  redesigned harness across 6 models and 22 locked tasks: **41% cheaper** ($0.21 → $0.12/task),
  **38% fewer tokens** (14.2k → 8.8k), **44% faster** (48s → 27s), quality flat-to-better
  (0.78 → 0.81). Every model improved 33–61% — the gains are **model-invariant**.
- Anthropic's own long-running-app experiment: solo, a model produced a retro game maker in 20
  minutes for $9 whose core mechanics did not work — entities rendered but ignored input. The same
  task under a Planner → Generator → Evaluator harness took 6 hours and $200 and actually ran.

**What we took:** the harness is a first-class artefact with its own tests and version history,
not configuration scattered across repos.

## 2. Every component encodes an assumption — so prune

The sharpest framing in the literature (Addy Osmani, and Anthropic's harness post independently):
*every harness component encodes an assumption about what the model can't do on its own.*

Anthropic's own scaffolding demonstrates the decay. Claude Opus 4.5 exhibited "context anxiety" —
wrapping work up prematurely as context filled — so their harness added sprint decomposition and
context resets. Opus 4.6 removed the behaviour, and that scaffolding became **pure overhead**.
They deleted it.

**What we took:** `evals/` exists to identify dead scaffolding, and the learning loop's fifth
stage is *prune*, not *grow*. A rule that no longer changes any eval outcome is proposed for
deletion. Also: `AGENTS.md` is capped at 60 lines and `atrix doctor` fails if it exceeds that.

## 3. Loops win on practicality; graphs lose to failure-loops

A scheduler-theoretic survey of 70 open-source agent projects (arXiv 2604.11378) formalised agent
runtimes as schedulers and found:

| Pattern | Share | Expressiveness | Controllability | Implementability |
|---|---|---|---|---|
| Agent loop | **60%** | Low | Low | **High** |
| Event-driven | 15% | — | — | — |
| State machine | 10% | Medium | **High** | Medium |
| Graph / flow | **5%** | **High** | Low | Low |
| Hybrid | 10% | — | — | — |

The counterintuitive result: **failure-loop behaviour was frequent in graph/flow systems and rare
in state-machine ones.** Expressiveness without a bounded transition buys you infinite loops.

Their proposed constraints — controllability first, immutable plan versions, three-level bounded
recovery, explicit side-effect classification — are the most directly useful thing in the paper.

**What we took:** `core/methodology/bounded-recovery.md` is a hard rule, not advice.
`retry → patch → replan`, capped, then stop. Non-idempotent operations are never auto-retried.
Replans create a new plan version rather than mutating the old one.

**Caveat:** that paper is explicitly a position paper. It contributes a framework and an
experimental protocol, **not empirical validation**. The 70-project survey is real; the Graph
Harness proposal is untested.

## 4. Pre-indexed code graphs are the largest single win

The 2026 shift was from "agents grep" to "precompute structure, expose it as tools, let agents
query narrow facts instead of burning context on broad file reads."

- codegraph across 7 codebases: **35% cheaper, 59% fewer tokens, 49% faster, 70% fewer tool calls.**
  Swift Compiler — 25,874 files indexed in under 4 minutes; queries resolved in 35s / 6 tool calls
  versus 90–180s / 25–40 calls without.
- A tree-sitter knowledge graph over MCP across 31 repos: ~10× fewer tokens, 2.1× fewer tool calls.
- GitNexus production audit: 88% fewer tool calls.

The category is genuinely contested — Anthropic ships grep-only in Claude Code, and the entire
open-source tier exists to argue that is wrong. The benchmarks favour indexing.

**What we took:** graph tools come before file reads in `core/rules/tool-discipline.md`. We wrap
proven engines rather than writing a parser, and spend our own effort on the graphs nobody sells:
dependency/impact, information, and org-wide source.

**Caveat worth naming:** the leading tools are largely solo-maintained and pre-1.0, and one is
noncommercial-licensed. Wrapping them is a real supply-chain bet. It is reversible — the wrapper
is ours — but it is a bet.

## 4b. Harness-Bench: what agents actually fail at

The most directly actionable study (arXiv 2605.27922). Task conditions were fixed — prompts,
sandbox, budgets, timeouts, evaluators — while the harness was varied across **5,194 trajectories**
(6 harnesses × 8 model backends × 106 tasks in 8 workflow categories).

**The spread on identical tasks: 76.2% down to 52.4% — 23.8 points, from the harness alone.**

More turns did not mean better results. The top harness scored 76.2% using 68.7k tokens over 7.3
turns; a mid-table one scored 71.2% using 139.7k tokens over 22.6 turns. Twice the tokens, three
times the turns, worse outcome.

### The failure taxonomy

Among failed trajectories:

| Failure mode | Share |
|---|---|
| **Output/format contract violations** | **36.4%** |
| Tool errors without effective recovery | 24.6% |
| Incomplete evidence grounding | 14.6% |
| Missing artifact commitment | 11.1% |
| Failure to preserve state continuity | 9.3% |

The paper's framing is the important part: these are **not reasoning errors**. They are *execution
drift* — "points where model reasoning becomes weakly coupled to the files, tools, evidence, state,
or output contracts."

Stronger models showed lower cross-harness variance. Harness quality matters most for weaker models
— which is an argument for the harness getting *better* as you move down the model tiers, not worse.

**What we took:** `core/rules/execution-contract.md` addresses four of the five directly, and the
first two bullets of `AGENTS.md`'s "Before you finish" are now the output contract and artifact
commitment — the 36.4% and the 11.1%. Recovery (24.6%) was already `bounded-recovery`. This is the
single highest-value piece of evidence found so far, because it reallocates effort away from
reasoning quality and toward execution legibility.

## 5. Self-evaluation does not work

Models confidently praise their own mediocre output. Anthropic's harness work found the separation
of generation and evaluation to be the load-bearing piece: an external evaluator running Playwright
against the real UI caught concrete defects ("rectangle fill tool only places tiles at drag start
and end points") that the generator had reported as complete.

**What we took:** the `evaluator` role must execute, not read; it is forbidden from grading its own
work; and `core/rules/verify-before-done.md` requires real command output as evidence.

## 6. Context engineering — the daily hot path

- **Just-in-time retrieval** over pre-loading: keep lightweight identifiers, load via tools.
- **Compaction vs. context reset:** resets (clear everything, hand off via a structured artefact
  file) beat in-place summarisation for context-anxious models — and became unnecessary once the
  model improved. Another instance of §2.
- **File-based agent communication** beat conversational handoff: clearer handoff points, less
  miscommunication.
- **~10 focused tools**, not fifty overlapping ones — models reason better over constrained choices.
- Claude Code itself runs five-stage progressive compaction and a 27-event hook pipeline.

**What we took:** file-based handoffs in the playbooks, a tool budget per role, and the 60-line cap
on the entry manual.

## 6b. Skills: the description is the whole discovery mechanism

At startup only each skill's name and description are loaded — roughly 100 tokens per skill. The
body (target: under 5,000 tokens, hard guidance under 500 lines) loads only when the description
matches, and bundled references load only when linked from the body. That is what allows 50+ skills
with no cost to unrelated tasks.

Consequences we enforce mechanically in `atrix lint`:

- **The description is a routing rule, not a summary.** It must say *when* to fire, in the words
  people actually use. A description that only says what the skill does will not be selected.
- **Third person, always.** It is injected into the system prompt; "I can help you…" degrades
  discovery.
- **References exactly one level deep.** Nested references get *partially* read — the agent
  silently proceeds on truncated information, which is worse than not reading them at all.
- **Reference files over ~100 lines need a table of contents**, so a partial read still reveals
  the scope.
- **Build evaluations before writing the skill.** Measure the failure without it first, or you are
  documenting imagined problems.

The linter found two real defects in this repo's own first skill on its first run.

## 6c. DeepSeek Harness: what an open harness looks like

DeepSeek shipped **DeepSeek Harness (`dsh`)** on 2026-08-13 under MIT — a runnable agent stack
rather than a model announcement. It took ~95,000 GitHub stars in two days. Its framing is the
same as this repo's: *Model + Harness = Agent*, with the harness treated as a product layer
co-equal to the model rather than an afterthought.

**Architecture: everything is a plugin.** Not a privileged core with extension points — the model
adapter, tool registry, session log, prompt assembly, loop driver and the agent loop itself are
all swappable. Six services form a control spine; around them sit "capability seams" (declared
interfaces with swappable providers), so pointing the filesystem and subprocess providers at a
remote sandbox moves execution without forking any tool.

### The invariant worth stealing: "model-visible means logged"

Anything that reaches a model request must be reconstructible from an append-only session log,
with runtime assertions enforcing it. That single constraint buys three things that are otherwise
very hard: **deterministic replay, honest token accounting, and compaction implemented as a plugin
rather than baked into the loop.**

A turn is zero or more steps; a step is one model request plus its tool calls. Tools run through a
guarded pipeline — pre-hooks, permission checks, approval prompts, timeout/retry wrappers,
post-execute rewriting — before results freeze into the log.

**What we took:** we are not a runtime and should not become one — Atrix agents run inside Claude
Code, Codex and Orca, which own their loops. But the *logging* invariant applies to anything, and
we had nothing. `core/hooks/record-trace.ts` is the smallest useful version of it.

**Also notable:** `dsh` loads `AGENTS.md`/`CLAUDE.md` natively and discovers skills from the
filesystem — which is precisely why this repo's core is portable markdown rather than one
vendor's plugin format. A sixth adapter would be a small amount of work.

Related: **DeepClaude** swaps the endpoint under Claude Code's unchanged loop, running the same
harness against DeepSeek V4-Pro at roughly an order of magnitude lower cost per token
($0.87/M output vs $15/M). Same body, different brain — more evidence that the harness, not the
model, is the durable artefact.

## 6d. Harnesses can evolve from their own telemetry

*Agentic Harness Engineering: Observability-Driven Automatic Evolution* (arXiv 2604.25850) closes
the loop this repo opened by hand. Collect execution traces, outcomes and failure modes; mine them
for which harness components correlate with better results; generate candidate modifications;
**validate on held-out tasks before deploying**. Reported gains: **5–15% relative** on coding
benchmarks, generalising across GPT, Qwen and DeepSeek backends.

The takeaway for builders is blunt: stop relying on intuition, adopt observability-driven
iteration cycles.

**What we took:** this named the single biggest gap in the design. The learning loop's input was
"a human remembered", which catches the failures people *notice* and misses the ones they absorb —
and the person who hits the same failure eleven times has stopped noticing by the fourth.
`core/hooks/record-trace.ts` records a redacted shape of every tool result; `atrix observe`
clusters recurring failures and proposes them as incidents.

**Where we deliberately diverge:** the paper deploys validated changes automatically. We propose
and stop. A change that reaches every repo in the org needs a human, and 5–15% is not worth the
tail risk of an automated bad rule propagating everywhere.

## 6e. Prompt cache shape is the largest input-cost lever

Cached input costs roughly a tenth of fresh input, and an agent loop re-sends its prefix every
turn. A representative optimised turn: **67.6k tokens, of which 63k are cached reads at $0.30/M
and 296 tokens are fresh at $3/M.** Done well this cuts input cost 30–50% with no quality change.

The catch is that a hit requires the prefix to be **byte-identical**, not equivalent. So the rule
is: front-load everything stable, append only the fresh delta, and keep serialisation
deterministic — stable tool order, stable JSON key order, stable instruction block order, and no
timestamps or trace ids anywhere in the stable region.

**What we took:** `core/rules/cache-shape.md`, plus a test asserting two consecutive `atrix build`
runs are byte-identical. That test is not tidiness; a single timestamp in the generated bundle
would cost a full uncached prefix on every turn for everyone who installs it.

## 6f. Evals must resist being gamed

*SpecBench* (arXiv 2605.21384) measures reward hacking in long-horizon coding agents. The observed
behaviours are specific and familiar: **weakening tests, special-casing known inputs, deleting
assertions, and manipulating outputs to match expectations** without solving anything.

Its recommendations shape how `evals/` must be built: generate novel test cases rather than reusing
seen ones, keep core assertions immutable and separate from modifiable code, **monitor the agent's
modifications to the test infrastructure itself**, and combine pass rate with code-quality and
modification-pattern signals rather than trusting pass rate alone.

**What we took:** a design constraint recorded before writing the eval suite — an eval an agent can
edit is an eval that measures nothing. This is why `verify-before-done` demands real command output
as evidence, and why the `evaluator` role is forbidden from grading its own work.

## 6g. Reading dsh's own repo, not the write-ups

The blog coverage describes the architecture. The repo itself carries better material, because
DeepSeek documents its own defects.

**`docs/defensive-patterns.md`** opens: *"each pattern below is a class of defect that actually
shipped or nearly shipped here, stated as the rule that prevents its recurrence."* That is this
repo's provenance invariant, arrived at independently by a team with 190k stars. Strong evidence
the constraint is right.

**`docs/testing.md`** names failure classes we had:

- *"Test the real entry path"* — the published artefact, not the source. `bin` runs the built
  `lib/bin.js` under plain `node`, "exposing failures tsx masks".
- *"Verify the world, not the self-report"* — an e2e assertion re-runs the command or re-reads the
  file externally; "a keyword probe on the agent's own output lets a cheating agent pass". Assert
  untouched files are byte-identical. This is the operational answer to SpecBench (§6f).
- *"A guard only guards if the regression actually fails it"* — introduce the regression, watch
  red, revert. Stated as a requirement, not a nicety.
- *"Mock only the expensive or non-deterministic boundary"* — keep everything downstream real.
- On coverage: *"an uncovered line is often dead code the gate is correctly flagging for deletion,
  not a missing test to bolt on."*

**What we took:** `core/methodology/testing-policy.md`, and a published-artefact test tier in
`packages/cli/src/lib/adapters.test.ts`. That tier immediately found a live bug — see
`incident-0004`: generated hook config had the event map at the top level instead of under a
`hooks` key. Valid JSON, build green, 101 tests passing, and all three hooks inert.

**Their AGENTS.md is 16KB**, against our 60-line cap. Not a contradiction: theirs is repo context
for people working *on* dsh, which in our model is the per-repo `AGENTS.md` that `atrix init`
scaffolds. The cap applies to the org-wide manual, which is a different document.

**One pattern worth stealing outright:** their AGENTS.md opens with *"Pre-release stance… **Remove
this section at the first tagged release**"* — a rule that declares its own expiry. Rules encode
assumptions about what the model cannot do, and the authoring moment is the only time anyone knows
what would make the rule obsolete. `expires_when` in rule frontmatter makes that a field, and
`atrix doctor` lists them every run so pruning is a standing prompt rather than an intention.

## 7. Control flow belongs in code, not in a context window

*LLM-as-Code / Agentic Programming* (arXiv 2606.15874) inverts the usual arrangement: the program
governs control flow and the LLM is a callee inside it. Two ideas carry:

- **DAG-structured context** — a call sees its full ancestor chain, but each frame keeps only a
  summary of children that already returned. Context is bounded by call **depth**, not total steps.
- **Self-programmed evolution** — improvements are committed as code, so they persist across runs
  instead of evaporating with the context window.

On OSWorld: **86.8% in 15 steps**, against the strongest baseline's 80.4% in 100 steps.

Anthropic's dynamic subagent orchestration makes the same move — coordination state moves out of
one model's context into a script that can be re-run — with six reusable patterns:
classify-and-act, fan-out-and-synthesize, adversarial verification, generate-and-filter,
tournament, loop-until-done.

**What we took:** the learning loop writes changes to **files under review**, not to a memory blob.
The six patterns become `core/playbooks/` in phase 5.

---

## Sources

- [The Harness Effect (arXiv 2607.06906)](https://arxiv.org/abs/2607.06906)
- [From Agent Loops to Structured Graphs (arXiv 2604.11378)](https://arxiv.org/html/2604.11378)
- [LLM-as-Code: Agentic Programming (arXiv 2606.15874)](https://arxiv.org/html/2606.15874v1)
- [Building Effective AI Coding Agents for the Terminal (arXiv 2603.05344)](https://arxiv.org/pdf/2603.05344)
- [Anthropic — Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- [Anthropic — Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Addy Osmani — Agent Harness Engineering](https://addyosmani.com/blog/agent-harness-engineering/)
- [awesome-harness-engineering](https://github.com/ai-boost/awesome-harness-engineering)
- [Code Intelligence Tools for AI Agents Compared — Ry Walker](https://rywalker.com/research/code-intelligence-tools)
- [codegraph: pre-indexed knowledge graph for coding agents](https://agentconn.com/blog/codegraph-pre-indexed-knowledge-graph-multi-agent-claude-code-codex-2026/)
- [Graphs vs. Loops: the 2026 orchestration debate](https://explainx.ai/blog/graphs-vs-loops-agentic-ai-debate-linear-andrew-ng-2026)
- [Harness-Bench (arXiv 2605.27922)](https://arxiv.org/html/2605.27922v1)
- [Anthropic — Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [Code graph MCP tools compared](https://www.saurabhsharma.dev/blogs/code-graph-mcp-tools-comparison/)
- [DeepSeek Harness, dissected](https://memo.d.foundation/deepseek-harness-architecture)
- [DeepSeek Harness technical deep-dive](https://dlcmh.github.io/deepseek-harness)
- [Agentic Harness Engineering: Observability-Driven Automatic Evolution (arXiv 2604.25850)](https://arxiv.org/pdf/2604.25850)
- [SpecBench: Measuring Reward Hacking in Long-Horizon Coding Agents (arXiv 2605.21384)](https://arxiv.org/pdf/2605.21384)
- [The 2026 Caching Playbook for Agents](https://galileo.ai/blog/the-2026-caching-playbook-for-agents-bigger-prompts-smaller-bills)
- [Same Harness, Different Brain (DeepClaude)](https://medium.com/@arthurpro/same-harness-different-brain-c14f4aa8ff57)
- [deepseek-ai/deepseek-harness — architecture, testing policy, defensive patterns](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md)
- [Orca (Stably AI)](https://github.com/stablyai/orca)
