param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\icons")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

function New-RoundedRectanglePath {
  param(
    [System.Drawing.RectangleF]$Rectangle,
    [float]$Radius
  )

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $Radius * 2

  $path.AddArc($Rectangle.X, $Rectangle.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($Rectangle.Right - $diameter, $Rectangle.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($Rectangle.X, $Rectangle.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()

  return $path
}

function New-ColorBlend {
  $blend = New-Object System.Drawing.Drawing2D.ColorBlend
  $blend.Colors = [System.Drawing.Color[]]@(
    [System.Drawing.Color]::FromArgb(255, 8, 41, 66),
    [System.Drawing.Color]::FromArgb(255, 7, 82, 120),
    [System.Drawing.Color]::FromArgb(255, 17, 118, 155)
  )
  $blend.Positions = [single[]]@(0.0, 0.56, 1.0)
  return $blend
}

function Draw-PerformanceGrid {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$Size
  )

  $gridPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(34, 255, 255, 255), [single]($Size * 0.004))
  for ($index = 0; $index -lt 4; $index += 1) {
    $x = $Size * (0.2 + ($index * 0.14))
    $y = $Size * (0.72 - ($index * 0.08))
    $Graphics.DrawLine($gridPen, $x, $Size * 0.72, $x, $Size * 0.3)
    $Graphics.DrawLine($gridPen, $Size * 0.18, $y, $Size * 0.82, $y)
  }
  $gridPen.Dispose()
}

function Draw-ChartPanel {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$Size
  )

  $gridPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(44, 255, 255, 255), [single]($Size * 0.0035))
  $axisPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(128, 230, 242, 255), [single]($Size * 0.005))
  $solidPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(200, 245, 249, 255), [single]($Size * 0.007))
  $solidPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $dashPenA = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(145, 225, 240, 255), [single]($Size * 0.005))
  $dashPenA.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
  $dashPenB = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(110, 225, 240, 255), [single]($Size * 0.005))
  $dashPenB.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash

  $left = $Size * 0.55
  $right = $Size * 0.89
  $top = $Size * 0.5
  $bottom = $Size * 0.77

  for ($step = 0; $step -lt 5; $step += 1) {
    $x = $left + (($right - $left) * $step / 4)
    $y = $top + (($bottom - $top) * $step / 4)
    $Graphics.DrawLine($gridPen, $x, $top, $x, $bottom)
    $Graphics.DrawLine($gridPen, $left, $y, $right, $y)
  }

  $Graphics.DrawLine($axisPen, $left, $bottom, $right, $bottom)
  $Graphics.DrawLine($axisPen, $left, $bottom, $left, $top)

  $curveA = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($left, $Size * 0.65),
    [System.Drawing.PointF]::new($Size * 0.62, $Size * 0.58),
    [System.Drawing.PointF]::new($Size * 0.71, $Size * 0.5),
    [System.Drawing.PointF]::new($Size * 0.79, $Size * 0.49),
    [System.Drawing.PointF]::new($Size * 0.86, $Size * 0.57),
    [System.Drawing.PointF]::new($Size * 0.88, $Size * 0.63)
  )
  $curveB = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($left, $Size * 0.69),
    [System.Drawing.PointF]::new($Size * 0.63, $Size * 0.63),
    [System.Drawing.PointF]::new($Size * 0.73, $Size * 0.57),
    [System.Drawing.PointF]::new($Size * 0.8, $Size * 0.56),
    [System.Drawing.PointF]::new($Size * 0.86, $Size * 0.61),
    [System.Drawing.PointF]::new($Size * 0.88, $Size * 0.67)
  )
  $curveC = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($left, $Size * 0.74),
    [System.Drawing.PointF]::new($Size * 0.64, $Size * 0.71),
    [System.Drawing.PointF]::new($Size * 0.74, $Size * 0.67),
    [System.Drawing.PointF]::new($Size * 0.82, $Size * 0.64),
    [System.Drawing.PointF]::new($Size * 0.87, $Size * 0.65),
    [System.Drawing.PointF]::new($Size * 0.88, $Size * 0.7)
  )

  $Graphics.DrawCurve($solidPen, $curveA)
  $Graphics.DrawCurve($dashPenA, $curveB)
  $Graphics.DrawCurve($dashPenB, $curveC)

  $dashPenB.Dispose()
  $dashPenA.Dispose()
  $solidPen.Dispose()
  $axisPen.Dispose()
  $gridPen.Dispose()
}

