@echo off
cd /d "%~dp0"
echo Steadier is starting at http://127.0.0.1:4173
echo Keep this window open while using the app. Close it to stop the server.
start "" "http://127.0.0.1:4173"
python -m http.server 4173 --bind 127.0.0.1 --directory dist
pause
