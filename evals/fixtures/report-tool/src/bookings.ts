export interface Booking {
  id: string;
  venue: string;
  amountMinor: number;
  currency: string;
  status: 'confirmed' | 'cancelled';
}

export const bookings: Booking[] = [
  { id: 'b1', venue: 'Court 1', amountMinor: 5000, currency: 'AED', status: 'confirmed' },
  { id: 'b2', venue: 'Court 2', amountMinor: 7500, currency: 'AED', status: 'cancelled' },
  { id: 'b3', venue: 'Court 1', amountMinor: 5000, currency: 'AED', status: 'confirmed' },
];
