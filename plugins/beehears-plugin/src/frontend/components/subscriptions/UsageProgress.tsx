import type React from 'react';
import { useMemo } from 'react';
import { usePlugin } from '../../i18n/context';

type UsageProgressProps = {
  currentUsed: number;
  totalQuota: number;
  size?: number;
};

const STROKE_WIDTH = 4;

function getGlowColor(currentUsed: number): string {
  return currentUsed > 0 ? 'rgba(248, 113, 113, 0.4)' : 'rgba(52, 211, 153, 0.4)';
}

export function getUsageStateColor(currentUsed: number): string {
  return currentUsed > 0 ? 'var(--ssc-status-critical)' : 'var(--ssc-status-healthy)';
}

export function getUsageStateRawColor(currentUsed: number): string {
  return currentUsed > 0 ? '#f85149' : '#3fb950';
}

function getUsageTrackColor(currentUsed: number): string {
  return currentUsed > 0 ? 'rgba(248, 113, 113, 0.24)' : 'rgba(52, 211, 153, 0.24)';
}

export function UsageProgress({ currentUsed, totalQuota, size = 100 }: UsageProgressProps) {
  const { t } = usePlugin();
  const safeTotal = Math.max(totalQuota, 1);
  const percent = Math.min(100, (currentUsed / safeTotal) * 100);

  const { radius, circumference, offset, color } = useMemo(() => {
    const r = (size - STROKE_WIDTH) / 2;
    const c = 2 * Math.PI * r;
    return {
      radius: r,
      circumference: c,
      offset: c - (percent / 100) * c,
      color: getUsageStateColor(currentUsed),
    };
  }, [size, percent, currentUsed]);

  const center = size / 2;

  return (
    <div className="ssc-ring-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={getUsageTrackColor(currentUsed)}
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
          style={{ '--ssc-ring-glow': getGlowColor(currentUsed), '--ssc-ring-circumference': circumference } as React.CSSProperties}
        />
        <text
          x={center}
          y={center - 6}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--ssc-text)"
          fontSize="18"
          fontWeight="700"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {percent.toFixed(0)}%
        </text>
        <text
          x={center}
          y={center + 12}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--ssc-text-muted)"
          fontSize="10"
          fontWeight="500"
        >
          {t.usage_label ?? 'used'}
        </text>
      </svg>
    </div>
  );
}
