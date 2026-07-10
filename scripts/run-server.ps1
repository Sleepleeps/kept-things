# Restart-loop wrapper for kept-things. Not meant to be double-clicked directly;
# it's launched hidden by scripts/start-hidden.vbs via the Startup-folder shortcut
# (see install-autostart.ps1). Keeps `node server/index.js` running: restarts it
# on crash/exit, streams its output live into data/logs/, and stops respawning
# once scripts/stop-server.ps1 asks it to.

$ErrorActionPreference = 'Stop'

$RootDir = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $RootDir 'data\logs'
$PidFile = Join-Path $LogDir 'server.pid'
$StopFlag = Join-Path $LogDir 'server.stop'

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

# A fresh loop start always wins over a stale stop request from a previous session.
Remove-Item -Path $StopFlag -Force -ErrorAction SilentlyContinue

function Get-LogFile {
    Join-Path $LogDir ("server-{0}.log" -f (Get-Date -Format 'yyyy-MM-dd'))
}

function Write-LoopLog([string]$Message) {
    $line = "[{0}] [loop] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    Add-Content -Path (Get-LogFile) -Value $line -Encoding UTF8
}

function Remove-OldLogs {
    Get-ChildItem -Path $LogDir -Filter 'server-*.log' -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) } |
        Remove-Item -Force -ErrorAction SilentlyContinue
}

Set-Location $RootDir
Remove-OldLogs
Write-LoopLog 'kept-things autostart loop started'

$attempt = 0
while ($true) {
    if (Test-Path $StopFlag) {
        Write-LoopLog 'Stop requested, exiting loop without restarting'
        Remove-Item -Path $StopFlag -Force -ErrorAction SilentlyContinue
        break
    }

    $attempt++
    Write-LoopLog "Starting node server/index.js (attempt $attempt)"

    # Stream stdout/stderr line-by-line straight into today's log file as they
    # happen (not just after the process exits) — using .NET's Process class
    # directly, since Start-Process can't append and can't stream live.
    $currentLog = Get-LogFile
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = 'node'
    $psi.Arguments = 'server/index.js'
    $psi.WorkingDirectory = $RootDir
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
    $psi.StandardErrorEncoding = [System.Text.Encoding]::UTF8

    $proc = New-Object System.Diagnostics.Process
    $proc.StartInfo = $psi

    $outSub = Register-ObjectEvent -InputObject $proc -EventName OutputDataReceived -MessageData $currentLog -Action {
        if ($null -ne $EventArgs.Data) {
            Add-Content -Path $Event.MessageData -Value $EventArgs.Data -Encoding UTF8
        }
    }
    $errSub = Register-ObjectEvent -InputObject $proc -EventName ErrorDataReceived -MessageData $currentLog -Action {
        if ($null -ne $EventArgs.Data) {
            Add-Content -Path $Event.MessageData -Value "[stderr] $($EventArgs.Data)" -Encoding UTF8
        }
    }

    $proc.Start() | Out-Null
    $proc.BeginOutputReadLine()
    $proc.BeginErrorReadLine()

    Set-Content -Path $PidFile -Value $proc.Id -Encoding ASCII

    # Poll instead of $proc.WaitForExit(): that call blocks the only thread in
    # this runspace, so the queued OutputDataReceived/ErrorDataReceived events
    # above never get dispatched until the process exits, defeating "live" logs.
    # Start-Sleep yields back to the engine, letting queued events flush as they occur.
    while (-not $proc.HasExited) {
        Start-Sleep -Milliseconds 300
    }

    Unregister-Event -SourceIdentifier $outSub.Name -ErrorAction SilentlyContinue
    Unregister-Event -SourceIdentifier $errSub.Name -ErrorAction SilentlyContinue
    Remove-Job -Name $outSub.Name -Force -ErrorAction SilentlyContinue
    Remove-Job -Name $errSub.Name -Force -ErrorAction SilentlyContinue

    Write-LoopLog ("node process exited (PID {0}, exit code {1})" -f $proc.Id, $proc.ExitCode)
    Remove-Item -Path $PidFile -Force -ErrorAction SilentlyContinue
    Remove-OldLogs

    if (Test-Path $StopFlag) {
        Write-LoopLog 'Stop requested, exiting loop without restarting'
        Remove-Item -Path $StopFlag -Force -ErrorAction SilentlyContinue
        break
    }

    Start-Sleep -Seconds 3
}
