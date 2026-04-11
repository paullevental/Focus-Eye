# Stage 1: Build the Java application using Maven and Temurin JDK 17
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app
COPY backend/pom.xml backend/
COPY backend/src backend/src
RUN mvn -f backend/pom.xml clean package -DskipTests

# Stage 2: Final image with Java, Python, and AI environment
FROM eclipse-temurin:17-jdk
WORKDIR /app

# Install Python and system dependencies for OpenCV/MediaPipe
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy the built JAR from the first stage
COPY --from=build /app/backend/target/FocusEye-0.0.1-SNAPSHOT.jar app.jar

# Copy AI source and model
COPY ai/ ai/

# Install Python requirements
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

# Run the application
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
