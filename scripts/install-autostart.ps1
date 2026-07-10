# Makes kept-things start hidden, in the background, whenever this Windows
# account logs on — by placing a shortcut in the per-user Startup folder that
# points at scripts/start-hidden.vbs. No admin rights required.
#
# (We use the Startup folder rather than Task Scheduler because Task
# Scheduler task creation is blocked on this machine — Register-ScheduledTask
# and schtasks.exe both fail with "Access is denied" even for a no-op task,
# which points to a local policy/AV restriction rather than anything about
# this project.)

$ErrorActionPreference = 'Stop'

$RootDir = Split-Path -Parent $PSScriptRoot
$VbsPath = Join-Path $RootDir 'scripts\start-hidden.vbs'
$StartupDir = [Environment]::GetFolderPath('Startup')
$ShortcutPath = Join-Path $StartupDir 'KeptThingsServer.lnk'

$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($ShortcutPath)
$shortcut.TargetPath = 'wscript.exe'
$shortcut.Arguments = '"' + $VbsPath + '"'
$shortcut.WorkingDirectory = $RootDir
$shortcut.Description = 'Starts kept-things hidden in the background at logon'
$shortcut.Save()

Write-Host "Installed autostart shortcut: $ShortcutPath" -ForegroundColor Green
Write-Host "Starting it now too, no need to log out/in..."

& wscript.exe $VbsPath

Start-Sleep -Seconds 2
Write-Host "Start command sent. In a few seconds, check http://localhost to confirm it worked."
Write-Host "Logs: data\logs\  |  Status: npm run autostart:status  |  Stop: npm run autostart:stop"
