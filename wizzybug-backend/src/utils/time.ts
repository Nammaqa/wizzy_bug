// Helper to render timestamps in India Standard Time (Asia/Kolkata) regardless of
// where the server itself is hosted. Dates are still stored as real UTC Date objects
// in MongoDB; this only affects how they are displayed.
export const toIST = (date: Date | string | undefined | null): string | null => {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};
