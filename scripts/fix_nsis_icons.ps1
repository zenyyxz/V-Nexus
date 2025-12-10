
Add-Type -AssemblyName System.Drawing

$iconPath = "$PSScriptRoot\..\src-tauri\icons\icon.png"
$sidebarPath = "$PSScriptRoot\..\src-tauri\icons\SidebarImage.bmp"
$headerPath = "$PSScriptRoot\..\src-tauri\icons\HeaderImage.bmp"

Write-Host "Processing Icons..."
Write-Host "Source: $iconPath"

if (-not (Test-Path $iconPath)) {
    Write-Error "Source icon not found!"
    exit 1
}

$srcImage = [System.Drawing.Image]::FromFile($iconPath)

# Function to resize and pad (Fit Center)
function Create-SizedBmp {
    param (
        [int]$targetW,
        [int]$targetH,
        [string]$outPath,
        [int]$iconScale
    )

    $bmp = New-Object System.Drawing.Bitmap $targetW, $targetH
    $graph = [System.Drawing.Graphics]::FromImage($bmp)
    
    # Set background color (White to match installer theme)
    $graph.Clear([System.Drawing.Color]::White)
    
    # Calculate scaled dimensions (Aspect fit)
    $ratio = $srcImage.Width / $srcImage.Height
    
    # Define max icon size within the banner
    $maxIconW = $targetW * ($iconScale / 100)
    $maxIconH = $targetH * ($iconScale / 100)
    
    # Determine draw size
    $drawW = $maxIconW
    $drawH = $drawW / $ratio
    
    if ($drawH -gt $maxIconH) {
        $drawH = $maxIconH
        $drawW = $drawH * $ratio
    }
    
    # Center position
    $x = ($targetW - $drawW) / 2
    $y = ($targetH - $drawH) / 2
    
    # High Quality settings
    $graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graph.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    
    $graph.DrawImage($srcImage, $x, $y, $drawW, $drawH)
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
    
    $graph.Dispose()
    $bmp.Dispose()
    
    Write-Host "Created $outPath ($targetW x $targetH)"
}

# 1. Sidebar (164x314) - Icon at 80% width
Create-SizedBmp -targetW 164 -targetH 314 -outPath $sidebarPath -iconScale 80

# 2. Header (150x57) - Icon at 90% height (relative to width constraint usually, but let's constrain by height)
# For header, height is the limiting factor (57px). 
# We want the icon to be maybe 50px high.
# My logic above scales by width percentage first. Let's tweak call or logic?
# Logic: maxIconW = 150*0.9 = 135. maxIconH = 57*0.9 = 51.
# If src is square, 135x135 > 51. So height limits it to 51. Result: 51x51 icon centered.
Create-SizedBmp -targetW 150 -targetH 57 -outPath $headerPath -iconScale 90

$srcImage.Dispose()
Write-Host "Done."
