import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Square, Brain, AlertCircle, UserMinus, TrendingUp } from 'lucide-react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import {
  sessionsApi,
  predictionLabelToType,
  focusIntensityFor,
  type StudySession,
} from '../api/sessions';
import { useProfile } from '../context/ProfileContext';
import { predictWindow } from '../ml/focusModel';
import FocusGraph from '../components/FocusGraph';
import ThemeToggle from '../components/ThemeToggle';
import './StudySessionPage.css';

// Mirror training-time conventions from ai/collect_data.py:
// - frames captured at ~30fps (so 30 frames ≈ 1s window the LSTM expects)
// - undetected faces become a zero-filled feature vector
const FRAME_INTERVAL_MS = 1000 / 30;
const FEATURE_LENGTH = 468 * 3;
const ZERO_FRAME: number[] = new Array(FEATURE_LENGTH).fill(0);
// Safety cap on windows processed per cycle so a stalled tab (e.g. backgrounded,
// rAF paused) can't force us to score a huge backlog of stale frames at once.
const MAX_WINDOWS = 8;

type UiStatus = 'IDLE' | 'ACTIVE' | 'PAUSED';

const statusFromSession = (s: StudySession | null): UiStatus => {
  if (!s) return 'IDLE';
  if (s.status === 'ACTIVE') return 'ACTIVE';
  if (s.status === 'PAUSED') return 'PAUSED';
  return 'IDLE';
};

const total = (s: StudySession | null): number =>
  s ? (s.deepFocusDuration ?? 0) + (s.partialDistractionDuration ?? 0) + (s.absentDuration ?? 0) : 0;

