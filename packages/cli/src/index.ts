#!/usr/bin/env bun
import { build } from './commands/build.ts';
import { distill } from './commands/distill.ts';
import { doctor } from './commands/doctor.ts';
import { init } from './commands/init.ts';
import { learn } from './commands/learn.ts';
import { lint } from './commands/lint.ts';
import { AtrixError, bold, cyan, dim, log } from './lib/log.ts';
import { findHarnessRoot, findProjectRoot } from './lib/paths.ts';

const USAGE = `${bold('atrix')} — the Atrix agent operating system

${bold('Usage')}
  atrix <command> [options]

${bold('Commands')}
  ${cyan('build')}              Generate adapters/ for every agent from core/
  ${cyan('init')}               Scaffold the current repository to use the harness
  ${cyan('doctor')}             Check the harness is wired up correctly
  ${cyan('lint')}               Check skills against the authoring rules
  ${cyan('learn')} <title>      Capture an incident — the start of the learning loop
  ${cyan('distill')} [id]       Turn an incident into a proposed change; lists pending if no id
  ${cyan('index')}              Build the code graph for this repository     ${dim('(phase 3)')}
  ${cyan('sync')}               Pull the latest org-wide source graph        ${dim('(phase 6)')}
  ${cyan('eval')}               Run the harness eval suite                   ${dim('(phase 7)')}

${bold('Environment')}
  ATRIX_HOME         Path to the atrix-harness checkout (otherwise found by walking up)
`;

function notYet(command: string, phase: string): never {
  throw new AtrixError(
    `\`atrix ${command}\` is not implemented yet — it lands in ${phase}.`,
    'See docs/ARCHITECTURE.md for the phase plan.',
  );
}

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
      init(harnessRoot, projectRoot);
      return 0;

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

    case 'distill':
      distill(harnessRoot, rest[0]);
      return 0;
    case 'index':
      return notYet('index', 'phase 3');
    case 'sync':
      return notYet('sync', 'phase 6');
    case 'eval':
      return notYet('eval', 'phase 7');

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
