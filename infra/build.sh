#!/usr/bin/env bash
# Exit on error
set -o errexit

# Navigate to project root relative to this script
cd "$(dirname "$0")/.."

echo "--- Building Java Backend ---"
cd backend
chmod +x mvnw
./mvnw clean package -DskipTests
cd ..

echo "--- Setting up Python Dependencies ---"
# Install dependencies globally in the Railway container
pip install --upgrade pip
pip install -r ai/requirements.txt

echo "--- Build Complete ---"
