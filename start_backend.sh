#!/bin/bash
cd backend
source venv/bin/activate
echo "Starting Flask backend..."
echo "Virtual environment: $(which python)"
echo "Python version: $(python --version)"
echo "Flask version: $(python -c "import flask; print(flask.__version__)")"
python app.py
