import { expect, test } from 'bun:test';
import { listBookings } from '../src/bookings.ts';

const sessionA = { userId: 'u1', orgId: 'org-a' };

test('listBookings returns only the caller org', () => {
  const rows = listBookings(sessionA);
  expect(rows).toHaveLength(1);
  expect(rows[0]?.orgId).toBe('org-a');
});
