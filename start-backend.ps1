# ConsumerShield — start backend from anywhere
# Usage: & "c:\Users\HP\Desktop\ConsumerSheild\start-backend.ps1"

$backendDir = "$PSScriptRoot\consumershield\backend"
$python     = "$PSScriptRoot\.venv\Scripts\python.exe"

Write-Host "[ConsumerShield] Starting backend..." -ForegroundColor Cyan
Write-Host "[ConsumerShield] API docs → http://127.0.0.1:8000/docs" -ForegroundColor Green
Write-Host "[ConsumerShield] Press Ctrl+C to stop.`n" -ForegroundColor Yellow

& $python -m uvicorn main:app --host 127.0.0.1 --port 8000 --app-dir $backendDir
