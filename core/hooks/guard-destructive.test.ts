import { describe, expect, test } from 'bun:test';
import { evaluate } from './guard-destructive.ts';

/**
 * Both directions matter equally. A guard that flags everything gets disabled within
 * a week, which is strictly worse than no guard at all — so the false-positive cases
 * are as load-bearing as the true positives.
 */

describe('passes ordinary commands silently', () => {
  test.each([
    'ls -la',
    'bun test',
    'bun run typecheck',
    'git commit -m "fix the thing"',
    'git push origin feature/booking-slots',
    'npm run build',
    'rm file.txt',
    'rm -r ./tmp',
    'docker compose up -d',
    'psql -c "SELECT count(*) FROM users"',
    'grep -rn producer src/',
    'vercel --help',
  ])('%s', (command) => {
    expect(evaluate(command)).toEqual([]);
  });
});

describe('flags destructive and outward-facing commands', () => {
  test.each([
    ['rm -rf build', 'recursive force delete'],
    ['rm -fr build', 'recursive force delete'],
    ['git reset --hard origin/main', 'discards uncommitted work irreversibly'],
    ['git push --force', 'rewrites history on a remote others may have pulled'],
    ['git push -f origin main', 'rewrites history on a remote others may have pulled'],
    ['psql -c "DROP TABLE users"', 'drops or truncates a database object'],
    ['psql -c "truncate bookings"', 'drops or truncates a database object'],
    ['npx prisma migrate dev', 'destructive migration — resets the database'],
    ['kubectl delete pod api-0', 'deletes a live Kubernetes resource'],
    ['npm publish', 'publishes a package or release'],
    ['gh release create v1.2.0', 'publishes a package or release'],
    ['fly deploy', 'deploys'],
  ])('%s → %s', (command, reason) => {
    expect(evaluate(command)).toContain(reason);
  });
});

describe('production targeting', () => {
  test.each(['psql $PROD_DATABASE_URL', 'kubectl config use-context production', 'bun run deploy:prod'])(
    'flags %s',
    (command) => {
      expect(evaluate(command)).toContain('targets a production environment');
    },
  );

  test('does not flag words that merely contain "prod"', () => {
    // The regression this guards: `producer`, `product`, `reproduce` are everywhere
    // in a codebase, and flagging them is what gets a safety hook switched off.
    for (const command of ['grep producer src/', 'bun test product.test.ts', 'npm run reproduce-bug']) {
      expect(evaluate(command)).not.toContain('targets a production environment');
    }
  });
});

test('reports every matching reason, not just the first', () => {
  expect(evaluate('vercel --prod')).toEqual(['targets a production environment', 'deploys']);
});
