import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, test } from 'bun:test';
import { build } from '../commands/build.ts';
import { parseFrontmatter } from './frontmatter.ts';
import { findHarnessRoot, harnessPaths } from './paths.ts';

/**
 * Tests the PUBLISHED ARTEFACT, not the source that produced it.
 *
 * Every other suite here proves core/ is well-formed and that build() runs. None of them
 * prove the thing we ship is loadable by the agent that consumes it — the "green unit
 * tests, broken product" class. It is not hypothetical: the hook event map was emitted at
 * the top level instead of under a `hooks` key, which parses perfectly and silently never
 * fires. Nothing caught it until the generated file was compared against installed plugins.
 *
 * The shapes asserted below are taken from plugins verified to work, not from memory.
 */

const root = findHarnessRoot(import.meta.dir);
const paths = harnessPaths(root);
const claude = join(paths.adapters, 'claude');

const readJson = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}

beforeAll(() => build(root));

describe('claude marketplace', () => {
  test('manifest declares the required fields', () => {
    const manifest = readJson(join(claude, '.claude-plugin', 'marketplace.json'));
    expect(manifest['name']).toBe('atrix-harness');
    expect(Array.isArray(manifest['plugins'])).toBe(true);
    expect(manifest['owner']).toMatchObject({ name: expect.any(String) });
  });

  test('every listed plugin exists at its declared source', () => {
    const manifest = readJson(join(claude, '.claude-plugin', 'marketplace.json'));
    const plugins = manifest['plugins'] as { name: string; source: string }[];
    expect(plugins.length).toBeGreaterThan(0);

    for (const plugin of plugins) {
      // A marketplace entry pointing at a missing directory fails at install time,
      // for every user, with no earlier signal.
      expect(existsSync(join(claude, plugin.source, '.claude-plugin', 'plugin.json'))).toBe(true);
    }
  });

  test('each plugin manifest carries name and description', () => {
    for (const plugin of readdirSync(join(claude, 'plugins'))) {
      const manifest = readJson(join(claude, 'plugins', plugin, '.claude-plugin', 'plugin.json'));
      expect(manifest['name']).toBe(plugin);
      expect(typeof manifest['description']).toBe('string');
      expect((manifest['description'] as string).length).toBeGreaterThan(20);
    }
  });
});

describe('hooks', () => {
  const hooksFile = join(claude, 'plugins', 'atrix-core', 'hooks', 'hooks.json');

  test('event map is nested under a "hooks" key', () => {
    // THE regression this file exists for. Top-level events parse and never fire.
    const config = readJson(hooksFile);
    expect(Object.keys(config)).toContain('hooks');
    expect(config['PreToolUse']).toBeUndefined();
  });

  test('declares the events we rely on', () => {
    const events = readJson(hooksFile)['hooks'] as Record<string, unknown>;
    expect(Object.keys(events).sort()).toEqual(['PostToolUse', 'PreToolUse', 'SessionStart']);
  });

  test('plugin.json points at the hook file as a list', () => {
    const manifest = readJson(join(claude, 'plugins', 'atrix-core', '.claude-plugin', 'plugin.json'));
    expect(manifest['hooks']).toEqual(['./hooks/hooks.json']);
  });

  test('every referenced hook script is actually shipped', () => {
    const events = readJson(hooksFile)['hooks'] as Record<string, { hooks: { command: string }[] }[]>;
    const commands = Object.values(events)
      .flat()
      .flatMap((entry) => entry.hooks.map((h) => h.command));

    expect(commands.length).toBeGreaterThan(0);
    for (const command of commands) {
      const script = /\$\{CLAUDE_PLUGIN_ROOT\}\/(\S+?)"/.exec(command)?.[1];
      expect(script).toBeDefined();
      expect(existsSync(join(claude, 'plugins', 'atrix-core', script as string))).toBe(true);
    }
  });
});

