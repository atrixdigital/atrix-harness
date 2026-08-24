#!/usr/bin/env bun
import { build } from './commands/build.ts';
import { distill } from './commands/distill.ts';
import { doctor } from './commands/doctor.ts';
import { runEnv } from './commands/env.ts';
import { runRecall } from './commands/recall.ts';
import { runEval } from './commands/eval.ts';
import { runIndex } from './commands/index-repo.ts';
import { status } from './commands/status.ts';
import { sync } from './commands/sync.ts';
import { verify } from './commands/verify.ts';
import { init } from './commands/init.ts';
import { learn } from './commands/learn.ts';
import { lint } from './commands/lint.ts';
import { observe } from './commands/observe.ts';
import { AtrixError, bold, cyan, dim, log } from './lib/log.ts';
import { findHarnessRoot, findProjectRoot } from './lib/paths.ts';

const USAGE = `${bold('atrix')} — the Atrix agent operating system

${bold('Usage')}
  atrix <command> [options]

${bold('Commands')}
  ${cyan('build')}              Generate adapters/ for every agent from core/
  ${cyan('init')}               Scaffold the current repository to use the harness
  ${cyan('status')}             Everything at a glance — content, learning, graphs, coverage
  ${cyan('doctor')}             Check the harness is wired up correctly
  ${cyan('verify')}             Prove it works against a real agent; --live for full
  ${cyan('lint')}               Check skills against the authoring rules
  ${cyan('recall')} <question>  Ask the knowledge base — incidents, understandings, ADRs
  ${cyan('observe')}            Recurring failures in this project; --all for the workspace
  ${cyan('learn')} <title>      Capture an incident — the start of the learning loop
  ${cyan('distill')} [id]       Turn an incident into a proposed change; lists pending if no id
  ${cyan('index')}              Index the active project; --all for the whole workspace
  ${cyan('env')}                Audit env vars for the active project; --all for every project
  ${cyan('sync')}               Pull the latest harness and rebuild adapters
  ${cyan('eval')}               Which layers are measured; --run to measure them

${bold('Eval')}
  atrix eval                        coverage report — free, no model
  atrix eval --run --agent claude   run the suite  ${dim('(spends real tokens)')}
  atrix eval --run --runs 10        more repetitions for a firmer signal

${bold('Environment')}
  ATRIX_HOME         Path to the atrix-harness checkout (otherwise found by walking up)
`;

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;

  if (command === undefined || command === '--help' || command === '-h' || command === 'help') {
    console.log(USAGE);
    return 0;
  }

  if (command === '--version' || command === '-v') {
    console.log('0.1.0');
    return 0;
  }

  const harnessRoot = findHarnessRoot();
  const projectRoot = findProjectRoot();

  switch (command) {
    case 'build':
      build(harnessRoot);
      return 0;

    case 'init':
      init(harnessRoot);
      return 0;

    case 'status':
      return status(harnessRoot, projectRoot) ? 0 : 1;

    case 'verify':
      return (await verify(harnessRoot, rest)) ? 0 : 1;

    case 'doctor':
      return doctor(harnessRoot, projectRoot) ? 0 : 1;

    case 'lint':
      return lint(harnessRoot) ? 0 : 1;

    case 'learn': {
      const title = rest.join(' ').trim();
      if (title === '') {
        throw new AtrixError('`atrix learn` needs a title.', 'e.g. atrix learn "migrations ran against the wrong DB"');
      }
      learn(harnessRoot, title, new Date().toISOString().slice(0, 10));
      return 0;
    }

    case 'recall':
      return runRecall(projectRoot, rest) ? 0 : 1;

    case 'observe':
      return observe(harnessRoot, rest) ? 0 : 1;

    case 'distill':
      distill(harnessRoot, rest[0]);
      return 0;
    case 'index':
      return runIndex(harnessRoot, rest) ? 0 : 1;

    case 'env':
      return runEnv(harnessRoot, rest) ? 0 : 1;
    case 'sync':
      return sync(harnessRoot, projectRoot, rest) ? 0 : 1;
    case 'eval':
      return (await runEval(harnessRoot, rest)) ? 0 : 1;

    default:
      throw new AtrixError(`Unknown command "${command}".`, 'Run `atrix help` to see what is available.');
  }
}

try {
  process.exit(await main(process.argv.slice(2)));
} catch (error) {
  if (error instanceof AtrixError) {
    log.fail(error.message);
    if (error.hint !== undefined) log.detail(error.hint);
    process.exit(1);
  }
  throw error;
}
