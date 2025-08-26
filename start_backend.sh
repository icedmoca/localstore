#!/bin/bash
cd backend
source venv/bin/activate
echo "Starting FastAPI backend..."
echo "Virtual environment: $(which python)"
echo "Python version: $(python --version)"
echo "FastAPI version: $(python -c "import fastapi; print(fastapi.__version__)")"
python fastapi_app.py
