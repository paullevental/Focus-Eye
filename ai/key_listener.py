import sys
import requests
from pynput import keyboard
import json
import time

# Configurable backend URL
BACKEND_URL = "http://localhost:8080/api/sessions/status"

# Default keybinds (Should ideally be synced from backend)
KEYBINDS = {
    'start': 's',
    'pause': 'p',
    'stop': 'esc'
}

def on_press(key):
    try:
        if hasattr(key, 'char'):
            key_name = key.char
        else:
            key_name = key.name

        if key_name == KEYBINDS['start']:
            print("Start key pressed")
            notify_backend("START")
        elif key_name == KEYBINDS['pause']:
            print("Pause key pressed")
            notify_backend("PAUSE")
        elif key_name == KEYBINDS['stop']:
            print("Stop key pressed")
            notify_backend("STOP")
            
    except Exception as e:
        print(f"Error in key listener: {e}")

def notify_backend(status):
    try:
        payload = {"status": status, "timestamp": time.time()}
        response = requests.post(BACKEND_URL, json=payload)
        if response.status_code == 200:
            print(f"Backend notified: {status}")
        else:
            print(f"Failed to notify backend: {response.status_code}")
    except Exception as e:
        print(f"Connection error: {e}")

def start_listening():
    print(f"Global Key Listener Active...")
    print(f"Listening for: Start({KEYBINDS['start']}), Pause({KEYBINDS['pause']}), Stop({KEYBINDS['stop']})")
    
    with keyboard.Listener(on_press=on_press) as listener:
        listener.join()

if __name__ == "__main__":
    start_listening()
