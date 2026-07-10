' Launches the kept-things restart-loop with zero visible window.
' This is what Task Scheduler actually runs — wscript.exe hosting this file
' is the reliable way to get a truly hidden PowerShell process on Windows.
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
ps1Path = fso.BuildPath(scriptDir, "run-server.ps1")

cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps1Path & """"

Set shell = CreateObject("WScript.Shell")
shell.Run cmd, 0, False