describe('mcp', () => {
  test('server config is parameterised on the plugin root, never machine-specific', () => {
    // These two assertions used to require ${ATRIX_HOME}, which encoded the bug: the
    // variable was set on no machine, so the server never started. The runtime always
    // expands ${CLAUDE_PLUGIN_ROOT}, which is a guarantee rather than an assumption.
    const config = readJson(join(claude, 'plugins', 'atrix-graphs', '.mcp.json'));
    const server = config['atrix-graph'] as { command: string; args: string[] };
    expect(server.command).toBe('bun');
    expect(server.args.join(' ')).toContain('${CLAUDE_PLUGIN_ROOT}');
    expect(server.args.join(' ')).not.toMatch(/\/(Users|home)\//);
  });
});

describe('agents and skills', () => {
  test('every generated agent has parseable frontmatter with name and description', () => {
    const dir = join(claude, 'plugins', 'atrix-core', 'agents');
    const agents = readdirSync(dir);
    expect(agents.length).toBeGreaterThan(5);

    for (const file of agents) {
      const { data, body } = parseFrontmatter(readFileSync(join(dir, file), 'utf8'));
      expect(data['name']).toBe(file.replace('.md', ''));
      expect(typeof data['description']).toBe('string');
      expect(body.trim().length).toBeGreaterThan(100);
    }
  });

  test('every shipped skill has a SKILL.md with name and description', () => {
    for (const plugin of ['atrix-skills', 'atrix-stack']) {
      const dir = join(claude, 'plugins', plugin, 'skills');
      if (!existsSync(dir)) continue;
      for (const skill of readdirSync(dir)) {
        const { data } = parseFrontmatter(readFileSync(join(dir, skill, 'SKILL.md'), 'utf8'));
        expect(data['name']).toBe(skill);
        expect(typeof data['description']).toBe('string');
      }
    }
  });
});

describe('cross-agent adapters', () => {
  test.each(['codex/AGENTS.md', 'gemini/GEMINI.md'])('%s carries the rules, not just the manual', (rel) => {
    const bundle = readFileSync(join(paths.adapters, rel), 'utf8');
    expect(bundle).toContain('# Rules & methodology');
    expect(bundle).toContain('bounded-recovery');
    expect(bundle.length).toBeGreaterThan(4000);
  });

  test('cursor rules are .mdc with frontmatter', () => {
    const dir = join(paths.adapters, 'cursor', '.cursor', 'rules');
    const rules = readdirSync(dir);
    expect(rules.length).toBeGreaterThan(5);

    for (const file of rules) {
      expect(file.endsWith('.mdc')).toBe(true);
      const { data } = parseFrontmatter(readFileSync(join(dir, file), 'utf8'));
      // The entry rule always applies; the rest are glob-scoped.
      expect('globs' in data || 'alwaysApply' in data).toBe(true);
    }
  });

  test('orca map points at adapters that exist', () => {
    const map = readJson(join(paths.adapters, 'orca', 'atrix-agents.json'));
    for (const agent of Object.values(map['agents'] as Record<string, { entry: string }>)) {
      expect(existsSync(join(root, agent.entry))).toBe(true);
    }
  });
});

describe('hygiene', () => {
  test('no test files leak into the shipped adapters', () => {
    const leaked = filesUnder(paths.adapters).filter((f) => f.endsWith('.test.ts') || f.endsWith('.spec.ts'));
    expect(leaked).toEqual([]);
  });

  test('nothing in adapters carries a machine-specific path', () => {
    const offenders = filesUnder(paths.adapters).filter((file) =>
      /\/(Users|home)\/[^/\s"']+/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});

describe('the workspace CLAUDE.md carries the rules', () => {
  /**
   * The delivery path for Claude Code. Rules cannot ride the SessionStart hook — Claude
   * Code inlines only a ~2KB preview past ~10,000 characters — and cannot be `@`-imported,
   * because an import resolves against the agent's working directory and so evaluates to
   * nothing from `projects/*`. Inlining into CLAUDE.md is the only form that survives both.
   *
   * See learning/incidents/incident-0007.
   */
  test('inlines every rule, not a pointer to them', () => {
    const claudeMd = readFileSync(join(root, 'CLAUDE.md'), 'utf8');
    const bundle = readFileSync(join(paths.adapters, 'codex', 'AGENTS.md'), 'utf8');
    for (const heading of bundle.match(/^## [a-z-]+$/gm) ?? []) {
      expect(claudeMd).toContain(heading);
    }
  });

  test('does not rely on an @ import', () => {
    const claudeMd = readFileSync(join(root, 'CLAUDE.md'), 'utf8');
    // `@path` resolves against cwd, so it silently yields nothing from a subdirectory.
    expect(claudeMd).not.toMatch(/^@\S+/m);
  });
});

describe('the graph MCP server is reachable', () => {
  /**
   * The config named a path that did not exist on any machine that had not exported
   * ATRIX_HOME — which was every machine, because `atrix init` only printed the export
   * as a suggestion. bun failed to resolve the module before our code ran, so the agent
   * had seven fewer tools and no error anywhere. See learning/incidents/incident-0009.
   */
  test('every path in the config exists inside the plugin', () => {
    const dir = join(claude, 'plugins', 'atrix-graphs');
    const config = readJson(join(dir, '.mcp.json'));
    const server = config['atrix-graph'] as { args: string[] };

    for (const arg of server.args) {
      if (!arg.includes('/')) continue;
      // ${CLAUDE_PLUGIN_ROOT} is expanded by the runtime to this directory.
      const resolved = arg.replace('${CLAUDE_PLUGIN_ROOT}', dir);
      expect(existsSync(resolved)).toBe(true);
    }
  });

  test('the config does not depend on an environment variable nobody sets', () => {
    const config = readJson(join(claude, 'plugins', 'atrix-graphs', '.mcp.json'));
    expect(JSON.stringify(config)).not.toContain('ATRIX_HOME');
  });
});
