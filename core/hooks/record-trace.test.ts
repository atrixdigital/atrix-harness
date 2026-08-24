import { describe, expect, test } from 'bun:test';
import { failedFrom, programOf, signatureOf, toRecord } from './record-trace.ts';

/**
 * Redaction is the load-bearing property. This file is written into a working repo, so a
 * regression here does not degrade a feature — it leaks. These tests come first for that reason.
 */
describe('redaction', () => {
  test('records the program from a shell command, never the arguments', () => {
    expect(programOf('psql "postgresql://user:hunter2@db.example.com/prod" -c "SELECT * FROM users"')).toBe('psql');
  });

  test('sees through env assignments and sudo', () => {
    expect(programOf('DATABASE_URL=postgres://secret@host bun run migrate')).toBe('bun');
    expect(programOf('sudo rm -rf /var/lib/thing')).toBe('rm');
  });

  test.each([
    ['cd projects/playo && psql -c "SELECT 1"', 'psql'],
    ['cd apps/api && bun test', 'bun'],
    ['DATABASE_URL=x cd foo && npx prisma migrate deploy', 'prisma'],
    ['cat file | grep pattern', 'cat'],
    ['cd somewhere', 'cd'],
  ])('attributes %s to %s, not to navigation', (command, expected) => {
    // Taking the first word attributes every compound command in a workspace to `cd`,
    // so every failure clusters under one meaningless label.
    expect(programOf(command)).toBe(expected);
  });

  test('strips quoted strings, paths, numbers and hex from a signature', () => {
    const sig = signatureOf('Error: connect ECONNREFUSED 127.0.0.1:6382 at /Users/someone/app/src/db.ts:41');
    expect(sig).not.toContain('someone');
    expect(sig).not.toContain('6382');
    expect(sig).toContain('ECONNREFUSED');
  });

  test('strips a token that appears inside quotes', () => {
    const sig = signatureOf('auth failed for key "sk-live-abc123def456"');
    expect(sig).not.toContain('sk-live');
    expect(sig).toContain('auth failed');
  });

  test('never records the command itself', () => {
    const record = toRecord(
      { tool_name: 'Bash', tool_input: { command: 'curl -H "Authorization: Bearer sk-secret" https://api.x' }, tool_response: { is_error: true, stderr: 'curl: (7) Failed to connect' } },
      '2026-08-21',
    );
    expect(JSON.stringify(record)).not.toContain('sk-secret');
    expect(JSON.stringify(record)).not.toContain('Authorization');
    expect(record?.program).toBe('curl');
  });

  test('records the date, not the time — this is not a keystroke log', () => {
    const record = toRecord({ tool_name: 'Read', tool_response: 'ok' }, '2026-08-21');
    expect(record?.date).toBe('2026-08-21');
    expect(JSON.stringify(record)).not.toMatch(/\d{2}:\d{2}/);
  });
});

describe('failure detection', () => {
  test.each([
    [{ is_error: true, stderr: 'boom' }, true],
    [{ exit_code: 1, stderr: 'boom' }, true],
    [{ exit_code: 0, stdout: 'fine' }, false],
    ['Error: something broke', true],
    ['all good', false],
  ])('%p → failed=%p', (response, expected) => {
    expect(failedFrom(response).failed).toBe(expected);
  });

  test('does not attach a signature to a success', () => {
    expect(toRecord({ tool_name: 'Read', tool_response: 'contents' }, '2026-08-21')?.signature).toBeUndefined();
  });
});

describe('hostnames', () => {
  test('strips a hostname, which may be internal infrastructure', () => {
    const sig = signatureOf('curl: (7) Failed to connect to api.internal.acme.corp port 443');
    expect(sig).not.toContain('acme');
    expect(sig).toContain('Failed to connect');
  });

  test('strips a two-label host with a common TLD', () => {
    expect(signatureOf('getaddrinfo ENOTFOUND zylos.ai')).not.toContain('zylos');
  });

  test('does not eat filenames, which signatures need', () => {
    // Over-stripping is the other failure mode: it collapses distinct errors into one
    // useless cluster.
    const sig = signatureOf('Cannot find module package.json');
    expect(sig).toContain('package.json');
  });
});

test('the same failure across runs produces one signature', () => {
  // This is what makes clustering work: differing paths, ports and pids must collapse.
  const a = signatureOf('Error: connect ECONNREFUSED 127.0.0.1:5432 at /Users/a/x.ts:10');
  const b = signatureOf('Error: connect ECONNREFUSED 127.0.0.1:6382 at /Users/b/y.ts:99');
  expect(a).toBe(b);
});
