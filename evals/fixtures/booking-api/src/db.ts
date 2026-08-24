export interface Booking {
  id: string;
  orgId: string;
  venue: string;
  startsAt: string;
}

const ROWS: Booking[] = [
  { id: 'b1', orgId: 'org-a', venue: 'Court 1', startsAt: '2026-09-01T10:00:00Z' },
  { id: 'b2', orgId: 'org-b', venue: 'Court 2', startsAt: '2026-09-01T11:00:00Z' },
];

/** Every row, unfiltered. Callers are responsible for scoping. */
export function allBookings(): Booking[] {
  return ROWS;
}
