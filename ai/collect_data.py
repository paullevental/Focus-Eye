import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import numpy as np
import os
import time

# Parameters
SEQUENCE_LENGTH = 30  # Number of frames per sequence
CLASSES = ["Deep Focus", "Partial Distraction", "Absent"]
AI_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(AI_DIR, "data", "raw")
MODEL_PATH = os.path.join(AI_DIR, "models", "face_landmarker.task")

# Initialize MediaPipe Face Landmarker
BaseOptions = mp.tasks.BaseOptions
FaceLandmarker = mp.tasks.vision.FaceLandmarker
FaceLandmarkerOptions = mp.tasks.vision.FaceLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

options = FaceLandmarkerOptions(
    base_options=BaseOptions(
        model_asset_path=MODEL_PATH,
        delegate=BaseOptions.Delegate.CPU
    ),
    running_mode=VisionRunningMode.VIDEO
)

landmarker = FaceLandmarker.create_from_options(options)

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

def get_landmarks(image, frame_timestamp_ms):
    # Convert OpenCV BGR to MediaPipe RGB
    rgb_frame = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
    
    # Perform inference
    result = landmarker.detect_for_video(mp_image, frame_timestamp_ms)
    
    if result.face_landmarks:
        landmarks = []
        for landmark in result.face_landmarks[0][:468]:
            landmarks.extend([landmark.x, landmark.y, landmark.z])
        
        # Apply normalization
        return normalize_landmarks(np.array(landmarks))
    else:
        return None

def collect_data():
    if not os.path.exists(DATA_PATH):
        os.makedirs(DATA_PATH)

    cap = cv2.VideoCapture(0)
    start_time = int(time.time() * 1000) 
    
    for label in CLASSES:
        print(f"\n--- Class: {label} ---")
        print("'r' to TOGGLE continuous record | 's' for SINGLE sequence | 'q' for NEXT class")
        
        count = 0
        recording = False
        current_sequence = []

        while True:
            ret, frame = cap.read()
            if not ret: break
            frame = cv2.flip(frame, 1)
            
            # Status colors
            color = (0, 0, 255) if recording else (0, 255, 0)
            status = "RECORDING" if recording else "IDLE"
            
            cv2.putText(frame, f"Class: {label} | Collected: {count} | {status}", (10, 30), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
            cv2.imshow('Data Collection', frame)
            
            key = cv2.waitKey(1) & 0xFF
            
            # Handle timestamps for MediaPipe
            current_timestamp_ms = int(time.time() * 1000) - start_time

            if key == ord('r'):
                recording = not recording
                current_sequence = []
                print(f"Continuous recording: {recording}")

            if recording or key == ord('s'):
                landmarks = get_landmarks(frame, current_timestamp_ms)
                if landmarks is not None:
                    current_sequence.append(landmarks)
                
                # If we've hit the sequence length, save it
                if len(current_sequence) == SEQUENCE_LENGTH:
                    file_path = os.path.join(DATA_PATH, f"{label}_{int(time.time()*1000)}.npy")
                    np.save(file_path, np.array(current_sequence))
                    count += 1
                    current_sequence = [] # Reset for next sequence
                    if key == ord('s'): # Stop if it was a manual single shot
                        break 
                
            elif key == ord('q'):
                break
                
    cap.release()
    cv2.destroyAllWindows()
    landmarker.close()

if __name__ == "__main__":
    collect_data()
