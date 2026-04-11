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
# libgl1 and libglib2.0-0 replace the deprecated libgl1-mesa-glx
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
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

# Install Python requirements
# We use --no-cache-dir to stay within Railway's build limits
RUN pip3 install --no-cache-dir \
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
ENV AI_PYTHON_PATH=python3
ENV AI_PREDICT_SCRIPT=ai/predict.py
ENV PORT=8080

# Run the application
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
