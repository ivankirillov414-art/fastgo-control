param([string]$Directory,[switch]$Install,[switch]$Stage)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$ProgressPreference='SilentlyContinue'
$driverName='4BARCODE 3B-365B'
$queueName='POScenter PC-365'
function Queue { return @(Get-Printer -ErrorAction Stop | Where-Object {$_.DriverName -eq $driverName -or $_.Name -eq $queueName}) }
function Result([string]$Status,[string]$Message,[bool]$Connected=$false,[bool]$TestPrinted=$false) { @{status=$Status;message=$Message;connected=$Connected;test_printed=$TestPrinted;driver_version='2023.2.4.0';queue_name=[string]((Queue | Select-Object -First 1).Name)} | ConvertTo-Json -Compress }
try {
 $devices=@(Get-CimInstance Win32_PnPEntity | Where-Object {$_.PNPDeviceID -like 'USBPRINT\4BARCODE3B-365B*'})
 if(!$Stage -and $devices.Count -eq 0){Result 'not_connected' 'POScenter PC-365 пока не найден на USB.';exit 0}
 if(!$Stage -and (Queue).Count -gt 0){Result 'ready' 'POScenter PC-365 установлен в Windows.' $true;exit 0}
 if(!$Install -and !$Stage){Result 'not_connected' 'Проверка выполнена без установки.' ($devices.Count -gt 0);exit 0}
 $package=Join-Path $Directory 'driver'
 $manifestFile=Join-Path $package 'manifest.json'
 if((Get-FileHash -LiteralPath $manifestFile -Algorithm SHA256).Hash -ne '3CCC3C12E59D67735AE3EDD30D0FBD51E2D00040F6E1AA95AA29296AF06F2D2C'){throw 'Manifest checksum mismatch'}
 $manifest=Get-Content -LiteralPath $manifestFile -Raw -Encoding UTF8 | ConvertFrom-Json
 foreach($file in $manifest.files){if($file.path -notmatch '^(?:(Common|x64|Win32)/)?[a-zA-Z0-9_#.\[\]-]+$' -or $file.path.Contains('..')){throw 'Invalid path'};if((Get-FileHash -LiteralPath (Join-Path $package $file.path) -Algorithm SHA256).Hash -ne $file.sha256){throw 'Driver checksum mismatch'}}
 $signature=Get-AuthenticodeSignature -LiteralPath (Join-Path $package '4barcode.cat')
 if($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Thumbprint -ne '0ECA937423F01F974CA582BCFC417550BE20B95E'){throw 'Unexpected driver publisher'}
 if($Stage){
  $identity=[Security.Principal.WindowsIdentity]::GetCurrent();$principal=[Security.Principal.WindowsPrincipal]::new($identity)
  if(!$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Windows administrator consent is required'}
  & "$env:SystemRoot\System32\pnputil.exe" /add-driver (Join-Path $package '4BARCODE.inf') /install | Out-Null
  if($LASTEXITCODE -notin @(0,3010)){throw 'Driver staging failed'}
  $infHash=(Get-FileHash -LiteralPath (Join-Path $package '4BARCODE.inf') -Algorithm SHA256).Hash
  $storeInf=Get-ChildItem -Path "$env:SystemRoot\System32\DriverStore\FileRepository\4barcode.inf_amd64_*\4BARCODE.inf" -File | Where-Object {(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash -eq $infHash} | Select-Object -First 1
  if(!$storeInf){throw 'Driver missing from Windows driver store'}
  Add-PrinterDriver -Name $driverName -InfPath $storeInf.FullName -ErrorAction Stop
  if((Queue).Count -eq 0){
   $port=@(Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Enum\USBPRINT\4BARCODE3B-365B*\*\Device Parameters' -ErrorAction SilentlyContinue | ForEach-Object {$_.PortName} | Where-Object {$_ -match '^USB[0-9]+$'}) | Select-Object -First 1
   if($port -and (Get-PrinterPort -Name $port -ErrorAction SilentlyContinue)){Add-Printer -Name $queueName -DriverName $driverName -PortName $port -ErrorAction Stop}
  }
  exit 0
 }
 $shell=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
 try{$process=Start-Process -FilePath $shell -ArgumentList @('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',('"'+$PSCommandPath+'"'),'-Directory',('"'+$Directory+'"'),'-Stage') -Verb RunAs -WindowStyle Hidden -PassThru -Wait}
 catch{if($_.Exception.NativeErrorCode -eq 1223 -or $_.Exception.InnerException.NativeErrorCode -eq 1223){Result 'permission_declined' 'Windows не разрешила установку PC-365. Повторите подключение в настройках.' $true;exit 0};throw}
 if($process.ExitCode -ne 0){throw 'Driver installation failed'}
 for($n=0;$n -lt 6 -and (Queue).Count -eq 0;$n++){Start-Sleep -Seconds 2}
 if((Queue).Count -eq 0){Result 'driver_installed' 'Драйвер PC-365 установлен. Переподключите USB, чтобы Windows создала очередь печати.' $true;exit 0}
 # One small, explicitly requested hardware test after the first installation.
 try{
  Add-Type -AssemblyName System.Drawing
  $doc=[Drawing.Printing.PrintDocument]::new();$doc.PrinterSettings.PrinterName=(Queue | Select-Object -First 1).Name
  $doc.PrintController=[Drawing.Printing.StandardPrintController]::new();$doc.DocumentName='FastGo - PC-365 test'
  $doc.DefaultPageSettings.PaperSize=[Drawing.Printing.PaperSize]::new('FastGo test',197,106)
  $doc.add_PrintPage({param($sender,$eventArgs);$font=[Drawing.Font]::new('Arial',9);try{$eventArgs.Graphics.DrawString("FastGo`nPC-365 OK",$font,[Drawing.Brushes]::Black,12,12)}finally{$font.Dispose()};$eventArgs.HasMorePages=$false})
  try{$doc.Print()}finally{$doc.Dispose()}
  Result 'ready' 'POScenter PC-365 установлен. Пробная этикетка передана принтеру.' $true $true
 }catch{Result 'ready' 'POScenter PC-365 установлен. Пробная печать не завершилась; проверьте бумагу и индикаторы.' $true}
}catch{if($Stage){[Console]::Error.WriteLine($_.Exception.Message);exit 1};Result 'error' 'Не удалось настроить POScenter PC-365. Повторите подключение в настройках принтера.'}
