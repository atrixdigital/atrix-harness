import { allBookings, type Booking } from './db.ts';

export interface Session {
  userId: string;
  orgId: string;
}

export function listBookings(session: Session): Booking[] {
  return allBookings().filter((b) => b.orgId === session.orgId);
}

// TODO: add getBooking
