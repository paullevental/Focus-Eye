# Stage 1: Build the Java application
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app
COPY backend/pom.xml backend/
COPY backend/src backend/src
RUN mvn -f backend/pom.xml clean package -DskipTests

# Stage 2: Final image with Java, Python, and AI environment
FROM eclipse-temurin:17-jdk
WORKDIR /app

# Install Python and mandatory system dependencies for OpenCV/MediaPipe
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

# Copy the built JAR from the first stage
COPY --from=build /app/backend/target/FocusEye-0.0.1-SNAPSHOT.jar app.jar

# Copy AI source and model
COPY ai/ ai/

# Create a virtual environment and install AI requirements
# This avoids the "externally-managed-environment" error
RUN python3 -m venv /app/venv
RUN /app/venv/bin/pip install --no-cache-dir --upgrade pip && \
    /app/venv/bin/pip install --no-cache-dir \
    numpy \
    pandas \
    torch \
    torchvision \
    torchaudio \
    scikit-learn \
    requests \
    mediapipe \
    opencv-python-headless

# Environment variable defaults
# POINTING TO THE VENV PYTHON
ENV AI_PYTHON_PATH=/app/venv/bin/python
ENV AI_PREDICT_SCRIPT=ai/predict.py
ENV PORT=8080

# Run the application
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
