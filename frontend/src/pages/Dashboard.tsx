import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Search } from 'lucide-react';
import { sessionsApi, type StudySession } from '../api/sessions';
import { useProfile } from '../context/ProfileContext';
import SessionCard from '../components/SessionCard';
import UserMenu from '../components/UserMenu';
import ThemeToggle from '../components/ThemeToggle';
import StatsHero from '../components/StatsHero';
import './Dashboard.css';

type SortKey =
  | 'newest'
  | 'oldest'
  | 'longestFocus'
  | 'shortestFocus'
  | 'longestTotal';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'longestFocus', label: 'Longest focus' },
  { value: 'shortestFocus', label: 'Shortest focus' },
  { value: 'longestTotal', label: 'Longest total' },
];

const total = (s: StudySession) =>
  (s.deepFocusDuration ?? 0) +
  (s.partialDistractionDuration ?? 0) +
  (s.absentDuration ?? 0);

const ACTIVE_POLL_MS = 2000;

export default function Dashboard() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const username = profile!.firstName; // guard ensures profile exists

  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [sort, setSort] = useState<SortKey>('newest');
  const [query, setQuery] = useState('');

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const list = await sessionsApi.list(username);
      setSessions(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sessions.');
    } finally {
      setLoading(false);
    }
  }, [username]);

  // Initial history load.
  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  // Light poll for an in-progress session so the resume banner stays accurate.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const open = await sessionsApi.active(username);
        if (!cancelled) setActiveSession(open);
      } catch {
        // backend may be transient; surface only on initial history load
      }
    };
    void tick();
    const id = setInterval(tick, ACTIVE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [username]);

  const visible = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    let list = sessions;
    if (trimmed) {
      list = list.filter((s) => {
        const haystack = `${s.title ?? ''} ${s.notes ?? ''}`.toLowerCase();
        return haystack.includes(trimmed);
      });
    }
    const sorted = [...list];
    switch (sort) {
      case 'oldest':
        sorted.sort((a, b) => a.startTime.localeCompare(b.startTime));
        break;
      case 'longestFocus':
        sorted.sort((a, b) => (b.deepFocusDuration ?? 0) - (a.deepFocusDuration ?? 0));
        break;
      case 'shortestFocus':
        sorted.sort((a, b) => (a.deepFocusDuration ?? 0) - (b.deepFocusDuration ?? 0));
        break;
      case 'longestTotal':
        sorted.sort((a, b) => total(b) - total(a));
        break;
      case 'newest':
      default:
        sorted.sort((a, b) => b.startTime.localeCompare(a.startTime));
        break;
    }
    return sorted;
  }, [sessions, sort, query]);

  const headline = profile?.firstName
    ? `Welcome back, ${profile.firstName}.`
    : 'Welcome back.';

  return (
    <div className="dash-shell">
      <nav className="dash-topbar">
        <div className="dash-brand">FocusEye</div>
        <div className="dash-topbar-right">
          <ThemeToggle />
          <UserMenu />
        </div>
      </nav>

      <main className="dash-main">
        <header className="dash-hero">
          <div className="dash-hero-text">
            <h1 className="headline-h1">{headline}</h1>
            <p>
              {sessions.length === 0
                ? 'Start your first session to see it appear here.'
                : `${sessions.length} session${sessions.length === 1 ? '' : 's'} logged.`}
            </p>
          </div>

          <button
            type="button"
            className="dash-start-btn"
            onClick={() => navigate('/session')}
          >
            <Play size={18} fill="currentColor" />
            Start Study Session
          </button>
        </header>

        {activeSession && (
          <button
            type="button"
            className="dash-resume-banner"
            onClick={() => navigate('/session')}
          >
            <span className="dash-resume-dot" />
            <span className="dash-resume-text">
              You have a {activeSession.status.toLowerCase()} session in progress.
            </span>
            <span className="dash-resume-cta">Resume →</span>
          </button>
        )}

        <StatsHero sessions={sessions} />

        <section className="dash-toolbar">
          <div className="dash-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search by title or notes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="dash-filter-row" role="tablist" aria-label="Sort sessions">
            {SORT_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.value}
                role="tab"
                aria-selected={sort === opt.value}
                className={`dash-filter-chip ${sort === opt.value ? 'is-active' : ''}`}
                onClick={() => setSort(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {error && <div className="dash-error">{error}</div>}

        {loading && sessions.length === 0 ? (
          <div className="dash-empty">Loading sessions…</div>
        ) : visible.length === 0 ? (
          <div className="dash-empty">
            {sessions.length === 0
              ? 'No sessions yet. Hit Start Study Session above to record your first.'
              : 'No sessions match that search.'}
          </div>
        ) : (
          <div className="dash-grid">
            {visible.map((s, i) => (
              <SessionCard key={s.id} session={s} index={i} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
