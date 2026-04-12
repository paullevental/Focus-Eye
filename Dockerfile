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

# 1. Create the virtual environment
RUN python3 -m venv /opt/venv

# 2. Force the entire container to use the virtual environment by default
# This makes 'python' and 'pip' point to /opt/venv/bin/ automatically
ENV PATH="/opt/venv/bin:$PATH"

# 3. Install AI requirements into the venv (now safe from PEP 668)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir \
    numpy \
    pandas \
    torch \
    torchvision \
    torchaudio \
    scikit-learn \
    requests \
    mediapipe \
    opencv-python-headless

# Copy the built JAR from the build stage
COPY --from=build /app/backend/target/FocusEye-0.0.1-SNAPSHOT.jar app.jar

# Copy AI source and model
COPY ai/ ai/

# Environment variables for the Java Backend
# Since we added /opt/venv/bin to PATH, 'python3' is now the venv python
ENV AI_PYTHON_PATH=python3
ENV AI_PREDICT_SCRIPT=ai/predict.py
ENV PORT=8080

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