function Draw-CalculatorGlyph {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$Size
  )

  $shellRect = [System.Drawing.RectangleF]::new($Size * 0.1, $Size * 0.56, $Size * 0.27, $Size * 0.29)
  $shellPath = New-RoundedRectanglePath -Rectangle $shellRect -Radius ($Size * 0.04)
  $shellBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(232, 248, 251, 255))
  $screenPath = New-RoundedRectanglePath -Rectangle ([System.Drawing.RectangleF]::new($Size * 0.135, $Size * 0.59, $Size * 0.2, $Size * 0.065)) -Radius ($Size * 0.02)
  $screenBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 22, 83, 146))
  $keyBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 44, 104, 168))
  $iconPen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, [single]($Size * 0.01))
  $iconPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $iconPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  $Graphics.FillPath($shellBrush, $shellPath)
  $Graphics.FillPath($screenBrush, $screenPath)

  foreach ($row in 0..1) {
    foreach ($col in 0..1) {
      $keyRect = [System.Drawing.RectangleF]::new($Size * (0.135 + ($col * 0.103)), $Size * (0.685 + ($row * 0.092)), $Size * 0.085, $Size * 0.072)
      $keyPath = New-RoundedRectanglePath -Rectangle $keyRect -Radius ($Size * 0.02)
      $Graphics.FillPath($keyBrush, $keyPath)
      $keyPath.Dispose()
    }
  }

  $Graphics.DrawLine($iconPen, $Size * 0.17, $Size * 0.72, $Size * 0.21, $Size * 0.72)
  $Graphics.DrawLine($iconPen, $Size * 0.19, $Size * 0.7, $Size * 0.19, $Size * 0.74)
  $Graphics.DrawLine($iconPen, $Size * 0.27, $Size * 0.72, $Size * 0.31, $Size * 0.72)
  $Graphics.DrawLine($iconPen, $Size * 0.18, $Size * 0.8, $Size * 0.21, $Size * 0.83)
  $Graphics.DrawLine($iconPen, $Size * 0.21, $Size * 0.8, $Size * 0.18, $Size * 0.83)
  $Graphics.DrawLine($iconPen, $Size * 0.27, $Size * 0.8, $Size * 0.31, $Size * 0.8)
  $Graphics.DrawLine($iconPen, $Size * 0.27, $Size * 0.83, $Size * 0.31, $Size * 0.83)

  $iconPen.Dispose()
  $keyBrush.Dispose()
  $screenBrush.Dispose()
  $screenPath.Dispose()
  $shellBrush.Dispose()
  $shellPath.Dispose()
}

