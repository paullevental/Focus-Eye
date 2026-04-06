import torch
import torch.nn as nn
import numpy as np
import sys
import json
import os

# Model Parameters (must match train_lstm.py)
SEQUENCE_LENGTH = 30
INPUT_SIZE = 468 * 3
HIDDEN_SIZE = 64
NUM_CLASSES = 3
NUM_LAYERS = 5
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
    """
    Normalizes landmarks by centering them on the nose tip (index 1).
    Expects a flat array of [x, y, z, x, y, z, ...].
    """
    # Landmarks are flat: [x0, y0, z0, x1, y1, z1, ...]
    # Nose tip is index 1, so coordinates are at indices 3, 4, 5
    nose_x = landmarks_array[3]
    nose_y = landmarks_array[4]
    nose_z = landmarks_array[5]
    
    normalized = []
    for i in range(0, len(landmarks_array), 3):
        normalized.extend([
            landmarks_array[i] - nose_x,
            landmarks_array[i+1] - nose_y,
            landmarks_array[i+2] - nose_z
        ])
    return np.array(normalized)

def predict():
    # 1. Load the model
    model_path = os.path.join(os.path.dirname(__file__), "models", "focus_lstm.pth")
    if not os.path.exists(model_path):
        print(json.dumps({"error": f"Model not found at {model_path}"}))
        return

    device = torch.device('cpu')
    model = FocusLSTM(INPUT_SIZE, HIDDEN_SIZE, NUM_LAYERS, NUM_CLASSES).to(device)
    model.load_state_dict(torch.load(model_path, map_location=device, weights_only=True))
    model.eval()

    # 2. Read input from stdin (sent from Java)
    try:
        input_data = sys.stdin.read()
        if not input_data:
            return
            
        data = json.loads(input_data)
        # Expecting a list of 30 frames, each a list of floats
        raw_frames = np.array(data['frames'], dtype=np.float32)
        
        # Apply normalization to each frame in the sequence
        normalized_frames = []
        for frame in raw_frames:
            normalized_frames.append(normalize_landmarks(frame))
        
        frames_array = np.array(normalized_frames)
        
        # Reshape for LSTM (batch_size=1, sequence_length=30, input_size=1404)
        X = torch.tensor(frames_array).unsqueeze(0).to(device)
        
        # 3. Inference
        with torch.no_grad():
            outputs = model(X)
            probabilities = torch.softmax(outputs, dim=1)
            confidence, predicted = torch.max(probabilities, 1)
            
            result = {
                "prediction": CLASSES[predicted.item()],
                "confidence": float(confidence.item())
            }
            print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    predict()
