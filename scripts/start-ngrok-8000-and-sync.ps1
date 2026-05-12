<#
.SYNOPSIS
  Start an ngrok HTTP tunnel to your local API port and sync apiUrl in Ionic/Angular dev environments.

.DESCRIPTION
  - Starts `ngrok http <Port>` if nothing is listening on ngrok's local API (4040).
  - Reads the public HTTPS URL from http://127.0.0.1:4040/api/tunnels
  - Updates apiUrl in:
      TansTrack/transit/src/environments/environment.ts
      TansTrack/Commuters/src/environments/environment.ts
  Ensure Laravel (e.g. BusOperator) is already running on the same port (default 8000).

.PARAMETER Port
  Local port ngrok should forward (default 8000).

.PARAMETER SyncOnly
  Do not start ngrok; only read tunnels from localhost:4040 and patch environment files.

.EXAMPLE
  .\scripts\start-ngrok-8000-and-sync.ps1
  .\scripts\start-ngrok-8000-and-sync.ps1 -Port 8001
  .\scripts\start-ngrok-8000-and-sync.ps1 -SyncOnly
#>
param(
    [int] $Port = 8000,
    [switch] $SyncOnly
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir

function Get-NgrokHttpsBaseUrl {
    $resp = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' -TimeoutSec 3
    $https = @($resp.tunnels | Where-Object { $_.proto -eq 'https' })
    if ($https.Count -eq 0) {
        throw 'No HTTPS tunnel found in ngrok API response.'
    }
    # Prefer tunnel whose config addr matches our port
    $match = $https | Where-Object { $_.config.addr -match "[:/]$Port`$" -or $_.config.addr -match ":$Port" }
    $pick = if (@($match).Count -gt 0) { $match[0] } else { $https[0] }
    return ($pick.public_url.TrimEnd('/'))
}

function Set-DevApiUrl {
    param([string] $FilePath, [string] $NewApiUrl)
    if (-not (Test-Path -LiteralPath $FilePath)) {
        Write-Warning "Skip missing file: $FilePath"
        return
    }
    $raw = Get-Content -LiteralPath $FilePath -Raw -Encoding UTF8
    $pat = "apiUrl:\s*'[^']*'"
    $repl = "apiUrl: '$($NewApiUrl.Replace("'", "''"))'"
    if ($raw -notmatch $pat) {
        throw "Could not find apiUrl assignment in: $FilePath"
    }
    $new = [regex]::Replace($raw, $pat, $repl, 1)
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($FilePath, $new, $utf8)
    Write-Host "Updated apiUrl -> $NewApiUrl" -ForegroundColor Green
    Write-Host "  $FilePath"
}

if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
    throw 'ngrok not found in PATH. Install from https://ngrok.com/download and/or add to PATH.'
}

if (-not (Test-NetConnection -ComputerName 127.0.0.1 -Port $Port -InformationLevel Quiet -WarningAction SilentlyContinue)) {
    Write-Warning "Nothing is listening on port $Port — start Laravel first (e.g. php artisan serve --host=127.0.0.1 --port=$Port)."
}

$ngrokApiUp = $false
try {
    $null = Invoke-WebRequest -Uri 'http://127.0.0.1:4040/api/tunnels' -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop
    $ngrokApiUp = $true
} catch {
    $ngrokApiUp = $false
}

if (-not $SyncOnly -and -not $ngrokApiUp) {
    Write-Host "Starting ngrok http $Port ..." -ForegroundColor Cyan
    Start-Process -FilePath 'ngrok' -ArgumentList @('http', "$Port") -WindowStyle Normal
}

$deadline = (Get-Date).AddSeconds(45)
$baseUrl = $null
while ((Get-Date) -lt $deadline) {
    try {
        $baseUrl = Get-NgrokHttpsBaseUrl
        break
    } catch {
        Start-Sleep -Seconds 1
    }
}
if (-not $baseUrl) {
    throw 'Timed out waiting for ngrok (http://127.0.0.1:4040). Is ngrok running? Try: ngrok http ' + $Port
}

$apiUrl = "$baseUrl/api/v1"
Set-DevApiUrl -FilePath (Join-Path $RepoRoot 'TansTrack\transit\src\environments\environment.ts') -NewApiUrl $apiUrl
Set-DevApiUrl -FilePath (Join-Path $RepoRoot 'TansTrack\Commuters\src\environments\environment.ts') -NewApiUrl $apiUrl

Write-Host ""
Write-Host 'Done. Rebuild or restart ionic serve / ng serve so the app picks up the new apiUrl.' -ForegroundColor Cyan
Write-Host "Tunnel base: $baseUrl"
