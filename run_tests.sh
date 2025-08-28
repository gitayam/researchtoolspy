#!/bin/bash

# Exit on error
set -e

# Create and activate virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install/upgrade pip
python3 -m pip install --upgrade pip

# Install requirements
echo "Installing requirements..."
pip install -r requirements.txt

# Run tests with coverage
echo "Running tests..."
python3 -m pytest src/researchtools/tests/ \
    --cov=src/researchtools \
    --cov-report=term-missing \
    --cov-report=html \
    -v

# Deactivate virtual environment
deactivate 