# What the system has learned

Every entry traces to an incident. Entries are appended when a candidate is merged or dismissed —
**dismissals are recorded too**, because "we considered this and decided against a rule" is exactly
the knowledge that otherwise gets rediscovered and re-argued every six months.

| Date | Incident | Outcome | What changed |
|---|---|---|---|
| 2026-08-20 | [0001](incidents/incident-0001-zod-default-breaks-under.md) | **merged** | `core/rules/typescript-strict.md` — parameterise generics by the Zod schema (`S extends z.ZodTypeAny`), never by the payload type. Added the `exactOptionalPropertyTypes` interaction. |
| 2026-08-20 | [0002](incidents/incident-0002-adapters-went-stale-because-build-was-not-rerun.md) | **dismissed** | No rule. Caught by CI instead — a machine-checkable failure should be checked by a machine. See [the candidate](candidates/incident-0002.md) for the reasoning. |

| 2026-08-21 | [0003](incidents/incident-0003-machine-specific-path-baked-into.md) | **merged** | No rule — a build-time guard. `atrix build` now refuses to write generated output containing a home directory or machine-local temp path. Third incident in a row whose right answer was a check, not a rule. |

| 2026-08-24 | [0004](incidents/incident-0004-generated-hook-config-had-the.md) | **merged** | `adapters.test.ts` (published-artefact test tier) + `core/methodology/testing-policy.md`. Generated hooks had the wrong shape and would never have fired — 101 tests green throughout. |

| 2026-08-24 | [0005](incidents/incident-0005-loop-guard-verified-with-zsh.md) | **merged** | `hook-output.test.ts` + a note in testing-policy. zsh's `echo` interprets `\n`, so the verification harness corrupted valid JSON and manufactured a 20-minute bug hunt. Prefer an in-process test to a shell demo when output involves escaping. |

| 2026-08-25 | [rule-bundle](incidents/incident-2026-08-25-rule-bundle-never-reached-claude-code.md) | **merged** | SessionStart now injects the rule bundle. Claude Code plugins ship skills/agents/hooks/MCP — not rule files — so all 18 rules were inert for Claude users while Codex and Gemini had them. Every structural check passed throughout. Also: `doctor` now runs `claude plugin validate`, which existed all along. |

## Pruned

Nothing yet, but pruning is now mechanical rather than aspirational: rules may declare
`expires_when` in frontmatter, and `atrix doctor` lists them every run so the condition gets
checked instead of forgotten. Four rules currently declare one.

Nothing yet. When `atrix eval` shows a rule no longer changes any outcome, it is proposed for
deletion and recorded here with the reason — a harness that only grows is a harness that rots.
