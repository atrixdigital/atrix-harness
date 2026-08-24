import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { findHarnessRoot } from '../lib/paths.ts';
import { init } from './init.ts';

/**
 * `init` writes into somebody else's repository, which makes destructiveness the risk
 * that matters. Every test here is about not damaging what is already there.
 */

const harnessRoot = findHarnessRoot(import.meta.dir);
let project: string;

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'atrix-init-'));
  mkdirSync(join(project, '.git'), { recursive: true });
});
afterEach(() => rmSync(project, { recursive: true, force: true }));

const read = (rel: string): string => readFileSync(join(project, rel), 'utf8');
const readJson = (rel: string): Record<string, any> => JSON.parse(read(rel)) as Record<string, any>;

describe('a fresh repository', () => {
  test('gets the tools AGENTS.md promises', () => {
    // The manual tells agents to reach for atrix_search and atrix_impact. Scaffolding
    // that instruction without the MCP wiring produces an agent that tries and fails.
    init(harnessRoot, project);
    expect(existsSync(join(project, '.mcp.json'))).toBe(true);
    expect(readJson('.mcp.json')['mcpServers']['atrix-graph']).toBeDefined();
  });

  test('parameterises the server path rather than baking in this machine', () => {
    init(harnessRoot, project);
    const args: string[] = readJson('.mcp.json')['mcpServers']['atrix-graph'].args;
    expect(args.join(' ')).toContain('${ATRIX_HOME}');
    expect(args.join(' ')).not.toMatch(/\/(Users|home)\//);
  });

  test('records the harness commit so drift can be detected later', () => {
    init(harnessRoot, project);
    expect(readJson('.atrix/config.json')['harness']['commit']).toMatch(/^[0-9a-f]{7,}$/);
  });

  test('leaves semantic search off', () => {
    // Most Atrix repos are private client work; egress must be an explicit decision.
    init(harnessRoot, project);
    expect(readJson('.atrix/config.json')['semantic']['provider']).toBeNull();
  });

  test('gitignores the index and trace', () => {
    init(harnessRoot, project);
    expect(read('.gitignore')).toContain('.atrix/');
  });
});

describe('an existing repository', () => {
  test('keeps other MCP servers when merging', () => {
    writeFileSync(
      join(project, '.mcp.json'),
      JSON.stringify({ mcpServers: { playwright: { command: 'npx', args: ['-y', '@playwright/mcp'] } } }),
    );
    init(harnessRoot, project);

    const servers = readJson('.mcp.json')['mcpServers'];
    expect(servers['playwright']).toBeDefined();
    expect(servers['atrix-graph']).toBeDefined();
  });

  test('never overwrites an existing AGENTS.md', () => {
    writeFileSync(join(project, 'AGENTS.md'), '# our own manual\n');
    init(harnessRoot, project);
    expect(read('AGENTS.md')).toBe('# our own manual\n');
  });

  test('refuses to touch an unparseable .mcp.json', () => {
    // It may hold config we cannot read. Damaging it is worse than not wiring ourselves in.
    writeFileSync(join(project, '.mcp.json'), 'not json {');
    init(harnessRoot, project);
    expect(read('.mcp.json')).toBe('not json {');
  });

  test('does not duplicate the gitignore entry on a rerun', () => {
    init(harnessRoot, project);
    init(harnessRoot, project);
    expect(read('.gitignore').split('.atrix/').length - 1).toBe(1);
  });

  test('is idempotent', () => {
    init(harnessRoot, project);
    const first = read('.mcp.json');
    init(harnessRoot, project);
    expect(read('.mcp.json')).toBe(first);
  });
});

test('declines to initialise the harness itself', () => {
  init(harnessRoot, harnessRoot);
  // Would otherwise scribble a consuming-repo AGENTS.md over the org-wide manual.
  expect(readFileSync(join(harnessRoot, 'AGENTS.md'), 'utf8')).toContain('agent operating manual');
});
