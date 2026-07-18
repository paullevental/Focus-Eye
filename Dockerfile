# Stage 1: Build the Java application
FROM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /app
COPY backend/pom.xml backend/
COPY backend/src backend/src
RUN mvn -f backend/pom.xml clean package -DskipTests

# Stage 2: Final image — Java only. Inference runs in the browser (onnxruntime-web),
# so no Python, PyTorch, or ai/ sources are needed at runtime.
FROM eclipse-temurin:25-jre
WORKDIR /app

# Copy the built JAR from the build stage
COPY --from=build /app/backend/target/FocusEye-0.0.1-SNAPSHOT.jar app.jar

ENV APP_CORS_ALLOWED_ORIGINS=*

# Railway provides PORT, Spring Boot respects SERVER_PORT
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "java -jar -Dserver.port=${PORT:-8080} app.jar"]
