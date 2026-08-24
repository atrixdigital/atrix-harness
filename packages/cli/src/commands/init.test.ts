import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { init } from './init.ts';

/**
 * `init` writes into repositories other people own, so destructiveness is the risk that
 * matters. It has two modes and picking the wrong one is itself destructive — scaffolding
 * a project's AGENTS.md over the org-wide manual would be a bad afternoon.
 */

let workspace: string;

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'atrix-init-'));
  // Make it look like a harness checkout.
  mkdirSync(join(workspace, 'core', 'rules'), { recursive: true });
  mkdirSync(join(workspace, '.git'), { recursive: true });
  writeFileSync(join(workspace, 'AGENTS.md'), '# Atrix — agent operating manual\n');
});
afterEach(() => rmSync(workspace, { recursive: true, force: true }));

const read = (rel: string): string => readFileSync(join(workspace, rel), 'utf8');
const readJson = (rel: string): Record<string, any> => JSON.parse(read(rel)) as Record<string, any>;

const makeProject = (name: string): string => {
  const root = join(workspace, 'projects', name);
  mkdirSync(join(root, 'src'), { recursive: true });
  return root;
};

describe('workspace mode', () => {
  test('wires the graph server the manual promises', () => {
    // AGENTS.md tells every agent to reach for atrix_search before reading files.
    // Scaffolding that instruction without the tools produces an agent that tries and fails.
    init(workspace, workspace);
    expect(readJson('.mcp.json')['mcpServers']['atrix-graph']).toBeDefined();
  });

  test('parameterises the server path instead of baking in this machine', () => {
    init(workspace, workspace);
    const args: string[] = readJson('.mcp.json')['mcpServers']['atrix-graph'].args;
    expect(args.join(' ')).toContain('${ATRIX_HOME}');
    expect(args.join(' ')).not.toMatch(/\/(Users|home)\//);
  });

  test('records the harness commit so drift can be reported later', () => {
    init(workspace, workspace);
    expect(readJson('.atrix/config.json')).toHaveProperty('harness');
  });

  test('leaves semantic search off', () => {
    // Most Atrix repos are private client work; egress must be an explicit decision.
    init(workspace, workspace);
    expect(readJson('.atrix/config.json')['semantic']['provider']).toBeNull();
  });

  test('does not write a project AGENTS.md over the org-wide manual', () => {
    // The mode-selection bug that would actually hurt.
    init(workspace, workspace);
    expect(read('AGENTS.md')).toContain('agent operating manual');
  });

  test('gitignores the per-developer state', () => {
    init(workspace, workspace);
    expect(read('.gitignore')).toContain('.atrix/');
  });
});

describe('project mode', () => {
  test('scaffolds the two files that belong to the project repo', () => {
    const root = makeProject('playo');
    init(workspace, root);

    // Committed to playo's own repo, so they travel with the code.
    expect(existsSync(join(root, 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(root, 'UNDERSTANDINGS.md'))).toBe(true);
  });

  test('names the project in what it writes', () => {
    const root = makeProject('playo');
    init(workspace, root);
    expect(readFileSync(join(root, 'AGENTS.md'), 'utf8')).toContain('playo');
  });

  test('does not put an .mcp.json in the project', () => {
    // One graph server covers the whole workspace; a copy per project would be wrong
    // and would fight the workspace-level one.
    const root = makeProject('playo');
    init(workspace, root);
    expect(existsSync(join(root, '.mcp.json'))).toBe(false);
  });

  test('never overwrites an AGENTS.md the project already has', () => {
    const root = makeProject('playo');
    writeFileSync(join(root, 'AGENTS.md'), '# our own manual\n');
    init(workspace, root);
    expect(readFileSync(join(root, 'AGENTS.md'), 'utf8')).toBe('# our own manual\n');
  });

  test('is idempotent', () => {
    const root = makeProject('playo');
    init(workspace, root);
    const first = readFileSync(join(root, 'UNDERSTANDINGS.md'), 'utf8');
    init(workspace, root);
    expect(readFileSync(join(root, 'UNDERSTANDINGS.md'), 'utf8')).toBe(first);
  });

  test('a nested directory inside a project still resolves to that project', () => {
    const root = makeProject('playo');
    init(workspace, join(root, 'src'));
    expect(existsSync(join(root, 'AGENTS.md'))).toBe(true);
  });
});

describe('existing workspace files', () => {
  test('keeps other MCP servers when merging', () => {
    writeFileSync(
      join(workspace, '.mcp.json'),
      JSON.stringify({ mcpServers: { playwright: { command: 'npx', args: ['-y', '@playwright/mcp'] } } }),
    );
    init(workspace, workspace);

    const servers = readJson('.mcp.json')['mcpServers'];
    expect(servers['playwright']).toBeDefined();
    expect(servers['atrix-graph']).toBeDefined();
  });

  test('refuses to touch an unparseable .mcp.json', () => {
    // It may hold config we cannot read; damaging it is worse than not wiring in.
    writeFileSync(join(workspace, '.mcp.json'), 'not json {');
    init(workspace, workspace);
    expect(read('.mcp.json')).toBe('not json {');
  });

  test('does not duplicate the gitignore entry on a rerun', () => {
    init(workspace, workspace);
    init(workspace, workspace);
    expect(read('.gitignore').split('.atrix/').length - 1).toBe(1);
  });
});
