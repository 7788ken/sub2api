import { useMemo } from 'react';

type UsageProgressProps = {
  currentUsed: number;
  totalQuota: number;
  size?: number;
};

const STROKE_WIDTH = 6;

export function getStatusColor(percent: number): string {
  if (percent >= 95) return 'var(--ssc-status-critical)';
  if (percent >= 80) return 'var(--ssc-status-danger)';
  if (percent >= 60) return 'var(--ssc-status-warning)';
  return 'var(--ssc-status-healthy)';
}

export function getStatusRawColor(percent: number): string {
  if (percent >= 95) return '#f85149';
  if (percent >= 80) return '#f97316';
  if (percent >= 60) return '#d29922';
  return '#3fb950';
}

export function UsageProgress({ currentUsed, totalQuota, size = 100 }: UsageProgressProps) {
  const safeTotal = Math.max(totalQuota, 1);
  const percent = Math.min(100, (currentUsed / safeTotal) * 100);

  const { radius, circumference, offset, color } = useMemo(() => {
    const r = (size - STROKE_WIDTH) / 2;
    const c = 2 * Math.PI * r;
    return {
      radius: r,
      circumference: c,
      offset: c - (percent / 100) * c,
      color: getStatusColor(percent),
    };
  }, [size, percent]);

  const center = size / 2;

  return (
    <div className="ssc-ring-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--ssc-border)"
          strokeWidth={STROKE_WIDTH}
        />
        <circle
          className="ssc-ring-arc"
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={STROKE_WIDTH}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${center} ${center})`}
        />
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--ssc-text)"
          fontSize="18"
          fontWeight="700"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {percent.toFixed(0)}%
        </text>
      </svg>
    </div>
  );
}
