"""FocusLSTM model definition + weight loading.

Inference now runs in the browser via onnxruntime-web (see frontend/src/ml/
focusModel.ts); the backend no longer calls this file at runtime. It remains the
source of truth for the model architecture and normalization, and is imported by
export_onnx.py to produce focus_lstm.onnx and by train_lstm.py at training time.
"""
import os

# Pin thread counts BEFORE importing torch. On a throttled shared-CPU container
# (Railway Hobby), os.cpu_count() reports the host's full core count, so torch's
# OpenMP/MKL backends spawn that many threads and thrash them across the tiny CPU
# slice we actually get — turning a ~15M-MAC forward pass into multiple seconds.
# These env vars only take effect if set before torch is imported.
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")

import torch
import torch.nn as nn
import numpy as np

# Belt-and-suspenders: also pin at the torch API level. set_num_threads is always
# safe; set_num_interop_threads must run before any parallel work, so guard it.
torch.set_num_threads(1)
try:
    torch.set_num_interop_threads(1)
except Exception:
    pass

# Model parameters (must match train_lstm.py)
SEQUENCE_LENGTH = 30
INPUT_SIZE = 468 * 3
HIDDEN_SIZE = 64
NUM_CLASSES = 3
NUM_LAYERS = 2
CLASSES = ["Deep Focus", "Partial Distraction", "Absent"]


class FocusLSTM(nn.Module):
    def __init__(self, input_size, hidden_size, num_layers, num_classes):
        super(FocusLSTM, self).__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True)
        self.fc = nn.Linear(hidden_size, num_classes)

    def forward(self, x):
        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        out, _ = self.lstm(x, (h0, c0))
        out = self.fc(out[:, -1, :])
        return out


def normalize_landmarks(landmarks_array):
    """Recenter all landmarks on the nose tip (landmark index 1).

    Vectorized: reshape the flat (1404,) frame to (468, 3), subtract the nose
    row (landmark index 1), flatten back. Numerically identical to the old
    per-element Python loop but ~100x faster.
    """
    pts = np.asarray(landmarks_array, dtype=np.float32).reshape(-1, 3)
    pts = pts - pts[1]
    return pts.reshape(-1)


def normalize_batch(frames):
    """Recenter a full (seq, 1404) batch on each frame's own nose tip."""
    pts = np.asarray(frames, dtype=np.float32).reshape(len(frames), -1, 3)
    pts = pts - pts[:, 1:2, :]
    return pts.reshape(len(frames), -1)


def load_model():
    model_path = os.path.join(os.path.dirname(__file__), "models", "focus_lstm.pth")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model not found at {model_path}")
    device = torch.device("cpu")
    model = FocusLSTM(INPUT_SIZE, HIDDEN_SIZE, NUM_LAYERS, NUM_CLASSES).to(device)
    model.load_state_dict(torch.load(model_path, map_location=device, weights_only=True))
    model.eval()
    # Warmup forward pass — forces oneDNN kernel selection so the first
    # real request hits steady-state latency instead of one-time JIT cost.
    with torch.no_grad():
        warmup = torch.zeros(1, SEQUENCE_LENGTH, INPUT_SIZE, device=device)
        _ = model(warmup)
    return model, device


