@echo off
echo Stopping Privilege Walk Servers...
taskkill /F /IM node.exe >nul 2>&1
echo Node and React processes stopped successfully.
pause