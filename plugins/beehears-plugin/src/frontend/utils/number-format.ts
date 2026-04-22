function truncateToFractionDigits(value: number, fractionDigits: number): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** fractionDigits;
  return value >= 0
    ? Math.trunc(value * factor) / factor
    : Math.trunc(value * factor) / factor;
}

export function formatDisplayQuota(value: number, fractionDigits = 2): string {
  const truncated = truncateToFractionDigits(value, fractionDigits);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(truncated);
}
