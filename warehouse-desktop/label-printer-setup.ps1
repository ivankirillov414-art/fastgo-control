param([string]$Directory, [switch]$Install, [switch]$Stage)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$ProgressPreference='SilentlyContinue'
$manifestHash='a2a4732c56f093f3972293abeb618cfffe71b9dbad8b03c0cf500004c0311847'
$signerThumbprint='52DE7654F62FB78407724FB3E1A76FB4DF0F3E58'
function Snapshot {
 $queues=@(Get-Printer -ErrorAction Stop | Where-Object {$_.DriverName -eq 'P2 Label Printer' -or $_.Name -match '^(DeTong(er)?[ _-]*)?P2([ _-]+Label[ _-]+Printer)?$'})
 $drivers=@(Get-PrinterDriver -ErrorAction Stop | Where-Object {$_.Name -eq 'P2 Label Printer'})
 $devices=@(Get-CimInstance Win32_PnPEntity -ErrorAction Stop | Where-Object {$_.PNPDeviceID -like 'USBPRINT\DeTong_DP27_Label_Pr9275*' -or $_.Name -match '^(DeTong(er)?[ _-]*)?P2([ _-]+Label[ _-]+Printer)?$'})
 return @{queues=$queues;drivers=$drivers;connected=($devices.Count -gt 0)}
}
function Result([string]$Status,[string]$Message,$State,$Code=$null) {
 $result=@{status=$Status;message=$Message;queue_name=[string]($State.queues | Select-Object -First 1 -ExpandProperty Name);connected=$State.connected;exit_code=$Code}
 if($Install -and $Directory){
  $receiptFile=Join-Path $Directory 'receipt.json'
  try{$previous=Get-Content -LiteralPath $receiptFile -Raw -Encoding UTF8 | ConvertFrom-Json;$attempts=$previous.attempts}catch{$attempts=1}
  $receipt=@{status=$Status;message=$Message;queue_name=$result.queue_name;connected=$State.connected;exit_code=$Code;driver_version='2.1.2026.0508';attempts=$attempts;updated_at=[DateTime]::UtcNow.ToString('o')}
  $tempReceipt=$receiptFile+'.result'
  [IO.File]::WriteAllText($tempReceipt,($receipt | ConvertTo-Json -Compress -Depth 4),[Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $tempReceipt -Destination $receiptFile -Force
 }
 $result | ConvertTo-Json -Compress -Depth 4
}
function Validate-Package {
 $package=Join-Path $Directory 'driver'
 $manifestFile=Join-Path $package 'manifest.json'
 if((Get-FileHash -LiteralPath $manifestFile -Algorithm SHA256).Hash -ne $manifestHash){throw 'P2 manifest checksum mismatch'}
 $manifest=Get-Content -LiteralPath $manifestFile -Raw -Encoding UTF8 | ConvertFrom-Json
 foreach($entry in $manifest.files){
  if($entry.path -notmatch '^(?:(amd64|x86)/)?P2[PUI]*\.(dll|gpd|ini|inf|cat)$'){throw 'Invalid P2 file path'}
  $file=Join-Path $package $entry.path
  if((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $entry.sha256){throw 'P2 file checksum mismatch'}
 }
 $signature=Get-AuthenticodeSignature -LiteralPath (Join-Path $package 'P2.cat')
 if($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Thumbprint -ne $signerThumbprint){throw 'P2 catalogue signature mismatch'}
 return $package
}
try {
 $before=Snapshot
 if(!$Install -and !$Stage){Result 'not_connected' 'Диагностика Windows выполнена без установки драйвера.' $before;exit 0}
 if([string]::IsNullOrWhiteSpace($Directory)){throw 'Missing setup directory'}
 $package=Validate-Package
 if($Stage){
  $identity=[Security.Principal.WindowsIdentity]::GetCurrent()
  $principal=[Security.Principal.WindowsPrincipal]::new($identity)
  if(!$principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Driver staging requires Windows administrator consent'}
  & "$env:SystemRoot\System32\pnputil.exe" /add-driver (Join-Path $package 'P2.inf') /install | Out-Null
  $pnpExit=$LASTEXITCODE
  if($pnpExit -notin @(0,3010)){throw ('P2 pnputil exit '+$pnpExit)}
  $infHash=(Get-FileHash -LiteralPath (Join-Path $package 'P2.inf') -Algorithm SHA256).Hash
  $storeInf=Get-ChildItem -Path "$env:SystemRoot\System32\DriverStore\FileRepository\p2.inf_amd64_*\P2.inf" -File | Where-Object {(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash -eq $infHash} | Select-Object -First 1
  if(!$storeInf){throw 'P2 INF missing from Windows Driver Store'}
  Add-PrinterDriver -Name 'P2 Label Printer' -InfPath $storeInf.FullName -ErrorAction Stop
  exit 0
 }
 if($before.queues.Count -gt 0){Result 'ready' 'DETONGER P2 установлен в Windows.' $before;exit 0}
 try {
  $shell=Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $arguments=@('-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',('"'+$PSCommandPath+'"'),'-Directory',('"'+$Directory+'"'),'-Stage')
  $driverProcess=Start-Process -FilePath $shell -ArgumentList $arguments -Verb RunAs -WindowStyle Hidden -PassThru -Wait
 }catch{if($_.Exception.NativeErrorCode -eq 1223 -or $_.Exception.InnerException.NativeErrorCode -eq 1223){Result 'permission_declined' 'Windows не разрешила установку. Нажмите «Подключить DETONGER P2» для повторного запуска.' $before;exit 0};throw}
 if($driverProcess.ExitCode -ne 0){throw ('P2 driver stage exit '+$driverProcess.ExitCode)}
 $after=Snapshot
 for($wait=0;$wait -lt 6 -and $after.queues.Count -eq 0;$wait++){Start-Sleep -Seconds 2;$after=Snapshot}
 if($after.queues.Count -gt 0){Result 'ready' 'DETONGER P2 установлен и доступен для печати.' $after 0}
 elseif($after.drivers.Count -gt 0){Result 'driver_installed' 'Драйвер P2 установлен. Windows ещё не создала очередь принтера: проверьте питание и USB-кабель с передачей данных.' $after 0}
 else{Result 'error' 'Windows не зарегистрировала драйвер P2. Повторите подключение в настройках принтера.' $after 0}
}catch{
 if($Stage){[Console]::Error.WriteLine($_.Exception.Message);exit 1}
 Result 'error' 'Не удалось настроить P2 в Windows. Проверьте подключение и повторите установку в настройках принтера.' @{queues=@();connected=$false};exit 0
}
