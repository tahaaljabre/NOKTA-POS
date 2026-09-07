$ErrorActionPreference = 'Stop'
$taskName = 'NOKTA POS Server'
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}
Write-Host 'NOKTA POS server task removed.'
