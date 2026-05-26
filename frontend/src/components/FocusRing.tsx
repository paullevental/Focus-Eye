import { useEffect, useRef, useState } from 'react';
import './FocusRing.css';

interface Props {
  /** Seconds of deep focus today */
  focusSeconds: number;
  /** Seconds of partial distraction today */
  distractedSeconds: number;
  /** Daily focus goal in seconds (defaults to 60 min) */
  goalSeconds?: number;
  /** Diameter in px */
  size?: number;
}

const DEFAULT_GOAL = 60 * 60;

/**
 * Concentric SVG ring inspired by Apple Activity rings. Outer ring is deep
 * focus progress toward the daily goal; inner ring is distraction time
 * (capped at the same goal for visual scale). Animates from empty on mount
 * via stroke-dashoffset.
 */
export default function FocusRing({
  focusSeconds,
  distractedSeconds,
  goalSeconds = DEFAULT_GOAL,
  size = 200,
}: Props) {
  // Track mount so we can animate from 0 → real value once.
  const [mounted, setMounted] = useState(false);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    raf.current = requestAnimationFrame(() => setMounted(true));
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, []);

  const strokeOuter = 14;
  const strokeInner = 10;
  const padding = 4;

  const rOuter = size / 2 - strokeOuter / 2 - padding;
  const rInner = rOuter - strokeOuter - 8;

  const cOuter = 2 * Math.PI * rOuter;
  const cInner = 2 * Math.PI * rInner;

  const focusPct = Math.min(1, focusSeconds / goalSeconds);
  const distractedPct = Math.min(1, distractedSeconds / goalSeconds);

  const focusOffset = mounted ? cOuter * (1 - focusPct) : cOuter;
  const distractedOffset = mounted ? cInner * (1 - distractedPct) : cInner;

  const focusMins = Math.round(focusSeconds / 60);
  const goalMins = Math.round(goalSeconds / 60);

  return (
    <div className="focus-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* track — outer */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={rOuter}
          fill="none"
          stroke="var(--surface-muted)"
          strokeWidth={strokeOuter}
        />
        {/* progress — outer (focus) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={rOuter}
          fill="none"
          stroke="var(--focus)"
          strokeWidth={strokeOuter}
          strokeLinecap="round"
          strokeDasharray={cOuter}
          strokeDashoffset={focusOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
        {/* track — inner */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={rInner}
          fill="none"
          stroke="var(--surface-muted)"
          strokeWidth={strokeInner}
        />
        {/* progress — inner (distraction) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={rInner}
          fill="none"
          stroke="var(--warn)"
          strokeWidth={strokeInner}
          strokeLinecap="round"
          strokeDasharray={cInner}
          strokeDashoffset={distractedOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1.1s 0.1s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <div className="focus-ring-label">
        <div className="focus-ring-value">{focusMins}<span>m</span></div>
        <div className="focus-ring-goal">of {goalMins}m goal</div>
      </div>
    </div>
  );
}
