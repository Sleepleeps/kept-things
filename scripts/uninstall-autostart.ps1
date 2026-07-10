# Fully disables kept-things autostart: stops any running instance and
# removes the Startup-folder shortcut created by install-autostart.ps1.

$ErrorActionPreference = 'Stop'

$RootDir = Split-Path -Parent $PSScriptRoot
$StartupDir = [Environment]::GetFolderPath('Startup')
$ShortcutPath = Join-Path $StartupDir 'KeptThingsServer.lnk'

& (Join-Path $RootDir 'scripts\stop-server.ps1')

if (Test-Path $ShortcutPath) {
    Remove-Item -Path $ShortcutPath -Force
    Write-Host "Removed autostart shortcut: $ShortcutPath" -ForegroundColor Green
} else {
    Write-Host "Autostart shortcut not found (may not have been installed)."
}

Write-Host "kept-things will no longer autostart. Run npm start manually whenever you want to use it."