function Draw-TitleBlock {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$Size
  )

  if ($Size -lt 180) {
    return
  }

  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center

  $titleFont = New-Object System.Drawing.Font("Segoe UI", [single]($Size * 0.082), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $subtitleFont = New-Object System.Drawing.Font("Segoe UI", [single]($Size * 0.036), [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(248, 252, 255, 255))

  $Graphics.DrawString("GROB 115B", $titleFont, $textBrush, [System.Drawing.RectangleF]::new($Size * 0.38, $Size * 0.79, $Size * 0.5, $Size * 0.08), $format)
  $Graphics.DrawString("PERFORMANCE CALCULATOR", $subtitleFont, $textBrush, [System.Drawing.RectangleF]::new($Size * 0.16, $Size * 0.88, $Size * 0.7, $Size * 0.04), $format)

  $textBrush.Dispose()
  $subtitleFont.Dispose()
  $titleFont.Dispose()
  $format.Dispose()
}

function Draw-AircraftSide {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$Size
  )

  $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(48, 0, 0, 0))
  $bodyBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(248, 250, 252, 255))
  $detailBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 126, 20, 28))
  $canopyBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 57, 103, 142))
  $windowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(170, 15, 31, 48))
  $tyreBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 28, 34, 41))
  $strutPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 190, 198, 207), [single]($Size * 0.01))
  $outlinePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(140, 181, 205, 222), [single]($Size * 0.006))
  $trimPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 167, 39, 45), [single]($Size * 0.006))

  $fuselagePoints = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($Size * 0.12, $Size * 0.54),
    [System.Drawing.PointF]::new($Size * 0.16, $Size * 0.49),
    [System.Drawing.PointF]::new($Size * 0.27, $Size * 0.48),
    [System.Drawing.PointF]::new($Size * 0.34, $Size * 0.43),
    [System.Drawing.PointF]::new($Size * 0.42, $Size * 0.38),
    [System.Drawing.PointF]::new($Size * 0.53, $Size * 0.39),
    [System.Drawing.PointF]::new($Size * 0.61, $Size * 0.43),
    [System.Drawing.PointF]::new($Size * 0.74, $Size * 0.45),
    [System.Drawing.PointF]::new($Size * 0.85, $Size * 0.46),
    [System.Drawing.PointF]::new($Size * 0.9, $Size * 0.41),
    [System.Drawing.PointF]::new($Size * 0.92, $Size * 0.43),
    [System.Drawing.PointF]::new($Size * 0.91, $Size * 0.49),
    [System.Drawing.PointF]::new($Size * 0.88, $Size * 0.53),
    [System.Drawing.PointF]::new($Size * 0.82, $Size * 0.55),
    [System.Drawing.PointF]::new($Size * 0.63, $Size * 0.57),
    [System.Drawing.PointF]::new($Size * 0.46, $Size * 0.58),
    [System.Drawing.PointF]::new($Size * 0.3, $Size * 0.59),
    [System.Drawing.PointF]::new($Size * 0.18, $Size * 0.58)
  )
  $fuselagePath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $fuselagePath.AddClosedCurve($fuselagePoints, 0.18)

  $wingPoints = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($Size * 0.46, $Size * 0.5),
    [System.Drawing.PointF]::new($Size * 0.65, $Size * 0.35),
    [System.Drawing.PointF]::new($Size * 0.6, $Size * 0.58),
    [System.Drawing.PointF]::new($Size * 0.36, $Size * 0.61)
  )
  $wingPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $wingPath.AddPolygon($wingPoints)

  $tailPoints = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($Size * 0.82, $Size * 0.46),
    [System.Drawing.PointF]::new($Size * 0.87, $Size * 0.29),
    [System.Drawing.PointF]::new($Size * 0.93, $Size * 0.31),
    [System.Drawing.PointF]::new($Size * 0.9, $Size * 0.49)
  )
  $tailPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $tailPath.AddPolygon($tailPoints)

  $stabilizerPoints = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($Size * 0.82, $Size * 0.51),
    [System.Drawing.PointF]::new($Size * 0.94, $Size * 0.49),
    [System.Drawing.PointF]::new($Size * 0.85, $Size * 0.56)
  )
  $stabilizerPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $stabilizerPath.AddPolygon($stabilizerPoints)

  $wheelFairingPoints = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($Size * 0.32, $Size * 0.67),
    [System.Drawing.PointF]::new($Size * 0.4, $Size * 0.645),
    [System.Drawing.PointF]::new($Size * 0.46, $Size * 0.675),
    [System.Drawing.PointF]::new($Size * 0.39, $Size * 0.705)
  )
  $wheelFairingPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $wheelFairingPath.AddClosedCurve($wheelFairingPoints, 0.18)

  $noseWheelFairingPoints = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($Size * 0.17, $Size * 0.645),
    [System.Drawing.PointF]::new($Size * 0.235, $Size * 0.635),
    [System.Drawing.PointF]::new($Size * 0.2, $Size * 0.69)
  )
  $noseWheelFairingPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $noseWheelFairingPath.AddPolygon($noseWheelFairingPoints)

  $shadowState = $Graphics.Save()
  $Graphics.TranslateTransform($Size * 0.008, $Size * 0.014)
  $Graphics.FillPath($shadowBrush, $wingPath)
  $Graphics.FillPath($shadowBrush, $fuselagePath)
  $Graphics.FillPath($shadowBrush, $tailPath)
  $Graphics.FillPath($shadowBrush, $stabilizerPath)
  $Graphics.Restore($shadowState)

  $Graphics.FillPath($bodyBrush, $wingPath)
  $Graphics.FillPath($bodyBrush, $fuselagePath)
  $Graphics.FillPath($bodyBrush, $tailPath)
  $Graphics.FillPath($bodyBrush, $stabilizerPath)
  $Graphics.FillPath($bodyBrush, $wheelFairingPath)
  $Graphics.FillPath($bodyBrush, $noseWheelFairingPath)

  $canopyPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $canopyPoints = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($Size * 0.34, $Size * 0.46),
    [System.Drawing.PointF]::new($Size * 0.41, $Size * 0.36),
    [System.Drawing.PointF]::new($Size * 0.5, $Size * 0.385),
    [System.Drawing.PointF]::new($Size * 0.515, $Size * 0.455)
  )
  $canopyPath.AddClosedCurve($canopyPoints, 0.2)
  $Graphics.FillPath($canopyBrush, $canopyPath)

  $Graphics.DrawPath($outlinePen, $wingPath)
  $Graphics.DrawPath($outlinePen, $fuselagePath)
  $Graphics.DrawPath($outlinePen, $tailPath)
  $Graphics.DrawPath($outlinePen, $stabilizerPath)
  $Graphics.DrawPath($outlinePen, $wheelFairingPath)
  $Graphics.DrawPath($outlinePen, $canopyPath)

  $Graphics.DrawLine($trimPen, $Size * 0.22, $Size * 0.505, $Size * 0.8, $Size * 0.5)
  $Graphics.DrawLine($trimPen, $Size * 0.82, $Size * 0.455, $Size * 0.9, $Size * 0.37)
  $Graphics.DrawLine($trimPen, $Size * 0.825, $Size * 0.48, $Size * 0.91, $Size * 0.43)
  $Graphics.DrawLine($trimPen, $Size * 0.83, $Size * 0.505, $Size * 0.89, $Size * 0.485)

  $Graphics.FillRectangle($detailBrush, $Size * 0.84, $Size * 0.33, $Size * 0.035, $Size * 0.011)
  $Graphics.FillRectangle([System.Drawing.Brushes]::Black, $Size * 0.84, $Size * 0.341, $Size * 0.035, $Size * 0.011)
  $Graphics.FillRectangle([System.Drawing.Brushes]::Gold, $Size * 0.84, $Size * 0.352, $Size * 0.035, $Size * 0.011)

  $Graphics.FillRectangle($windowBrush, $Size * 0.425, $Size * 0.398, $Size * 0.012, $Size * 0.05)
  $Graphics.FillEllipse($tyreBrush, $Size * 0.335, $Size * 0.677, $Size * 0.052, $Size * 0.052)
  $Graphics.FillEllipse($tyreBrush, $Size * 0.187, $Size * 0.662, $Size * 0.042, $Size * 0.042)
  $Graphics.DrawLine($strutPen, $Size * 0.355, $Size * 0.585, $Size * 0.355, $Size * 0.678)
  $Graphics.DrawLine($strutPen, $Size * 0.205, $Size * 0.59, $Size * 0.205, $Size * 0.664)

  $canopyPath.Dispose()
  $noseWheelFairingPath.Dispose()
  $wheelFairingPath.Dispose()
  $stabilizerPath.Dispose()
  $tailPath.Dispose()
  $wingPath.Dispose()
  $fuselagePath.Dispose()
  $trimPen.Dispose()
  $outlinePen.Dispose()
  $strutPen.Dispose()
  $tyreBrush.Dispose()
  $windowBrush.Dispose()
  $canopyBrush.Dispose()
  $detailBrush.Dispose()
  $bodyBrush.Dispose()
  $shadowBrush.Dispose()
}

