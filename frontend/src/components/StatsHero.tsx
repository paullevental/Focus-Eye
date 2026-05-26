import { useMemo } from 'react';
import { Flame, Layers, Clock } from 'lucide-react';
import type { StudySession } from '../api/sessions';
import FocusRing from './FocusRing';
import './StatsHero.css';

interface Props {
  sessions: StudySession[];
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatHours(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const totalMins = Math.round(seconds / 60);
  if (totalMins < 60) return `${totalMins}m`;
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Compute consecutive-day streak ending today. A day "counts" if there is at
 * least one session that started on that day. If there's no session today
 * the streak still counts as long as there was one yesterday and earlier.
 */
function computeStreak(sessions: StudySession[]): number {
  if (sessions.length === 0) return 0;
  const days = new Set(
    sessions.map((s) => startOfDay(new Date(s.startTime)).getTime())
  );
  let cursor = startOfDay(new Date());
  // If nothing today, start counting from yesterday.
  if (!days.has(cursor.getTime())) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(cursor.getTime())) return 0;
  }
  let streak = 0;
  while (days.has(cursor.getTime())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default function StatsHero({ sessions }: Props) {
  const today = useMemo(() => new Date(), []);

  const stats = useMemo(() => {
    let focusToday = 0;
    let distractedToday = 0;
    let sessionsToday = 0;
    let allTimeFocus = 0;

    for (const s of sessions) {
      const started = new Date(s.startTime);
      const focus = s.deepFocusDuration ?? 0;
      const distracted = s.partialDistractionDuration ?? 0;
      allTimeFocus += focus;
      if (isSameDay(started, today)) {
        focusToday += focus;
        distractedToday += distracted;
        sessionsToday += 1;
      }
    }

    return {
      focusToday,
      distractedToday,
      sessionsToday,
      allTimeFocus,
      streak: computeStreak(sessions),
    };
  }, [sessions, today]);

  return (
    <section className="stats-hero">
      <div className="stats-hero-bg" aria-hidden />

      <div className="stats-hero-ring">
        <FocusRing
          focusSeconds={stats.focusToday}
          distractedSeconds={stats.distractedToday}
        />
        <div className="stats-hero-ring-legend">
          <div className="legend-row">
            <span className="legend-dot focus" />
            <span className="legend-label">Deep focus</span>
            <span className="legend-value">{formatHours(stats.focusToday)}</span>
          </div>
          <div className="legend-row">
            <span className="legend-dot distracted" />
            <span className="legend-label">Distracted</span>
            <span className="legend-value">{formatHours(stats.distractedToday)}</span>
          </div>
        </div>
      </div>

      <div className="stats-hero-tiles">
        <div className="stats-tile">
          <div className="stats-tile-icon streak"><Flame size={18} /></div>
          <div className="stats-tile-body">
            <div className="stats-tile-value">{stats.streak}<span>{stats.streak === 1 ? 'day' : 'days'}</span></div>
            <div className="stats-tile-label">Current streak</div>
          </div>
        </div>

        <div className="stats-tile">
          <div className="stats-tile-icon sessions"><Layers size={18} /></div>
          <div className="stats-tile-body">
            <div className="stats-tile-value">{stats.sessionsToday}<span>{stats.sessionsToday === 1 ? 'session' : 'sessions'}</span></div>
            <div className="stats-tile-label">Today</div>
          </div>
        </div>

        <div className="stats-tile">
          <div className="stats-tile-icon total"><Clock size={18} /></div>
          <div className="stats-tile-body">
            <div className="stats-tile-value-text">{formatHours(stats.allTimeFocus)}</div>
            <div className="stats-tile-label">All-time focus</div>
          </div>
        </div>
      </div>
    </section>
  );
}
