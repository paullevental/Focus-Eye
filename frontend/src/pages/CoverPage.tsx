import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Pause, Square } from 'lucide-react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import './CoverPage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const CoverPage: React.FC = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [sessionStatus, setSessionStatus] = useState("IDLE");
  const frameBuffer = useRef<number[][]>([]);
  
  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem('focus-user-profile');
    return saved ? JSON.parse(saved) : { firstName: '', lastName: '' };
  });

  // Save profile to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('focus-user-profile', JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    const initMediaPipe = async () => {
      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      );
      landmarkerRef.current = await FaceLandmarker.createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
          delegate: "GPU"
        },
        outputFaceBlendshapes: true,
        runningMode: "VIDEO",
        numFaces: 1
      });
    };
    initMediaPipe();
  }, []);

  const startCamera = async () => {
    if (videoRef.current) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      videoRef.current.play();
      setIsCalibrating(true);
    }
  };

  const handlePredict = async () => {
    if (frameBuffer.current.length >= 30) {
      const framesToSend = [...frameBuffer.current];
      frameBuffer.current = [];
      
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/attention/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ frames: framesToSend })
        });
        const prediction = await res.json();
        
        await fetch(`${API_BASE_URL}/api/sessions/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            score: prediction.confidence * 100, 
            type: prediction.prediction === "Deep Focus" ? "DEEP_FOCUS" : 
                  prediction.prediction === "Partial Distraction" ? "PARTIAL" : "ABSENT"
          })
        });
      } catch (e) { console.error("Prediction error:", e); }
    }
  };

  const detectFrame = React.useCallback(async () => {
    if (videoRef.current && 
        videoRef.current.readyState >= 2 && 
        videoRef.current.videoWidth > 0 && 
        landmarkerRef.current && 
        sessionStatus === "START") {
      try {
        const startTimeMs = performance.now();
        const results = landmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);
        
        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          const flatLandmarks = results.faceLandmarks[0].flatMap((l: { x: number; y: number; z: number }) => [l.x, l.y, l.z]);
          frameBuffer.current.push(flatLandmarks);
          handlePredict();
        }
      } catch (e) {
        console.error("MediaPipe detection error:", e);
      }
    }
    if (sessionStatus !== "STOP") {
      requestAnimationFrame(detectFrame);
    }
  }, [sessionStatus]);

  useEffect(() => {
    if (sessionStatus === "START") detectFrame();
  }, [sessionStatus]);

  const updateBackendStatus = async (status: string) => {
    setSessionStatus(status);
    await fetch(`${API_BASE_URL}/api/sessions/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, username: profile.firstName })
    });
    if (status === "STOP") {
      // Pass state to show the modal on the Dashboard
      navigate('/', { state: { showSessionSummary: true } });
    }
  };

  const handleStartSession = async () => {
    if (!profile.firstName.trim()) {
      alert("Please enter your First Name before starting a session.");
      return;
    }
    await startCamera();
    updateBackendStatus("START");
  };

  return (
    <div className="cover-container">
      <header className="hero-section">
        <h1 className="title">Session Control</h1>
        <p className="subtitle">Configure profile and manage your active session.</p>
      </header>

      <main className="config-card">
        <div className="calibration-view">
          <div className="webcam-box" style={{ background: '#000', minHeight: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <video ref={videoRef} style={{ width: '100%', borderRadius: '12px', display: isCalibrating ? 'block' : 'none' }} />
            {!isCalibrating && (
              <div style={{ color: '#86868b', fontWeight: 600 }}>Ready to start recording</div>
            )}
          </div>
        </div>

        <div className="profile-grid" style={{ marginTop: '2rem' }}>
          <div className="input-group">
            <label style={{ color: '#1d1d1f', fontWeight: '600' }}>First Name</label>
            <input 
              type="text" 
              value={profile.firstName} 
              onChange={(e) => setProfile({...profile, firstName: e.target.value})}
              style={{ background: '#f5f5f7', border: '1px solid #d2d2d7', padding: '10px', borderRadius: '8px' }}
            />
          </div>
          <div className="input-group">
            <label style={{ color: '#1d1d1f', fontWeight: '600' }}>Active Keybinds</label>
            <div className="keybind-list" style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
              <span className="key-tag">S (Start)</span>
              <span className="key-tag">P (Pause)</span>
              <span className="key-tag">ESC (Stop)</span>
            </div>
          </div>
        </div>

        <div className="action-row" style={{ marginTop: '2rem', display: 'flex', gap: '12px', justifyContent: 'center' }}>
          {sessionStatus === "IDLE" ? (
             <button className="start-btn" onClick={handleStartSession} style={{ background: '#0071e3' }}>
              <Play size={18} /> Start Session
             </button>
          ) : sessionStatus === "START" ? (
            <>
              <button className="start-btn" onClick={() => updateBackendStatus("PAUSE")} style={{ background: '#f59e0b' }}>
                <Pause size={18} /> Pause Session
              </button>
              <button className="start-btn" onClick={() => updateBackendStatus("STOP")} style={{ background: '#ef4444' }}>
                <Square size={18} /> Stop Session
              </button>
            </>
          ) : (
            <>
              <button className="start-btn" onClick={() => updateBackendStatus("START")} style={{ background: '#10b981' }}>
                <Play size={18} /> Resume Session
              </button>
              <button className="start-btn" onClick={() => updateBackendStatus("STOP")} style={{ background: '#ef4444' }}>
                <Square size={18} /> Stop Session
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default CoverPage;
