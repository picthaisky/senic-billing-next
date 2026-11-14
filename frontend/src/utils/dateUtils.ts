/**
 * Format a Date object into YYYY-MM-DD in the user's local timezone (e.g. Asia/Bangkok),
 * avoiding the UTC off-by-one-day shift that occurs before 07:00 local time.
 */
export function getLocalIsoDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

