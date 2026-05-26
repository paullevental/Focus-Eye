import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Brain,
  AlertCircle,
  UserMinus,
  TrendingUp,
  BarChart3,
  Save,
  Trash2,
  Edit3,
  X,
} from 'lucide-react';
import { sessionsApi, type StudySession } from '../api/sessions';
import { useProfile } from '../context/ProfileContext';
import FocusGraph from '../components/FocusGraph';
import UserMenu from '../components/UserMenu';
import ThemeToggle from '../components/ThemeToggle';
import './SessionDetail.css';

const totalDuration = (s: StudySession): number =>
  (s.deepFocusDuration ?? 0) +
  (s.partialDistractionDuration ?? 0) +
  (s.absentDuration ?? 0);

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs ? `${mins}m ${secs}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins ? `${hours}h ${remMins}m` : `${hours}h`;
};

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useProfile();

  const [session, setSession] = useState<StudySession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const sessionId = Number(id);
  const username = profile?.firstName ?? '';

  const load = useCallback(async () => {
    if (!Number.isFinite(sessionId) || !username) return;
    setLoading(true);
    try {
      const s = await sessionsApi.get(sessionId, username);
      setSession(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load session.');
    } finally {
      setLoading(false);
    }
  }, [sessionId, username]);

  useEffect(() => { void load(); }, [load]);

  const beginEdit = () => {
    if (!session) return;
    setTitleDraft(session.title ?? '');
    setNotesDraft(session.notes ?? '');
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!session) return;
    setSaving(true);
    try {
      const updated = await sessionsApi.update(session.id, username, {
        title: titleDraft,
        notes: notesDraft,
      });
      setSession(updated);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!session) return;
    if (!window.confirm('Delete this session permanently?')) return;
    try {
      await sessionsApi.delete(session.id, username);
      navigate('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete session.');
    }
  };

  const total = useMemo(() => (session ? totalDuration(session) || 1 : 1), [session]);

  if (loading) {
    return (
      <div className="detail-shell">
        <main className="detail-main"><p className="detail-empty">Loading session…</p></main>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="detail-shell">
        <main className="detail-main">
          <button className="detail-back" onClick={() => navigate('/')}>
            <ArrowLeft size={16} /> Back to dashboard
          </button>
          <p className="detail-empty error">{error || 'Session not found.'}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="detail-shell">
      <nav className="detail-topbar">
        <button className="detail-back" onClick={() => navigate('/')}>
          <ArrowLeft size={16} /> Dashboard
        </button>
        <div className="detail-topbar-right">
          <ThemeToggle />
          <UserMenu />
        </div>
      </nav>

      <main className="detail-main">
        <header className="detail-header">
          <div className="detail-title-row">
            {editing ? (
              <input
                className="detail-title-edit"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                maxLength={120}
                placeholder="Session title"
                autoFocus
              />
            ) : (
              <h1>{session.title || 'Untitled session'}</h1>
            )}
            <div className={`detail-status-pill ${session.status.toLowerCase()}`}>
              {session.status}
            </div>
          </div>
          <p className="detail-meta">
            {new Date(session.startTime).toLocaleString()} • {formatDuration(totalDuration(session))}
          </p>

          <div className="detail-actions">
            {editing ? (
              <>
                <button className="detail-btn primary" onClick={saveEdit} disabled={saving}>
                  <Save size={16} /> {saving ? 'Saving…' : 'Save'}
                </button>
                <button className="detail-btn ghost" onClick={() => setEditing(false)} disabled={saving}>
                  <X size={16} /> Cancel
                </button>
              </>
            ) : (
              <>
                <button className="detail-btn ghost" onClick={beginEdit}>
                  <Edit3 size={16} /> Edit
                </button>
                <button className="detail-btn danger" onClick={handleDelete}>
                  <Trash2 size={16} /> Delete
                </button>
              </>
            )}
          </div>
        </header>

        <section className="detail-grid">
          <div className="detail-left">
            <div className="detail-stats">
              <div className="detail-stat focus">
                <div className="detail-stat-head"><Brain size={16} /><label>Deep Focus</label></div>
                <div className="detail-stat-value">{formatDuration(session.deepFocusDuration ?? 0)}</div>
                {session.longestFocusPeriod && (
                  <div className="detail-stat-foot">Longest: {session.longestFocusPeriod}</div>
                )}
              </div>
              <div className="detail-stat distracted">
                <div className="detail-stat-head"><AlertCircle size={16} /><label>Distracted</label></div>
                <div className="detail-stat-value">{formatDuration(session.partialDistractionDuration ?? 0)}</div>
                {session.longestDistractionPeriod && (
                  <div className="detail-stat-foot">Longest: {session.longestDistractionPeriod}</div>
                )}
              </div>
              <div className="detail-stat absent">
                <div className="detail-stat-head"><UserMinus size={16} /><label>Absent</label></div>
                <div className="detail-stat-value">{formatDuration(session.absentDuration ?? 0)}</div>
                {session.longestAbsentPeriod && (
                  <div className="detail-stat-foot">Longest: {session.longestAbsentPeriod}</div>
                )}
              </div>
            </div>

            <div className="detail-card">
              <div className="detail-card-head">
                <TrendingUp size={18} color="#10b981" />
                <h2>Focus Intensity</h2>
              </div>
              <FocusGraph scores={session.focusScores ?? []} />
            </div>

            <div className="detail-card">
              <div className="detail-card-head">
                <BarChart3 size={18} color="#0071e3" />
                <h2>Distribution</h2>
              </div>
              <div className="detail-bar">
                <span className="seg focus" style={{ width: `${((session.deepFocusDuration ?? 0) / total) * 100}%` }} />
                <span className="seg distracted" style={{ width: `${((session.partialDistractionDuration ?? 0) / total) * 100}%` }} />
                <span className="seg absent" style={{ width: `${((session.absentDuration ?? 0) / total) * 100}%` }} />
              </div>
              <div className="detail-legend">
                <div><span className="dot focus" /> Deep Focus</div>
                <div><span className="dot distracted" /> Partial</div>
                <div><span className="dot absent" /> Absent</div>
              </div>
            </div>
          </div>

          <aside className="detail-right">
            <div className="detail-card">
              <div className="detail-card-head">
                <Edit3 size={18} />
                <h2>Notes</h2>
              </div>
              {editing ? (
                <textarea
                  className="detail-notes-edit"
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  maxLength={2000}
                  rows={10}
                  placeholder="What were you working on? Anything notable about this session?"
                />
              ) : session.notes ? (
                <p className="detail-notes">{session.notes}</p>
              ) : (
                <p className="detail-empty subtle">No notes for this session.</p>
              )}
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
