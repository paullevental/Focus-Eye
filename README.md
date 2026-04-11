# FocusEye: AI-Powered Study Analytics

FocusEye is a real-time attention tracking system designed to help you understand your study habits. By combining computer vision and deep learning, it monitors facial landmarks to classify your focus levels into three categories: **Deep Focus**, **Partial Distraction**, and **Absent**.

## How It Works

FocusEye uses a distributed architecture to provide low-latency analytics while running complex AI inference:

1.  **Frontend (React/Vite):** Uses MediaPipe's Face Landmarker to extract 468 facial landmarks directly in the browser at 30fps.
2.  **Processing (Java/Spring Boot):** Buffers sequences of 30 frames (approximately 1 second of data) and coordinates communication between the UI and the AI engine.
3.  **Intelligence (PyTorch/LSTM):** A 2-layer LSTM (Long Short-Term Memory) neural network analyzes the *movement* and *pose* of your face over time. It doesn't just look at a single image; it looks at the temporal patterns of your attention.
4.  **Analytics (PostgreSQL/H2):** Stores session metrics, focus scores, and duration statistics to build your historical dashboard.

## The Tech Stack

*   **Frontend:** React, TypeScript, Vite, Tailwind CSS (Vanilla CSS focus), Lucide Icons.
*   **Backend:** Java 17, Spring Boot, Spring Data JPA.
*   **AI/ML:** Python 3, PyTorch, NumPy, MediaPipe.
*   **Database:** PostgreSQL (Production) / H2 (Local Development).

## Getting Started

### Prerequisites

*   **Java 17+** and **Maven**.
*   **Node.js** and **npm**.
*   **Python 3.10+** with `venv` support.

### Installation

1.  **AI Setup:**
    ```bash
    cd ai
    python -m venv venv
    source venv/bin/bin/activate # Windows: venv\Scripts\activate
    pip install -r requirements.txt
    ```

2.  **Backend Setup:**
    Configure your `.env` file in the `backend/` directory with your database credentials (matching the placeholders in `application.properties`).
    ```bash
    cd backend
    ./mvnw clean install
    ./mvnw spring-boot:run
    ```

3.  **Frontend Setup:**
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

## Project Structure

*   `/ai`: Contains the LSTM model architecture, the inference script (`predict.py`), and the training pipeline.
*   `/backend`: A Spring Boot application managing session state, user profiles, and the AI bridge.
*   `/frontend`: A React SPA featuring a sleek, Apple-inspired dashboard and session controls.
*   `/infra`: Placeholder for deployment scripts and Docker configurations.

## Deployment Vision

This project is built with scalability in mind. The backend is configured to use **AWS RDS (PostgreSQL)** for persistent data storage across sessions. The decoupled AI engine can be deployed as a standalone service or bundled with the backend in a containerized environment (Docker/ECS).

---
*Created with focus, for focus.*
