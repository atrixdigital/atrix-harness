export { caseSchema, loadCases, isCommandCheck, type Check, type EvalCase, type LoadedCases } from './case.ts';
export {
  checkIntegrity,
  snapshotProtected,
  verify,
  type CheckResult,
  type IntegrityViolation,
  type Verdict,
} from './verify.ts';
export {
  commandRunner,
  prepareWorkspace,
  replayRunner,
  type Arm,
  type Recording,
  type RunRequest,
  type RunResult,
  type Runner,
} from './runner.ts';
export { computeLift, judge, type Judgement, type Lift, type RunOutcome } from './score.ts';
export { runSuite, type SuiteOptions, type SuiteResult } from './suite.ts';
