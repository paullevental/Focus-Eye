import cv2
import mediapipe as mp
import numpy as np
import torch
import torch.nn as nn
import os
import time

# Parameters (Must match train_lstm.py)
SEQUENCE_LENGTH = 30
INPUT_SIZE = 468 * 3
HIDDEN_SIZE = 64
NUM_CLASSES = 3
NUM_LAYERS = 2
CLASSES = ["Deep Focus", "Partial Distraction", "Absent"]

# Model Architecture
class FocusLSTM(nn.Module):
    def __init__(self, input_size, hidden_size, num_layers, num_classes):
        super(FocusLSTM, self).__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True, dropout=0.2)
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

def live_test():
    # 1. Load the model
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model = FocusLSTM(INPUT_SIZE, HIDDEN_SIZE, NUM_LAYERS, NUM_CLASSES).to(device)
    
    # Discovery of model path
    model_path = os.path.join(os.path.dirname(__file__), "models", "focus_lstm.pth")
    if not os.path.exists(model_path):
        print(f"Model not found at {model_path}. Please train the model first.")
        return
        
    model.load_state_dict(torch.load(model_path, map_location=device, weights_only=True))
    model.eval()
    print(f"Model loaded from {model_path} onto {device}")

    # 2. Initialize MediaPipe
    mp_face_landmarker = mp.tasks.vision.FaceLandmarker
    options = mp.tasks.vision.FaceLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=os.path.join(os.path.dirname(__file__), "models", "face_landmarker.task")),
        running_mode=mp.tasks.vision.RunningMode.VIDEO
    )
    landmarker = mp_face_landmarker.create_from_options(options)

    # 3. Setup Webcam and Buffer
    cap = cv2.VideoCapture(0)
    frame_buffer = []
    start_time_ms = int(time.time() * 1000)
    
    print("\nLive Test Active! Press 'q' to quit.")
    print("Buffer filling... please wait.")

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret: break
        frame = cv2.flip(frame, 1)
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
        
        current_timestamp_ms = int(time.time() * 1000) - start_time_ms
        result = landmarker.detect_for_video(mp_image, current_timestamp_ms)

        # Get landmarks (or zeros if absent)
        if result.face_landmarks:
            landmarks = []
            for landmark in result.face_landmarks[0][:468]:
                landmarks.extend([landmark.x, landmark.y, landmark.z])
            processed_frame = normalize_landmarks(np.array(landmarks))
        else:
            processed_frame = np.zeros(INPUT_SIZE)

        frame_buffer.append(processed_frame)
        
        # Keep buffer at SEQUENCE_LENGTH
        if len(frame_buffer) > SEQUENCE_LENGTH:
            frame_buffer.pop(0)

        # Run Prediction when buffer is full
        prediction_text = "Buffering..."
        confidence_text = ""
        
        if len(frame_buffer) == SEQUENCE_LENGTH:
            X = torch.tensor(np.array(frame_buffer), dtype=torch.float32).unsqueeze(0).to(device)
            with torch.no_grad():
                outputs = model(X)
                probs = torch.softmax(outputs, dim=1)
                confidence, predicted = torch.max(probs, 1)
                
                prediction_text = CLASSES[predicted.item()]
                confidence_text = f"{confidence.item()*100:.1f}%"

        # UI Overlay
        color = (0, 255, 0) if prediction_text == "Deep Focus" else (0, 165, 255) if prediction_text == "Partial Distraction" else (0, 0, 255)
        cv2.putText(frame, f"Prediction: {prediction_text}", (10, 40), cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)
        cv2.putText(frame, f"Confidence: {confidence_text}", (10, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 1)
        
        cv2.imshow('Attention AI - Live Test', frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()
    landmarker.close()

if __name__ == "__main__":
    live_test()
