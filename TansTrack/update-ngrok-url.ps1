# Usage: .\update-ngrok-url.ps1 https://abcd-1234.ngrok-free.app
param(
    [Parameter(Mandatory=$true)]
    [string]$NgrokUrl
)

$NgrokUrl = $NgrokUrl.TrimEnd('/')
$ApiUrl   = "$NgrokUrl/api/v1"

$driverEnv   = "$PSScriptRoot\transit\src\environments\environment.ts"
$commuterEnv = "$PSScriptRoot\Commuters\src\environments\environment.ts"

function Update-ApiUrl($file, $newUrl) {
    $content = Get-Content $file -Raw
    # Match apiUrl with either single or double quotes
    $updated = $content -replace "apiUrl:\s*(['""])[^'""]*\1", "apiUrl: '$newUrl'"
    Set-Content $file $updated -Encoding utf8 -NoNewline
    Write-Host "Updated $file"
}

Update-ApiUrl $driverEnv   $ApiUrl
Update-ApiUrl $commuterEnv $ApiUrl

Write-Host "`nBuilding driver app (transit)..."
Push-Location "$PSScriptRoot\transit"
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error "Driver build failed"; exit 1 }
npx cap sync android
Pop-Location

Write-Host "`nBuilding commuter app..."
Push-Location "$PSScriptRoot\Commuters"
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error "Commuter build failed"; exit 1 }
npx cap sync android
Pop-Location

Write-Host "`nDone. Both apps are pointing to: $ApiUrl"
Write-Host "Open Android Studio -> Build -> Make Project, then run on device."
