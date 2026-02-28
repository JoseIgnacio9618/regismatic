param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile
)

if (-not (Test-Path $BackupFile)) {
  throw "File not found: $BackupFile"
}

if (-not $env:POSTGRES_DB) { $env:POSTGRES_DB = "regismatic" }
if (-not $env:POSTGRES_USER) { $env:POSTGRES_USER = "regismatic" }

Get-Content $BackupFile | docker compose exec -T db psql -U $env:POSTGRES_USER -d $env:POSTGRES_DB

Write-Output "Restore completed from: $BackupFile"
