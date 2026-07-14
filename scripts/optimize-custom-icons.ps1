param(
  [string]$SourcePath = (Join-Path $PSScriptRoot "..\assets\grob115b_app_icon_512.png"),
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\icons"),
  [int]$WhiteThreshold = 245,
  [double]$PaddingRatio = 0.025
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

function Test-IsBorderWhite {
  param(
    [System.Drawing.Color]$Color,
    [int]$Threshold
  )

  return $Color.A -gt 0 -and $Color.R -ge $Threshold -and $Color.G -ge $Threshold -and $Color.B -ge $Threshold
}

function Remove-WhiteBorder {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [int]$Threshold
  )

  $width = $Bitmap.Width
  $height = $Bitmap.Height
  $visited = New-Object 'bool[,]' $width, $height
  $queue = [System.Collections.Generic.Queue[System.Drawing.Point]]::new()

  function Enqueue-IfWhite {
    param([int]$X, [int]$Y)

    if ($X -lt 0 -or $X -ge $width -or $Y -lt 0 -or $Y -ge $height) {
      return
    }
    if ($visited[$X, $Y]) {
      return
    }

    $visited[$X, $Y] = $true
    if (Test-IsBorderWhite -Color $Bitmap.GetPixel($X, $Y) -Threshold $Threshold) {
      $queue.Enqueue([System.Drawing.Point]::new($X, $Y))
    }
  }

  for ($x = 0; $x -lt $width; $x += 1) {
    Enqueue-IfWhite -X $x -Y 0
    Enqueue-IfWhite -X $x -Y ($height - 1)
  }

  for ($y = 0; $y -lt $height; $y += 1) {
    Enqueue-IfWhite -X 0 -Y $y
    Enqueue-IfWhite -X ($width - 1) -Y $y
  }

  while ($queue.Count -gt 0) {
    $point = $queue.Dequeue()
    $Bitmap.SetPixel($point.X, $point.Y, [System.Drawing.Color]::FromArgb(0, 255, 255, 255))

    Enqueue-IfWhite -X ($point.X - 1) -Y $point.Y
    Enqueue-IfWhite -X ($point.X + 1) -Y $point.Y
    Enqueue-IfWhite -X $point.X -Y ($point.Y - 1)
    Enqueue-IfWhite -X $point.X -Y ($point.Y + 1)
  }
}

function Get-ContentBounds {
  param([System.Drawing.Bitmap]$Bitmap)

  $minX = $Bitmap.Width
  $minY = $Bitmap.Height
  $maxX = -1
  $maxY = -1

  for ($y = 0; $y -lt $Bitmap.Height; $y += 1) {
    for ($x = 0; $x -lt $Bitmap.Width; $x += 1) {
      if ($Bitmap.GetPixel($x, $y).A -gt 0) {
        if ($x -lt $minX) { $minX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }

  if ($maxX -lt $minX -or $maxY -lt $minY) {
    throw "No visible pixels found in source image."
  }

  return [System.Drawing.Rectangle]::new($minX, $minY, ($maxX - $minX + 1), ($maxY - $minY + 1))
}

function New-ResizedIcon {
  param(
    [System.Drawing.Bitmap]$SourceBitmap,
    [int]$TargetSize,
    [double]$PaddingRatio
  )

  $canvas = New-Object System.Drawing.Bitmap $TargetSize, $TargetSize
  $canvas.SetResolution(144, 144)
  $graphics = [System.Drawing.Graphics]::FromImage($canvas)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $padding = [int][Math]::Round($TargetSize * $PaddingRatio)
  $destinationSize = $TargetSize - ($padding * 2)
  $graphics.DrawImage(
    $SourceBitmap,
    [System.Drawing.Rectangle]::new($padding, $padding, $destinationSize, $destinationSize),
    [System.Drawing.Rectangle]::new(0, 0, $SourceBitmap.Width, $SourceBitmap.Height),
    [System.Drawing.GraphicsUnit]::Pixel
  )

  $graphics.Dispose()
  return $canvas
}

if (-not (Test-Path -LiteralPath $SourcePath)) {
  throw "Source icon not found: $SourcePath"
}

$sourceImage = [System.Drawing.Bitmap]::FromFile($SourcePath)
try {
  Remove-WhiteBorder -Bitmap $sourceImage -Threshold $WhiteThreshold
  $bounds = Get-ContentBounds -Bitmap $sourceImage
  $cropped = $sourceImage.Clone($bounds, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

  try {
    New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

    $outputs = @(
      @{ Size = 32; Name = "favicon-32.png" },
      @{ Size = 180; Name = "apple-touch-icon.png" },
      @{ Size = 192; Name = "icon-192.png" },
      @{ Size = 512; Name = "icon-512.png" }
    )

    foreach ($output in $outputs) {
      $iconBitmap = New-ResizedIcon -SourceBitmap $cropped -TargetSize $output.Size -PaddingRatio $PaddingRatio
      try {
        $iconBitmap.Save((Join-Path $OutputDirectory $output.Name), [System.Drawing.Imaging.ImageFormat]::Png)
      } finally {
        $iconBitmap.Dispose()
      }
    }
  } finally {
    $cropped.Dispose()
  }
} finally {
  $sourceImage.Dispose()
}

Write-Output "Optimized custom icons written to $OutputDirectory"
