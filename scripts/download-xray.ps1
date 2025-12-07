$ErrorActionPreference = "Stop"

$xrayVersion = "v1.8.4" # Or "latest" logic
$url = "https://github.com/XTLS/Xray-core/releases/download/$xrayVersion/Xray-windows-64.zip"
$outputDir = "resources"
$zipFile = "$outputDir\xray.zip"

If (!(Test-Path $outputDir)) {
    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}

Write-Host "Downloading Xray Core ($xrayVersion)..."
Invoke-WebRequest -Uri $url -OutFile $zipFile

Write-Host "Extracting..."
Expand-Archive -Path $zipFile -DestinationPath $outputDir -Force

Write-Host "Cleaning up..."
Remove-Item $zipFile

# Move xray.exe/geosite/geoip if they are in a subfolder (sometimes they are)
# Xray zip structure: usually flat or inside a folder?
# Let's check listing.
$items = Get-ChildItem -Path $outputDir
Write-Host "Contents of $outputDir :"
$items | ForEach-Object { Write-Host $_.Name }

Write-Host "Xray Core setup complete."