export default function StudySessionPage() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const username = profile!.firstName; // guard ensures profile

  const videoRef = useRef<HTMLVideoElement>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const frameBuffer = useRef<number[][]>([]);
  const inflightPredict = useRef(false);
  const lastFramePushMs = useRef(0);

  const [isCalibrating, setIsCalibrating] = useState(false);
  const [uiStatus, setUiStatus] = useState<UiStatus>('IDLE');
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [liveSession, setLiveSession] = useState<StudySession | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs mirror state so the rAF loop and async callbacks always see the latest.
  const uiStatusRef = useRef<UiStatus>(uiStatus);
  const activeSessionIdRef = useRef<number | null>(activeSessionId);
  useEffect(() => { uiStatusRef.current = uiStatus; }, [uiStatus]);
  useEffect(() => { activeSessionIdRef.current = activeSessionId; }, [activeSessionId]);

  // MediaPipe init.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const filesetResolver = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
        );
        const lm = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: 'GPU',
          },
          outputFaceBlendshapes: true,
          runningMode: 'VIDEO',
          numFaces: 1,
        });
        if (!cancelled) landmarkerRef.current = lm;
      } catch (e) {
        console.error('MediaPipe init failed:', e);
        setError('Failed to initialize face tracking. Please refresh.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Recover an open session belonging to this user on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const open = await sessionsApi.active(username);
        if (cancelled || !open) return;
        setActiveSessionId(open.id);
        setLiveSession(open);
        setUiStatus(statusFromSession(open));
      } catch (e) {
        console.warn('Could not check for active session:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [username]);

  // Poll the active session every second so live metrics stay fresh.
  useEffect(() => {
    if (uiStatus === 'IDLE') return;
    let cancelled = false;
    const tick = async () => {
      try {
        const open = await sessionsApi.active(username);
        if (!cancelled) setLiveSession(open);
      } catch {
        // backend transient; ignore
      }
    };
    const id = setInterval(tick, 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [username, uiStatus]);

  const startCamera = async () => {
    if (!videoRef.current) return;
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoRef.current.srcObject = stream;
    await videoRef.current.play();
    setIsCalibrating(true);
  };

  const stopCamera = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const stream = video.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
    setIsCalibrating(false);
  }, []);

  const handlePredict = useCallback(async () => {
    if (inflightPredict.current) return;
    if (frameBuffer.current.length < 30) return;
    const sessionId = activeSessionIdRef.current;
    if (!sessionId || !username) return;

    inflightPredict.current = true;
    // Score EVERY complete ~1s window captured since the last cycle — not just
    // the most recent — so no observed second is discarded to backend latency.
    // The partial remainder (< 30 frames) stays buffered for the next cycle.
    let windowCount = Math.floor(frameBuffer.current.length / 30);
    // Safety valve: if the buffer has fallen far behind (e.g. the tab was
    // backgrounded and rAF stalled), drop the oldest windows so we never score
    // minute-old frames. In-browser inference keeps up, so this rarely trips.
    if (windowCount > MAX_WINDOWS) {
      frameBuffer.current.splice(0, (windowCount - MAX_WINDOWS) * 30);
      windowCount = MAX_WINDOWS;
    }
    const windows: number[][][] = [];
    for (let i = 0; i < windowCount; i++) {
      windows.push(frameBuffer.current.splice(0, 30));
    }
    try {
      // Inference runs in-browser via onnxruntime-web (see ml/focusModel). The
      // windows are tiny and score sequentially in single-digit ms each, so no
      // server round-trip and no Railway CPU ceiling. We still POST the scores.
      const predictions = await Promise.all(windows.map((w) => predictWindow(w)));
      if (uiStatusRef.current === 'ACTIVE') {
        const entries = predictions.map((p) => ({
          score: focusIntensityFor(p.prediction, p.confidence),
          type: predictionLabelToType(p.prediction),
        }));
        const updated = await sessionsApi.scoreBatch(sessionId, username, entries);
        setLiveSession(updated);
      }
    } catch (e) {
      console.error('Prediction error:', e);
    } finally {
      inflightPredict.current = false;
    }
  }, [username]);

  const detectFrame = useCallback(() => {
    const v = videoRef.current;
    const lm = landmarkerRef.current;
    if (v && v.readyState >= 2 && v.videoWidth > 0 && lm && uiStatusRef.current === 'ACTIVE') {
      const now = performance.now();
      if (now - lastFramePushMs.current >= FRAME_INTERVAL_MS) {
        lastFramePushMs.current = now;
        try {
          const results = lm.detectForVideo(v, now);
          // face_landmarker.task returns 478 landmarks; LSTM expects 468.
          // If MediaPipe sees no face, push a zero frame so the model can learn "Absent".
          const flat =
            results.faceLandmarks && results.faceLandmarks.length > 0
              ? results.faceLandmarks[0]
                  .slice(0, 468)
                  .flatMap((l: { x: number; y: number; z: number }) => [l.x, l.y, l.z])
              : ZERO_FRAME;
          frameBuffer.current.push(flat);
          if (frameBuffer.current.length >= 30) void handlePredict();
        } catch (e) {
          console.error('MediaPipe detection error:', e);
        }
      }
    }
    if (uiStatusRef.current !== 'IDLE') {
      requestAnimationFrame(detectFrame);
    }
  }, [handlePredict]);

  useEffect(() => {
    if (uiStatus === 'ACTIVE') requestAnimationFrame(detectFrame);
  }, [uiStatus, detectFrame]);

  const handleStartSession = async () => {
    setError(null);
    try {
      await startCamera();
      const session = await sessionsApi.start(username);
      setActiveSessionId(session.id);
      setLiveSession(session);
      setUiStatus('ACTIVE');
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Failed to start session.');
      stopCamera();
    }
  };

  const handlePause = async () => {
    if (!activeSessionId) return;
    try {
      const s = await sessionsApi.pause(activeSessionId, username);
      setLiveSession(s);
      setUiStatus(statusFromSession(s));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to pause.');
    }
  };

  const handleResume = async () => {
    if (!activeSessionId) return;
    try {
      const s = await sessionsApi.resume(activeSessionId, username);
      setLiveSession(s);
      setUiStatus(statusFromSession(s));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to resume.');
    }
  };

  const handleStop = async () => {
    if (!activeSessionId) return;
    const stoppedId = activeSessionId;
    try {
      await sessionsApi.stop(activeSessionId, username);
    } catch (e) {
      console.error('Stop failed:', e);
    }
    stopCamera();
    frameBuffer.current = [];
    setActiveSessionId(null);
    setLiveSession(null);
    setUiStatus('IDLE');
    navigate(`/sessions/${stoppedId}`, { replace: true });
  };

  const elapsed = total(liveSession);

  return (
    <div className="study-shell">
      <nav className="study-topbar">
        <button className="study-back" onClick={() => navigate('/')}>
          <ArrowLeft size={16} /> Dashboard
        </button>
        <div className="study-topbar-right">
          <div className={`study-status-pill ${uiStatus.toLowerCase()}`}>{uiStatus}</div>
          <ThemeToggle />
        </div>
      </nav>

      <main className="study-main">
        <header className="study-header">
          <h1>{liveSession?.title || 'New study session'}</h1>
          <p>
            {uiStatus === 'IDLE'
              ? 'Position yourself in front of the camera and hit Start.'
              : uiStatus === 'PAUSED'
                ? 'Session paused. Resume when you’re ready.'
                : 'Recording. Stay focused.'}
          </p>
        </header>

        <section className="study-grid">
          <div className="study-camera-card">
            <div className="study-camera-frame">
              <video
                ref={videoRef}
                style={{ display: isCalibrating ? 'block' : 'none' }}
              />
              {!isCalibrating && (
                <div className="study-camera-placeholder">
                  <div className="study-camera-orb" />
                  <span>Camera off</span>
                </div>
              )}
            </div>

            {error && <div className="study-error">{error}</div>}

            <div className="study-actions">
              {uiStatus === 'IDLE' && (
                <button className="study-btn start" onClick={handleStartSession}>
                  <Play size={18} fill="currentColor" /> Start Session
                </button>
              )}
              {uiStatus === 'ACTIVE' && (
                <>
                  <button className="study-btn pause" onClick={handlePause}>
                    <Pause size={18} /> Pause
                  </button>
                  <button className="study-btn stop" onClick={handleStop}>
                    <Square size={18} /> Stop
                  </button>
                </>
              )}
              {uiStatus === 'PAUSED' && (
                <>
                  <button className="study-btn resume" onClick={handleResume}>
                    <Play size={18} fill="currentColor" /> Resume
                  </button>
                  <button className="study-btn stop" onClick={handleStop}>
                    <Square size={18} /> Stop
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="study-metrics">
            <div className="study-stat focus">
              <div className="study-stat-head"><Brain size={16} /><label>Deep Focus</label></div>
              <div className="study-stat-value">{liveSession?.deepFocusDuration ?? 0}s</div>
            </div>
            <div className="study-stat distracted">
              <div className="study-stat-head"><AlertCircle size={16} /><label>Distracted</label></div>
              <div className="study-stat-value">{liveSession?.partialDistractionDuration ?? 0}s</div>
            </div>
            <div className="study-stat absent">
              <div className="study-stat-head"><UserMinus size={16} /><label>Absent</label></div>
              <div className="study-stat-value">{liveSession?.absentDuration ?? 0}s</div>
            </div>
            <div className="study-stat total">
              <div className="study-stat-head"><TrendingUp size={16} /><label>Total</label></div>
              <div className="study-stat-value">{elapsed}s</div>
            </div>
          </div>
        </section>

        <section className="study-graph-card">
          <div className="study-graph-head">
            <TrendingUp size={18} color="#10b981" />
            <h2>Focus Intensity</h2>
          </div>
          <FocusGraph scores={liveSession?.focusScores ?? []} />
        </section>
      </main>
    </div>
  );
}
