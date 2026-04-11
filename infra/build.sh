#!/usr/bin/env bash
# Exit on error
set -o errexit

# Navigate to project root relative to this script
cd "$(dirname "$0")/.."

echo "--- Building Java Backend ---"
cd backend
./mvnw clean package -DskipTests
cd ..

echo "--- Setting up Python Environment ---"
# Create a virtual environment for the AI
python3 -m venv ai/venv
source ai/venv/bin/activate
pip install --upgrade pip
pip install -r ai/requirements.txt

echo "--- Build Complete ---"
