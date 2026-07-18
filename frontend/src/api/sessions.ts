import { apiFetch } from './client';

export type SessionStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED';

export type ScoreType = 'DEEP_FOCUS' | 'PARTIAL' | 'ABSENT';

export interface StudySession {
  id: number;
  startTime: string;
  endTime: string | null;
  title: string | null;
  notes: string | null;
  status: SessionStatus;
  classification: string | null;
  averageConfidence: number | null;
  focusScores: number[];
  deepFocusDuration: number;
  partialDistractionDuration: number;
  absentDuration: number;
  maxFocusSeconds: number;
  maxDistractionSeconds: number;
  maxAbsentSeconds: number;
  longestFocusPeriod: string | null;
  longestDistractionPeriod: string | null;
  longestAbsentPeriod: string | null;
}

export const sessionsApi = {
  start: (username: string) =>
    apiFetch<StudySession>('/api/sessions/start', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),

  pause: (id: number, username: string) =>
    apiFetch<StudySession>(`/api/sessions/${id}/pause`, {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),

  resume: (id: number, username: string) =>
    apiFetch<StudySession>(`/api/sessions/${id}/resume`, {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),

  stop: (id: number, username: string) =>
    apiFetch<StudySession>(`/api/sessions/${id}/stop`, {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),

  score: (id: number, username: string, score: number, type: ScoreType) =>
    apiFetch<StudySession>(`/api/sessions/${id}/score`, {
      method: 'POST',
      body: JSON.stringify({ username, score, type }),
    }),

  // Record every ~1s window captured since the last cycle in one round-trip.
  scoreBatch: (
    id: number,
    username: string,
    entries: { score: number; type: ScoreType }[]
  ) =>
    apiFetch<StudySession>(`/api/sessions/${id}/scores`, {
      method: 'POST',
      body: JSON.stringify({ username, entries }),
    }),

  // Returns the user's open (ACTIVE or PAUSED) session, or null if none exists.
  active: async (username: string): Promise<StudySession | null> => {
    const res = await apiFetch<StudySession | undefined>(
      `/api/sessions/active?username=${encodeURIComponent(username)}`
    );
    return res ?? null;
  },

  list: (username: string) =>
    apiFetch<StudySession[]>(
      `/api/sessions/user/${encodeURIComponent(username)}`
    ),

  get: (id: number, username: string) =>
    apiFetch<StudySession>(
      `/api/sessions/${id}?username=${encodeURIComponent(username)}`
    ),

  update: (
    id: number,
    username: string,
    patch: { title?: string; notes?: string }
  ) =>
    apiFetch<StudySession>(
      `/api/sessions/${id}?username=${encodeURIComponent(username)}`,
      {
        method: 'PUT',
        body: JSON.stringify(patch),
      }
    ),

  delete: (id: number, username: string) =>
    apiFetch<void>(
      `/api/sessions/${id}?username=${encodeURIComponent(username)}`,
      { method: 'DELETE' }
    ),
};

export function predictionLabelToType(label: string): ScoreType {
  switch (label) {
    case 'Deep Focus':
      return 'DEEP_FOCUS';
    case 'Partial Distraction':
      return 'PARTIAL';
    default:
      return 'ABSENT';
  }
}

// Maps a model prediction to a 0–100 focus-intensity value for the live graph.
// Each class gets its own band; confidence modulates within the band so high-confidence
// distraction / absence pulls the line further down.
export function focusIntensityFor(label: string, confidence: number): number {
  const c = Math.max(0, Math.min(1, confidence));
  switch (label) {
    case 'Deep Focus':
      return Math.round(60 + c * 40); // 60–100
    case 'Partial Distraction':
      return Math.round(40 - c * 20); // 20–40
    default:
      return Math.round(20 - c * 20); // 0–20
  }
}
