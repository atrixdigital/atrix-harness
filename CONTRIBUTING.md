# Contributing

The harness is read by every agent on every Atrix repo. That makes additions cheap to propose and
expensive to get wrong, so most of this document is about **what not to add**.

```bash
bun install
bun run atrix build && bun run atrix doctor && bun run atrix lint && bun test
```

Edit `core/`. **Never edit `adapters/`** — it is generated, and CI fails on any drift.

---

## The first question: does this belong here at all?

Three places, and picking wrong is the most common mistake.

| Where | When |
|---|---|
| **This repo** | True of *any* Atrix repo |
| **The repo's own `AGENTS.md`** | True of one repo — its stack, its commands, its gotchas |
| **The repo's `UNDERSTANDINGS.md`** | Describes how one system *works*, rather than what to do |

`.env` living two levels up is a repo fact, not an org rule. It goes in that repo.

## Rule or skill?

| | Rule (`core/rules/`, `core/methodology/`) | Skill (`core/skills/`) |
|---|---|---|
| Loaded | **Every session, always** | Only when its description matches |
| Costs | Tokens in every session forever | ~100 tokens until used |

Measured on this repo: one rule added **625 tokens to every session forever**. Three skills of
substantially more content added **zero**.

> The test: **would an agent doing a completely unrelated task still need to know this?**
> If not, it is a skill. When genuinely unsure, skill.

`atrix doctor` fails past ~12,000 tokens of bundle. When it trips, the answer is almost always
that a rule should have been a skill.

## Adding a rule

Frontmatter is validated; a malformed rule fails the build rather than being silently ignored.

```yaml
---
name: kebab-case-name
description: One line. What it governs.
source: incident-0007          # or research-<ref>, or founding
applies: [**]                  # globs, for agents that scope rules
expires_when: <what would make this obsolete>   # optional but encouraged
---
```

**`source` must resolve.** A rule citing `incident-0007` when no such incident exists fails
`doctor` and CI. Provenance that does not resolve is the same as no provenance.

- `incident-NNNN` — we hit this ourselves; the write-up is in `learning/incidents/`
- `research-<ref>` — published evidence, cited in `docs/RESEARCH.md`. Deliberately distinct from
  `founding`: a rule justified by someone else's measurements is a weaker claim than one justified
  by our own failure, and a reader is entitled to know which they are reading
- `founding` — the initial set, predating the loop

**Write `expires_when` while you still know the answer.** Every rule encodes an assumption about
what the model cannot do on its own, and models change. At authoring time you know what would make
it obsolete; six months later nobody remembers why it exists, so nobody dares delete it.
`doctor` lists these every run so the condition gets checked.

## Adding a skill

`core/skills/<group>/<name>/SKILL.md`, plus optional `references/` and `scripts/`.
`atrix lint` enforces the published authoring rules:

- **The description is a routing rule, not a summary.** It must say *when* to fire, in the words
  people actually use — it is the only thing the model sees when deciding whether to load the
  skill. Third person, always: it is injected into the system prompt.
- **References exactly one level deep**, linked from `SKILL.md` as markdown links. Nested
  references get *partially* read, so the agent proceeds on truncated content — worse than not
  reading them at all. Prose mentions do not count as links; the linter has caught this twice.
- Body under 500 lines. Reference files over 100 lines need a `## Contents`.

## Adding an incident

`atrix learn "<what bit you>"`, then fill it in from the session's actual history — not from
memory of how such things usually go.

Then `atrix distill <id>` drafts a candidate. Before proposing a rule, ask:

> **Could a machine catch this instead?** A CI check, a hook, a type, a test.

If it can, that beats a rule: it costs nothing at runtime and cannot be forgotten. **Rules are for
judgement that cannot be automated.** Three of the five incidents in this repo resolved to a check
rather than a rule, and that is the loop working — a rule library grows by refusing things.

Dismissals are recorded in `learning/CHANGELOG.md` alongside merges, so the reasoning is not
re-argued in six months. See `learning/candidates/incident-0002.md` for the worked example.

## Adding an eval case

`evals/cases/<name>.yml` plus a fixture in `evals/fixtures/`. Enforced by `cases.test.ts`:

- **The case must fail on its unmodified fixture.** A case that already passes measures nothing —
  it credits the layer for work the fixture already does, which is worse than no case because it
  manufactures confidence.
- **Verification never reads agent output.** Re-run a command or re-read a file. A keyword probe
  on an agent's own summary is passed trivially by an agent that cheated.
- **The prompt must not name the layer it measures.** A prompt saying "remember tenant scoping"
  tests instruction-following, not whether the harness changed default behaviour.
- **If the fixture ships a test, protect it** under `integrity.unchanged`. Editing a test to make
  it pass is the canonical reward hack, and it fails the case outright however green the checks.

## Before opening a PR

```bash
bun run atrix build      # regenerate adapters — CI fails on drift
bun run atrix doctor     # provenance, budget, artefact shape
bun run atrix lint       # skill authoring rules
bun run atrix eval       # case validity and coverage
bun test && bun x tsc --noEmit
```

**Prove any guard you add.** Introduce the bug it was written for, watch it go red, revert. An
untested guard is a comment with a runtime cost — and one guard in this repo was silently inert
for three commits before a test caught it.

Learned changes are always human-reviewed. Nothing merges itself into a brain that every repo reads.
