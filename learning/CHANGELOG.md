# What the system has learned

Every entry traces to an incident. Entries are appended when a candidate is merged or dismissed —
**dismissals are recorded too**, because "we considered this and decided against a rule" is exactly
the knowledge that otherwise gets rediscovered and re-argued every six months.

| Date | Incident | Outcome | What changed |
|---|---|---|---|
| 2026-08-20 | [0001](incidents/incident-0001-zod-default-breaks-under.md) | **merged** | `core/rules/typescript-strict.md` — parameterise generics by the Zod schema (`S extends z.ZodTypeAny`), never by the payload type. Added the `exactOptionalPropertyTypes` interaction. |
| 2026-08-20 | [0002](incidents/incident-0002-adapters-went-stale-because-build-was-not-rerun.md) | **dismissed** | No rule. Caught by CI instead — a machine-checkable failure should be checked by a machine. See [the candidate](candidates/incident-0002.md) for the reasoning. |

## Pruned

Nothing yet. When `atrix eval` shows a rule no longer changes any outcome, it is proposed for
deletion and recorded here with the reason — a harness that only grows is a harness that rots.
