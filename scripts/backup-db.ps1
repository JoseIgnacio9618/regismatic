param(
  [string]$OutputDir = "./backups"
)

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$outFile = Join-Path $OutputDir "regismatic_$timestamp.sql"

if (-not $env:POSTGRES_DB) { $env:POSTGRES_DB = "regismatic" }
if (-not $env:POSTGRES_USER) { $env:POSTGRES_USER = "regismatic" }

$dumpCommand = "pg_dump -U $($env:POSTGRES_USER) -d $($env:POSTGRES_DB)"
docker compose exec -T db sh -c $dumpCommand > $outFile

Write-Output "Backup generated: $outFile"
