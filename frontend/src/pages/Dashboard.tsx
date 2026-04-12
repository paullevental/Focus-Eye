import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Brain, 
  AlertCircle, 
  UserMinus, 
  Save, 
  History,
  ChevronRight,
  TrendingUp,
  Play,
  Trash2
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Dashboard.css';

interface SessionStats {
  deepFocus: number;
  partialDistraction: number;
  absent: number;
  duration: number;
  focusScores: number[];
}

const FocusGraph = ({ scores }: { scores: number[] }) => {
  const data = scores && scores.length > 0 ? scores.slice(-20) : [0];
  const width = 800;
  const height = 150;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 20;

  const points = data.map((d, i) => {
    const x = (i / Math.max(1, data.length - 1)) * (width - paddingLeft - paddingRight) + paddingLeft;
    const y = height - ((d / 100) * (height - paddingTop - paddingBottom) + paddingBottom);
    return `${x},${y}`;
  }).join(' ');

  const yLabels = [100, 75, 50, 25, 0];

  return (
    <div className="graph-wrapper">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        {yLabels.map((label) => {
          const y = height - ((label / 100) * (height - paddingTop - paddingBottom) + paddingBottom);
          return (
            <g key={label}>
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#e8e8ed" strokeWidth="1" strokeDasharray="4,4" />
              <text x={paddingLeft - 10} y={y + 4} textAnchor="end" fill="#86868b" fontSize="10" fontWeight="600">{label}%</text>
            </g>
          );
        })}
        {data.length > 1 && (
          <>
            <path d={`M ${paddingLeft},${height - paddingBottom} ${points} L ${width - paddingRight},${height - paddingBottom} Z`} fill="url(#gradient)" />
            <polyline fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={points} />
          </>
        )}
      </svg>
    </div>
  );
};

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface PastSession {
  id: number;
  startTime: string;
  deepFocusDuration: number;
  partialDistractionDuration: number;
  absentDuration: number;
  focusScores: number[];
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [profile] = useState(() => {
    const saved = localStorage.getItem('focus-user-profile');
    return saved ? JSON.parse(saved) : { firstName: 'Guest', lastName: '' };
  });

  const [sessionStatus, setSessionStatus] = useState("IDLE");
  const [pastSessions, setPastSessions] = useState<PastSession[]>([]);
  const [showModal, setShowModal] = useState(location.state?.showSessionSummary || false);
  const [sessionToDelete, setSessionToDelete] = useState<number | null>(null);
  
  const [currentSession, setCurrentSession] = useState<SessionStats>({
    deepFocus: 0,
    partialDistraction: 0,
    absent: 0,
    duration: 0,
    focusScores: []
  });

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const statusRes = await fetch(`${API_BASE_URL}/api/sessions/status`);
        const status = await statusRes.text();
        setSessionStatus(status);

        if (status !== "IDLE") {
          const historyRes = await fetch(`${API_BASE_URL}/api/sessions/user/${profile.firstName}`);
          const history = await historyRes.json();
          if (history && history.length > 0) {
            const latest = history[0];
            setCurrentSession({
              deepFocus: latest.deepFocusDuration || 0,
              partialDistraction: latest.partialDistractionDuration || 0,
              absent: latest.absentDuration || 0,
              duration: (latest.deepFocusDuration || 0) + (latest.partialDistractionDuration || 0) + (latest.absentDuration || 0),
              focusScores: latest.focusScores || []
            });
          }
        }
      } catch (e) { console.error('Error polling:', e); }
    }, 1000);
    return () => clearInterval(poll);
  }, [profile.firstName]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/sessions/user/${profile.firstName}`);
        const data = await res.json();
        setPastSessions(data);
        
        // If showModal was triggered, we want to show the latest session in the modal
        if (showModal && data.length > 0) {
          const latest = data[0];
          setCurrentSession({
            deepFocus: latest.deepFocusDuration || 0,
            partialDistraction: latest.partialDistractionDuration || 0,
            absent: latest.absentDuration || 0,
            duration: (latest.deepFocusDuration || 0) + (latest.partialDistractionDuration || 0) + (latest.absentDuration || 0),
            focusScores: latest.focusScores || []
          });
          setSessionToDelete(latest.id);
        }
      } catch (e) {
        console.error('Failed to fetch history:', e);
      }
    };
    fetchHistory();
  }, [profile.firstName, showModal]);

  const handleSaveSession = () => {
    setShowModal(false);
    // Session is already saved in the backend during the STOP process
    // We just need to refresh history which is done via showModal dependency in useEffect
  };

  const handleTrashSession = async () => {
    if (sessionToDelete) {
      try {
        await fetch(`${API_BASE_URL}/api/sessions/${sessionToDelete}`, { method: 'DELETE' });
        setPastSessions(prev => prev.filter(s => s.id !== sessionToDelete));
        setShowModal(false);
      } catch (e) {
        console.error('Failed to delete session', e);
      }
    }
  };

  const total = currentSession.duration || 1; // Prevent division by zero

  return (
    <div className="dashboard-container">
      <nav className="dash-nav">
          <span className="logo-text">FocusEye Analytics</span>
          <div className="user-profile">
            <span className="user-name">{profile.firstName} {profile.lastName}</span>
            <div className="avatar">{profile.firstName.charAt(0)}</div>
        </div>
      </nav>

      <main className="dash-content">
        <header className="dash-header">
          <div className="header-info">
            <div className="status-row-top">
              <h1>Session Analytics</h1>
              <div className={`status-pill ${sessionStatus.toLowerCase()}`}>
                {sessionStatus}
              </div>
            </div>
            <p className="timer-display">{currentSession.duration}s Active • {new Date().toLocaleDateString()}</p>
          </div>
          <div className="header-actions">
            <button className="session-btn start" onClick={() => navigate('/setup')}>
              <Play size={18} />
              Start New Session
            </button>
          </div>
        </header>

        {showModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2 className="modal-title">Session Complete</h2>
              <p className="modal-subtitle">Here are your results for the session.</p>
              
              <div className="stats-row" style={{ marginTop: '2rem', marginBottom: '1rem' }}>
                <div className="stat-card focus" style={{ padding: '1rem' }}>
                  <div className="stat-header"><Brain size={16} /><label>Deep Focus</label></div>
                  <div className="stat-value" style={{ fontSize: '1.5rem' }}>{currentSession.deepFocus}s</div>
                </div>
                <div className="stat-card distracted" style={{ padding: '1rem' }}>
                  <div className="stat-header"><AlertCircle size={16} /><label>Distracted</label></div>
                  <div className="stat-value" style={{ fontSize: '1.5rem' }}>{currentSession.partialDistraction}s</div>
                </div>
                <div className="stat-card absent" style={{ padding: '1rem' }}>
                  <div className="stat-header"><UserMinus size={16} /><label>Absent</label></div>
                  <div className="stat-value" style={{ fontSize: '1.5rem' }}>{currentSession.absent}s</div>
                </div>
              </div>

              <div className="chart-card" style={{ padding: '1rem', marginBottom: '2rem' }}>
                <div className="card-header" style={{ marginBottom: '1rem' }}>
                  <div className="header-title">
                    <TrendingUp size={16} color="#10b981" />
                    <h3 style={{ fontSize: '1rem', margin: 0, fontWeight: 700 }}>Focus Intensity</h3>
                  </div>
                </div>
                <FocusGraph scores={currentSession.focusScores} />
              </div>

              <div className="modal-actions">
                  <button className="save-session-btn" onClick={handleSaveSession}>
                      <Save size={18} /> Save Session
                  </button>
                  <button className="trash-session-btn" onClick={handleTrashSession}>
                      <Trash2 size={18} /> Trash Session
                  </button>
              </div>
            </div>
          </div>
        )}

        <div className="main-grid">
          <section className="left-column">
            <div className="stats-row">
              <div className="stat-card focus">
                <div className="stat-header"><Brain size={20} /><label>Deep Focus</label></div>
                <div className="stat-value">{currentSession.deepFocus}s</div>
              </div>
              <div className="stat-card distracted">
                <div className="stat-header"><AlertCircle size={20} /><label>Distracted</label></div>
                <div className="stat-value">{currentSession.partialDistraction}s</div>
              </div>
              <div className="stat-card absent">
                <div className="stat-header"><UserMinus size={20} /><label>Absent</label></div>
                <div className="stat-value">{currentSession.absent}s</div>
              </div>
            </div>

            <div className="chart-card">
              <div className="card-header">
                <div className="header-title">
                  <TrendingUp size={20} color="#10b981" />
                  <h2>Focus Intensity Graph</h2>
                </div>
              </div>
              <FocusGraph scores={currentSession.focusScores} />
            </div>

            <div className="chart-card">
              <div className="card-header">
                <div className="header-title">
                  <BarChart3 size={20} color="#0071e3" />
                  <h2>Distribution Timeline</h2>
                </div>
              </div>
              <div className="timeline-bar">
                <div className="segment focus" style={{width: `${(currentSession.deepFocus / total) * 100}%`}}></div>
                <div className="segment distracted" style={{width: `${(currentSession.partialDistraction / total) * 100}%`}}></div>
                <div className="segment absent" style={{width: `${(currentSession.absent / total) * 100}%`}}></div>
              </div>
              <div className="timeline-legend">
                <div className="legend-item"><span className="dot focus"></span> Deep Focus</div>
                <div className="legend-item"><span className="dot distracted"></span> Partial</div>
                <div className="legend-item"><span className="dot absent"></span> Absent</div>
              </div>
            </div>
          </section>

          <section className="right-column">
            <div className="history-card">
              <div className="card-header">
                <div className="header-title"><History size={20} /><h2>Recent History</h2></div>
              </div>
              <div className="history-list">
                {pastSessions.map((session: PastSession) => (
                  <div key={session.id} className="history-item">
                    <div className="item-main">
                      <span className="date">{new Date(session.startTime).toLocaleDateString()}</span>
                      <span className="duration">{session.deepFocusDuration || 0}s focused</span>
                    </div>
                    <ChevronRight size={16} />
                  </div>
                ))}
                {pastSessions.length === 0 && <p className="empty-state">No previous sessions found.</p>}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
