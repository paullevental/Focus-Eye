"""Long-running prediction daemon.

Loads the LSTM once at startup, then serves one prediction per line of
newline-delimited JSON on stdin. Each prediction is one JSON line on
stdout, flushed immediately. This replaces the previous one-process-
per-request design, which paid ~2-3s of Python startup + torch import
on every call (catastrophic on Railway's shared CPU).
"""
import torch
import torch.nn as nn
import numpy as np
import sys
import json
import os

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
    """Recenter all landmarks on the nose tip (landmark index 1)."""
    nose_x = landmarks_array[3]
    nose_y = landmarks_array[4]
    nose_z = landmarks_array[5]
    normalized = []
    for i in range(0, len(landmarks_array), 3):
        normalized.extend([
            landmarks_array[i] - nose_x,
            landmarks_array[i + 1] - nose_y,
            landmarks_array[i + 2] - nose_z,
        ])
    return np.array(normalized)


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


def predict_one(model, device, frames_data):
    raw_frames = np.array(frames_data, dtype=np.float32)
    normalized = np.array([normalize_landmarks(f) for f in raw_frames])
    x = torch.tensor(normalized).unsqueeze(0).to(device)
    with torch.no_grad():
        outputs = model(x)
        probabilities = torch.softmax(outputs, dim=1)
        confidence, predicted = torch.max(probabilities, 1)
        return {
            "prediction": CLASSES[predicted.item()],
            "confidence": float(confidence.item()),
        }


def serve():
    """Read one JSON request per line of stdin, write one JSON response per line of stdout."""
    try:
        model, device = load_model()
    except Exception as e:
        sys.stdout.write(json.dumps({"error": f"startup: {e}"}) + "\n")
        sys.stdout.flush()
        return

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
            result = predict_one(model, device, request["frames"])
            sys.stdout.write(json.dumps(result) + "\n")
        except Exception as e:
            sys.stdout.write(json.dumps({"error": str(e)}) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    serve()
