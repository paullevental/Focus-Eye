import cv2
import mediapipe as mp
import numpy as np
import os

# Initialize MediaPipe
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(static_image_mode=False, max_num_faces=1, refine_landmarks=True)

SEQUENCE_LENGTH = 30
INPUT_SIZE = 468 * 3
OUTPUT_PATH = "ai/data/raw"

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

def extract_landmarks_from_video(video_path, label):
    if not os.path.exists(OUTPUT_PATH):
        os.makedirs(OUTPUT_PATH)
        
    cap = cv2.VideoCapture(video_path)
    sequence = []
    
    print(f"Processing: {video_path}")
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret: break
        
        # Convert to RGB for MediaPipe
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(rgb_frame)
        
        if results.multi_face_landmarks:
            landmarks = []
            # Extract first 468 landmarks
            for lm in results.multi_face_landmarks[0].landmark[:468]:
                landmarks.extend([lm.x, lm.y, lm.z])
            
            # Normalize and add to sequence
            normalized_landmarks = normalize_landmarks(np.array(landmarks))
            sequence.append(normalized_landmarks)
            
            if len(sequence) == SEQUENCE_LENGTH:
                timestamp = int(np.random.randint(0, 1e9))
                filename = f"{label}_ext_{timestamp}.npy"
                np.save(os.path.join(OUTPUT_PATH, filename), np.array(sequence))
                sequence = [] # Start next sequence
                
    cap.release()
    print(f"Finished processing {video_path}")

if __name__ == "__main__":
    # Example usage:
    # extract_landmarks_from_video("path/to/focused_video.mp4", "Deep Focus")
    print("Point this script to your downloaded video files to populate ai/data/raw")
