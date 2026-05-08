$ErrorActionPreference = "Stop"

function Wait-ForNgrokApi {
  param(
    [string]$NgrokApi = "http://127.0.0.1:4040/api/tunnels",
    [int]$TimeoutSeconds = 10
  )

  $start = Get-Date
  while (((Get-Date) - $start).TotalSeconds -lt $TimeoutSeconds) {
    try {
      Invoke-RestMethod -Uri $NgrokApi -Method Get -TimeoutSec 2 | Out-Null
      return
    } catch {
      Start-Sleep -Milliseconds 300
    }
  }
  throw "ngrok api not reachable at $NgrokApi (is ngrok running?)"
}

Write-Host "Starting ngrok tunnel for http://localhost:8000 ..."

# If ngrok is already running (API reachable), don't spawn another.
try {
  Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -Method Get -TimeoutSec 2 | Out-Null
  Write-Host "ngrok already running; reusing existing tunnel."
} catch {
  # Start ngrok in a new window so it keeps running.
  Start-Process -FilePath "ngrok" -ArgumentList "http 8000" -WindowStyle Normal | Out-Null
  Wait-ForNgrokApi
}

Write-Host "Syncing environment files to current ngrok URL ..."
node (Join-Path $PSScriptRoot "sync-ngrok-env.mjs")

Write-Host ""
Write-Host "Next steps (per app):"
Write-Host "  Driver:   cd TansTrack/transit    ; ionic build ; npx cap sync android"
Write-Host "  Commuter: cd TansTrack/Commuters  ; ionic build ; npx cap sync android"

