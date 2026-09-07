param([int]$Port = 3000)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node).Source
$taskName = 'NOKTA POS Server'
$action = New-ScheduledTaskAction -Execute $node -Argument 'server.js' -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description 'NOKTA POS local restaurant server' -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Host "NOKTA POS server installed and started on port $Port."
