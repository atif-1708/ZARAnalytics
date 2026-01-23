
export const formatZAR = (amount: number): string => {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2
  }).format(amount);
};

export const formatPKR = (amount: number): string => {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 2
  }).format(amount);
};

export const formatCurrency = (amount: number, currency: 'ZAR' | 'PKR'): string => {
  if (currency === 'PKR') return formatPKR(amount);
  return formatZAR(amount);
};

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export const formatMonth = (monthString: string): string => {
  const [year, month] = monthString.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-ZA', { year: 'numeric', month: 'long' });
};

/**
 * Returns a timestamp string (ISO format) relative to the user's local timezone.
 * Used to ensure transactions are logged at "Wall Clock" time, not UTC.
 */
export const getLocalISOString = (): string => {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  const localTime = new Date(now.getTime() - offsetMs);
  return localTime.toISOString().slice(0, -1); // Removes the 'Z' to indicate local time context
};
