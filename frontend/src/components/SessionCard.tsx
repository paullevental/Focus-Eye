import { useNavigate } from 'react-router-dom';
import { Brain, AlertCircle, UserMinus, Clock } from 'lucide-react';
import type { StudySession } from '../api/sessions';
import './SessionCard.css';

interface Props {
  session: StudySession;
  /** zero-based position for staggered entrance animation */
  index?: number;
}

function totalDuration(s: StudySession): number {
  return (
    (s.deepFocusDuration ?? 0) +
    (s.partialDistractionDuration ?? 0) +
    (s.absentDuration ?? 0)
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs ? `${mins}m ${secs}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins ? `${hours}h ${remMins}m` : `${hours}h`;
}

function relativeDate(iso: string): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return iso;
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const day = 86_400_000;
  const sameDay =
    then.getFullYear() === now.getFullYear() &&
    then.getMonth() === now.getMonth() &&
    then.getDate() === now.getDate();
  if (sameDay) {
    return `Today, ${then.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (
    then.getFullYear() === yesterday.getFullYear() &&
    then.getMonth() === yesterday.getMonth() &&
    then.getDate() === yesterday.getDate()
  ) {
    return `Yesterday, ${then.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }
  const days = Math.floor(diffMs / day);
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SessionCard({ session, index = 0 }: Props) {
  const navigate = useNavigate();
  const total = totalDuration(session) || 1;

  const focusPct = ((session.deepFocusDuration ?? 0) / total) * 100;
  const partialPct = ((session.partialDistractionDuration ?? 0) / total) * 100;
  const absentPct = ((session.absentDuration ?? 0) / total) * 100;

  return (
    <button
      type="button"
      className="session-card"
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
      onClick={() => navigate(`/sessions/${session.id}`)}
    >
      <div className="session-card-head">
        <h3>{session.title || 'Untitled session'}</h3>
        <span className="session-card-date">{relativeDate(session.startTime)}</span>
      </div>

      <div className="session-card-stats">
        <div className="session-card-stat focus">
          <Brain size={14} />
          <span>{formatDuration(session.deepFocusDuration ?? 0)}</span>
        </div>
        <div className="session-card-stat distracted">
          <AlertCircle size={14} />
          <span>{formatDuration(session.partialDistractionDuration ?? 0)}</span>
        </div>
        <div className="session-card-stat absent">
          <UserMinus size={14} />
          <span>{formatDuration(session.absentDuration ?? 0)}</span>
        </div>
      </div>

      <div className="session-card-bar" aria-hidden>
        <span className="seg focus" style={{ width: `${focusPct}%` }} />
        <span className="seg distracted" style={{ width: `${partialPct}%` }} />
        <span className="seg absent" style={{ width: `${absentPct}%` }} />
      </div>

      <div className="session-card-foot">
        <Clock size={12} />
        <span>{formatDuration(totalDuration(session))} total</span>
      </div>
    </button>
  );
}
