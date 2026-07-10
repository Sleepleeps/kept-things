# Stops the currently running kept-things instance (if any) without touching
# the logon task — it will still auto-start next time you log in.
# Use uninstall-autostart.ps1 to remove the logon task entirely.

$ErrorActionPreference = 'Stop'

$RootDir = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $RootDir 'data\logs'
$PidFile = Join-Path $LogDir 'server.pid'
$StopFlag = Join-Path $LogDir 'server.stop'

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

# Tell the restart loop not to respawn node once we kill it.
New-Item -ItemType File -Force -Path $StopFlag | Out-Null

if (Test-Path $PidFile) {
    $nodePid = Get-Content -Path $PidFile -ErrorAction SilentlyContinue
    if ($nodePid) {
        $proc = Get-Process -Id $nodePid -ErrorAction SilentlyContinue
        if ($proc) {
            Stop-Process -Id $nodePid -Force
            Write-Host "Stopped kept-things (node PID $nodePid)" -ForegroundColor Green
        } else {
            Write-Host "Recorded process (PID $nodePid) is no longer running."
        }
    }
    Remove-Item -Path $PidFile -Force -ErrorAction SilentlyContinue
} else {
    Write-Host "No running kept-things instance found (data\logs\server.pid does not exist)."
}

# Also catch the case where the loop is between attempts (no node running yet)
# by giving it a moment to notice the stop flag on its own.
Start-Sleep -Seconds 1
Write-Host "Stop requested. It will still auto-start next time you log in, unless you run npm run autostart:uninstall."
