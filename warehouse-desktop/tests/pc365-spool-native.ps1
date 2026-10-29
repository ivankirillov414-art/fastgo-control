$ErrorActionPreference='Stop'
if($env:GITHUB_ACTIONS -ne 'true'){throw 'This file-port test requires a disposable Windows CI runner.'}
$out=Join-Path (Get-Location) 'browser-results/pc365-spool'
New-Item -ItemType Directory -Force -Path $out | Out-Null
$queue='4BARCODE 3B-365B'
$rawPort=Join-Path $out 'raw-captured.bin'
$gdiPort=Join-Path $out 'gdi-captured.bin'
Add-PrinterPort -Name $rawPort
Add-PrinterPort -Name $gdiPort
Add-Printer -Name $queue -DriverName $queue -PortName $rawPort
Copy-Item -LiteralPath (Join-Path $PSScriptRoot '../pc365-media.ps1') -Destination (Join-Path $out 'pc365-media.ps1')
$inputFile=Join-Path $out ('label-'+[guid]::NewGuid()+'.bin')
node -e "const fs=require('fs'),{packet}=require('./warehouse-desktop/pc365-raster.cjs'),width=464,height=216,pixels=Buffer.alloc(width*height*4,255);for(let y=32;y<184;y++)for(let x=24;x<440;x++)if((x+y)%3===0){const i=(y*width+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=0;}fs.writeFileSync(process.argv[1],packet({widthMm:58,heightMm:27,quantity:30,pixels,width,height}));" $inputFile
if($LASTEXITCODE -ne 0){throw 'Could not create native transport fixture'}
function Wait-Output([string]$Path){
 for($i=0;$i -lt 40;$i++){if((Test-Path -LiteralPath $Path) -and @(Get-PrintJob -PrinterName $queue -ErrorAction SilentlyContinue).Count -eq 0){return};Start-Sleep -Milliseconds 500}
 Get-Printer -Name $queue | Select-Object Name,PortName,PrinterStatus,JobCount | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $out 'queue-on-timeout.json')
 Get-PrintJob -PrinterName $queue -ErrorAction SilentlyContinue | Select-Object ID,JobStatus,Size,TotalPages | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $out 'jobs-on-timeout.json')
 throw ('Windows did not deliver the job to '+$Path)
}
$r=(& (Join-Path $out 'pc365-media.ps1') -PrinterName $queue -WidthMm 58 -HeightMm 27 -Mode Print -DataFile $inputFile) | ConvertFrom-Json
if($r.status -ne 'submitted'){throw ('Actual Winspool submission failed: '+($r|ConvertTo-Json -Compress))}
Wait-Output $rawPort
$inputHash=(Get-FileHash -LiteralPath $inputFile -Algorithm SHA256).Hash
$rawHash=(Get-FileHash -LiteralPath $rawPort -Algorithm SHA256).Hash
if($inputHash -ne $rawHash){throw 'Actual Winspool/Seagull path changed the RAW bytes'}
Set-Printer -Name $queue -PortName $gdiPort
Add-Type -AssemblyName System.Drawing
$doc=[Drawing.Printing.PrintDocument]::new()
$doc.PrinterSettings.PrinterName=$queue
$doc.PrinterSettings.Copies=30
$doc.PrinterSettings.Collate=$false
$doc.PrintController=[Drawing.Printing.StandardPrintController]::new()
$doc.DefaultPageSettings.PaperSize=[Drawing.Printing.PaperSize]::new('FastGo 58x27',228,106)
$doc.DefaultPageSettings.Margins=[Drawing.Printing.Margins]::new(0,0,0,0)
$doc.add_PrintPage({param($sender,$eventArgs);$font=[Drawing.Font]::new('Arial',9);try{$eventArgs.Graphics.DrawString('FastGo PC365', $font,[Drawing.Brushes]::Black,8,8);$eventArgs.Graphics.FillRectangle([Drawing.Brushes]::Black,8,35,180,20)}finally{$font.Dispose()};$eventArgs.HasMorePages=$false})
try{$doc.Print()}finally{$doc.Dispose()}
Wait-Output $gdiPort
$gdi=[IO.File]::ReadAllBytes($gdiPort)
$text=[Text.Encoding]::ASCII.GetString($gdi)
$commands=@($text -split "`n" | Where-Object {$_ -match '^(SIZE|GAP|SET |DIRECTION|REFERENCE|OFFSET|SHIFT|SPEED|DENSITY|PRINT|HOME|CLS)' } | Select-Object -First 45)
$report=@{raw_bytes_unchanged=$true;raw_sha256=$rawHash;raw_length=(Get-Item -LiteralPath $rawPort).Length;windows_media=$r.windows_media;gdi_length=$gdi.Length;gdi_prefix=$text.Substring(0,[Math]::Min(1000,$text.Length));gdi_commands=$commands}
$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $out 'verification.json') -Encoding UTF8
$report | ConvertTo-Json -Depth 6
Write-Output 'PASS: real Winspool RAW bytes reached the file port unchanged; actual signed driver output captured.'
