# Reports whether the Startup-folder autostart shortcut is installed and
# whether kept-things is currently running.

$ErrorActionPreference = 'SilentlyContinue'

$RootDir = Split-Path -Parent $PSScriptRoot
$StartupDir = [Environment]::GetFolderPath('Startup')
$ShortcutPath = Join-Path $StartupDir 'KeptThingsServer.lnk'
$PidFile = Join-Path $RootDir 'data\logs\server.pid'

if (Test-Path $ShortcutPath) {
    Write-Host "Autostart: installed ($ShortcutPath)" -ForegroundColor Green
} else {
    Write-Host "Autostart: not installed" -ForegroundColor Yellow
}

if (Test-Path $PidFile) {
    $nodePid = Get-Content -Path $PidFile
    $proc = Get-Process -Id $nodePid -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host "Server: running (PID $nodePid, started $($proc.StartTime))" -ForegroundColor Green
    } else {
        Write-Host "Server: pid file exists but process is gone, may have just crashed and be restarting" -ForegroundColor Yellow
    }
} else {
    Write-Host "Server: not running" -ForegroundColor Yellow
}

Write-Host "Log directory: $RootDir\data\logs\"
