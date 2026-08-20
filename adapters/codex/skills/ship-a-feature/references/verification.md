# What "relevant tests" means

Running the full suite on every change is slow enough that people stop running anything. Run what
the change can plausibly break.

| Change type | Verify with |
|---|---|
| Pure function / util | Its unit test, plus the tests of its direct callers (`atrix_callers`) |
| API endpoint | Its integration test, then actually call it with a real payload |
| Database schema | Migration up **and** down, then the queries that touch those columns |
| UI component | Render it. Look at it. Click the primary action. Check the empty and error states |
| Config / env | Start the app cold. A config change that passes typecheck can still fail at boot |
| Dependency bump | Typecheck, build, and the tests of whatever imports it |

## The rule underneath

**Blast radius determines test scope.** `atrix_impact <symbol>` gives you the set of things that
can break; test that set. If the impact query returns something surprising, that is a finding —
investigate before you continue.

## Evidence

Record the command you ran and the output you saw. "Tests pass" without the run is a claim, not a
verification, and it is the single most common way broken work gets reported as done.
