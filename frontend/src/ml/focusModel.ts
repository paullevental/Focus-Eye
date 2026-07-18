import * as ort from 'onnxruntime-web';

// Browser-side port of ai/predict.py. MediaPipe already produces landmarks in the
// browser, so inference belongs here too — this removes the server round-trip and
// the Railway CPU throttling that capped throughput at ~0.3 windows/s.
//
// The contract below MUST stay in sync with ai/predict.py + ai/export_onnx.py:
//   input  "landmarks"  float32 [1, 30, 1404]  (nose-recentered, see normalizeWindow)
//   output "logits"     float32 [1, 3]
const CLASSES = ['Deep Focus', 'Partial Distraction', 'Absent'] as const;
const SEQUENCE_LENGTH = 30;
const FEATURE_LENGTH = 468 * 3; // 1404
const MODEL_URL = '/models/focus_lstm.onnx';

// onnxruntime-web fetches its wasm runtime from this CDN — same pattern as the
// MediaPipe wasm load in StudySessionPage. Version must match the installed package.
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/';

export interface Prediction {
  prediction: string;
  confidence: number;
}

// One session, created lazily and reused for the page's lifetime (mirrors the
// warm sidecar: load the model once, not per prediction).
let sessionPromise: Promise<ort.InferenceSession> | null = null;

function getSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ['wasm'],
    });
  }
  return sessionPromise;
}

// Port of normalize_batch in ai/predict.py: recenter every landmark on its own
// frame's nose tip (landmark index 1 → coords at flat indices 3, 4, 5). Training
// and inference must agree on this exactly, or predictions are silent garbage.
function normalizeWindow(frames: number[][]): Float32Array {
  const out = new Float32Array(SEQUENCE_LENGTH * FEATURE_LENGTH);
  for (let f = 0; f < frames.length; f++) {
    const frame = frames[f];
    const nx = frame[3];
    const ny = frame[4];
    const nz = frame[5];
    const base = f * FEATURE_LENGTH;
    for (let i = 0; i < 468; i++) {
      out[base + i * 3] = frame[i * 3] - nx;
      out[base + i * 3 + 1] = frame[i * 3 + 1] - ny;
      out[base + i * 3 + 2] = frame[i * 3 + 2] - nz;
    }
  }
  return out;
}

// softmax + argmax over the 3 logits (matches torch.softmax + torch.max in predict.py).
function toPrediction(logits: Float32Array): Prediction {
  let maxLogit = -Infinity;
  for (const v of logits) if (v > maxLogit) maxLogit = v;
  const exps = logits.map((v) => Math.exp(v - maxLogit));
  let sum = 0;
  for (const e of exps) sum += e;
  let best = 0;
  for (let i = 1; i < exps.length; i++) if (exps[i] > exps[best]) best = i;
  return { prediction: CLASSES[best], confidence: exps[best] / sum };
}

// Run one complete 30-frame window through the LSTM in the browser. Mirrors
// predict_one in ai/predict.py (normalize → forward → softmax/argmax).
export async function predictWindow(frames: number[][]): Promise<Prediction> {
  const session = await getSession();
  const input = new ort.Tensor('float32', normalizeWindow(frames), [
    1,
    SEQUENCE_LENGTH,
    FEATURE_LENGTH,
  ]);
  const results = await session.run({ landmarks: input });
  return toPrediction(results.logits.data as Float32Array);
}
