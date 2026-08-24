export { checkpoint, open, SCHEMA_VERSION, type EdgeKind, type SymbolKind } from './schema.ts';
export { createProgramFor, indexRepo, type IndexOptions, type IndexResult } from './indexer.ts';
export {
  collectNotes,
  getNote,
  indexNotes,
  recall,
  type Note,
  type NoteKind,
  type Recalled,
} from './notes.ts';
export {
  analyseEnv,
  collectEnvDefs,
  collectEnvReads,
  envFileOrder,
  type EnvAnalysis,
  type EnvDef,
  type EnvFinding,
  type EnvRead,
} from './env.ts';
export {
  callers,
  callees,
  context,
  impact,
  search,
  type Context,
  type EdgeRow,
  type Impact,
  type ImpactNode,
  type SymbolRow,
} from './query.ts';