function Save-AppIcon {
  param(
    [int]$Size,
    [string]$Path
  )

  $bitmap = New-Object System.Drawing.Bitmap $Size, $Size
  $bitmap.SetResolution(144, 144)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $padding = $Size * 0.06
  $card = [System.Drawing.RectangleF]::new($padding, $padding, $Size - ($padding * 2), $Size - ($padding * 2))
  $cornerRadius = $Size * 0.18

  $cardPath = New-RoundedRectanglePath -Rectangle $card -Radius $cornerRadius
  $fillBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    [System.Drawing.PointF]::new($card.Left, $card.Top),
    [System.Drawing.PointF]::new($card.Right, $card.Bottom),
    [System.Drawing.Color]::Black,
    [System.Drawing.Color]::White
  )
  $fillBrush.InterpolationColors = New-ColorBlend
  $graphics.FillPath($fillBrush, $cardPath)

  $highlightBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($cardPath)
  $highlightBrush.CenterColor = [System.Drawing.Color]::FromArgb(74, 255, 255, 255)
  $highlightBrush.SurroundColors = [System.Drawing.Color[]]@([System.Drawing.Color]::FromArgb(0, 255, 255, 255))
  $graphics.FillPath($highlightBrush, $cardPath)

  $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(80, 255, 255, 255), [single]($Size * 0.01))
  $graphics.DrawPath($borderPen, $cardPath)

  $shadowPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(42, 0, 0, 0), [single]($Size * 0.032))
  $shadowPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $shadowPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $shadowPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  $accentPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 73, 199, 245), [single]($Size * 0.03))
  $accentPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $accentPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  $ringPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(235, 255, 255, 255), [single]($Size * 0.04))
  $ringPen.Alignment = [System.Drawing.Drawing2D.PenAlignment]::Center

  $glowPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(70, 73, 199, 245), [single]($Size * 0.085))
  $linePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 107, 228, 255), [single]($Size * 0.028))
  $linePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $linePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

  Draw-PerformanceGrid -Graphics $graphics -Size $Size
  Draw-ChartPanel -Graphics $graphics -Size $Size

  $perfLine = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($Size * 0.22, $Size * 0.7),
    [System.Drawing.PointF]::new($Size * 0.35, $Size * 0.61),
    [System.Drawing.PointF]::new($Size * 0.47, $Size * 0.56),
    [System.Drawing.PointF]::new($Size * 0.62, $Size * 0.45),
    [System.Drawing.PointF]::new($Size * 0.79, $Size * 0.28)
  )
  $graphics.DrawLines($shadowPen, $perfLine)
  $graphics.DrawLines($linePen, $perfLine)

  $arrowHead = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($Size * 0.75, $Size * 0.28),
    [System.Drawing.PointF]::new($Size * 0.84, $Size * 0.26),
    [System.Drawing.PointF]::new($Size * 0.8, $Size * 0.36)
  )
  $arrowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 17, 234, 240))
  $graphics.FillPolygon($arrowBrush, $arrowHead)

  Draw-AircraftSide -Graphics $graphics -Size $Size
  Draw-CalculatorGlyph -Graphics $graphics -Size $Size
  Draw-TitleBlock -Graphics $graphics -Size $Size

  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)

  $arrowBrush.Dispose()
  $linePen.Dispose()
  $glowPen.Dispose()
  $ringPen.Dispose()
  $accentPen.Dispose()
  $shadowPen.Dispose()
  $borderPen.Dispose()
  $highlightBrush.Dispose()
  $fillBrush.Dispose()
  $cardPath.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$outputs = @(
  @{ Size = 32; Name = "favicon-32.png" },
  @{ Size = 180; Name = "apple-touch-icon.png" },
  @{ Size = 192; Name = "icon-192.png" },
  @{ Size = 512; Name = "icon-512.png" }
)

foreach ($output in $outputs) {
  Save-AppIcon -Size $output.Size -Path (Join-Path $OutputDirectory $output.Name)
}

Write-Output "Generated $($outputs.Count) icon files in $OutputDirectory"
