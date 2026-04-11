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

echo "--- Setting up Python Environment ---"
# Railway provides python3 by default
# We will install dependencies directly into the system environment to save space
# or use a local venv if preferred. Let's use a local one for safety.
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r ai/requirements.txt

echo "--- Build Complete ---"
