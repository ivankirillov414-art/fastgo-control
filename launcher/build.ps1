$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
$taskOut = Join-Path $taskRoot 'dist'
New-Item -ItemType Directory -Force -Path $taskOut | Out-Null
$taskCompiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (!(Test-Path -LiteralPath $taskCompiler)) { $taskCompiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe' }
$taskSources = @('Core.cs','MainForm.cs','Program.cs','JarvisRepair.cs') | ForEach-Object { Join-Path $taskRoot $_ }
Add-Type -AssemblyName System.Drawing
$taskBitmap = New-Object Drawing.Bitmap(64,64)
$taskGraphics = [Drawing.Graphics]::FromImage($taskBitmap)
$taskGraphics.Clear([Drawing.Color]::FromArgb(185,241,105))
$taskFont = New-Object Drawing.Font('Segoe UI',38,[Drawing.FontStyle]::Bold)
$taskBrush = New-Object Drawing.SolidBrush([Drawing.Color]::FromArgb(15,21,23))
$taskGraphics.DrawString('F',$taskFont,$taskBrush,[Drawing.PointF]::new(10,-3))
$taskIcon = [Drawing.Icon]::FromHandle($taskBitmap.GetHicon())
$taskIconFile = [IO.File]::Create((Join-Path $taskOut 'launcher.ico'))
$taskIcon.Save($taskIconFile)
$taskIconFile.Dispose(); $taskIcon.Dispose(); $taskGraphics.Dispose(); $taskFont.Dispose(); $taskBrush.Dispose(); $taskBitmap.Dispose()
& $taskCompiler /nologo /target:winexe /platform:anycpu /optimize+ /utf8output "/out:$taskOut\FastGo-Warehouse-Launcher.exe" "/win32icon:$taskOut\launcher.ico" "/win32manifest:$taskRoot\app.manifest" "/resource:$taskRoot\repair\FIX_JARVIS_CONSOLE.ps1,FastGo.JarvisRepair" /reference:System.dll /reference:System.Core.dll /reference:System.Drawing.dll /reference:System.Windows.Forms.dll /reference:System.Web.Extensions.dll $taskSources
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed' }
& $taskCompiler /nologo /target:exe /optimize+ /utf8output "/out:$taskOut\Launcher.Tests.exe" /reference:System.dll /reference:System.Core.dll /reference:System.Web.Extensions.dll (Join-Path $taskRoot 'Core.cs') (Join-Path $taskRoot 'Tests.cs')
if ($LASTEXITCODE -ne 0) { throw 'Test compilation failed' }
Get-FileHash -LiteralPath (Join-Path $taskOut 'FastGo-Warehouse-Launcher.exe') -Algorithm SHA256 | ForEach-Object { "$($_.Hash.ToLowerInvariant())  FastGo-Warehouse-Launcher.exe" } | Set-Content -LiteralPath (Join-Path $taskOut 'SHA256SUMS.txt') -Encoding ASCII
Get-Item -LiteralPath (Join-Path $taskOut 'FastGo-Warehouse-Launcher.exe') | Select-Object Name,Length
