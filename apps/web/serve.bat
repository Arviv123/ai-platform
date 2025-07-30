@echo off
cd out
echo Starting local server at http://localhost:8000
echo Press Ctrl+C to stop
python -m http.server 8000
pause