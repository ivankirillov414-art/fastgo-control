param([string]$Directory, [switch]$Install)
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$ProgressPreference='SilentlyContinue'
$driverUrl='https://detonger.com/driver/exe/DeTong_P2_Series_Windows_Driver_3.2.2026.1018.exe'
$driverHash='0feae9a235b0b4707d6f6854547d69d6f49bf03ec30ec57a74fba7b4873866df'
$signerThumbprint='52DE7654F62FB78407724FB3E1A76FB4DF0F3E58'
function Snapshot {
 $queues=@(Get-Printer -ErrorAction Stop | Where-Object {$_.Name -match '^(DeTong(er)?[ _-]*)?P2([ _-]+Label[ _-]+Printer)?$'})
 $drivers=@(Get-PrinterDriver -ErrorAction Stop | Where-Object {$_.Name -eq 'P2 Label Printer'})
 $devices=@(Get-CimInstance Win32_PnPEntity -ErrorAction Stop | Where-Object {$_.PNPDeviceID -like 'USBPRINT\DeTong_DP27_Label_Pr9275*' -or $_.Name -match '^(DeTong(er)?[ _-]*)?P2([ _-]+Label[ _-]+Printer)?$'})
 return @{queues=$queues;drivers=$drivers;connected=($devices.Count -gt 0)}
}
function Result([string]$Status,[string]$Message,$State,$Code=$null) {
 $result=@{status=$Status;message=$Message;queue_name=[string]($State.queues | Select-Object -First 1 -ExpandProperty Name);connected=$State.connected;exit_code=$Code}
 # Persist the outcome even if the FastGo window is closed during the Windows prompt.
 if($Install -and $Directory){
  $receiptFile=Join-Path $Directory 'receipt.json'
  try{$previous=Get-Content -LiteralPath $receiptFile -Raw -Encoding UTF8 | ConvertFrom-Json;$attempts=$previous.attempts}catch{$attempts=1}
  $receipt=@{status=$Status;message=$Message;queue_name=$result.queue_name;connected=$State.connected;exit_code=$Code;driver_version='3.2.2026.1018';attempts=$attempts;updated_at=[DateTime]::UtcNow.ToString('o')}
  $tempReceipt=$receiptFile+'.result'
  [IO.File]::WriteAllText($tempReceipt,($receipt | ConvertTo-Json -Compress -Depth 4),[Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $tempReceipt -Destination $receiptFile -Force
 }
 $result | ConvertTo-Json -Compress -Depth 4
}
try {
 $before=Snapshot
 if($before.queues.Count -gt 0){Result 'ready' 'DETONGER P2 установлен в Windows.' $before;exit 0}
 if(!$Install){Result 'not_connected' 'Очередь P2 отсутствует в Windows.' $before;exit 0}
 if([string]::IsNullOrWhiteSpace($Directory)){throw 'Missing setup directory'}
 $null=New-Item -ItemType Directory -Path $Directory -Force
 $installer=Join-Path $Directory 'DeTong_P2_Series_Windows_Driver_3.2.2026.1018.exe'
 if(!(Test-Path -LiteralPath $installer) -or (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash -ne $driverHash){
  $partial=$installer+'.partial'
  try {
   [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
   Invoke-WebRequest -Uri $driverUrl -OutFile $partial -UseBasicParsing -TimeoutSec 45
   if((Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash -ne $driverHash){throw 'Driver checksum mismatch'}
   Move-Item -LiteralPath $partial -Destination $installer -Force
  }catch{Result 'download_error' 'Не удалось скачать проверенный драйвер P2. Загрузка будет повторена после восстановления связи.' $before;exit 0}
 }
 $signature=Get-AuthenticodeSignature -LiteralPath $installer
 if($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Thumbprint -ne $signerThumbprint){throw 'Driver signature mismatch'}
 try{$driverProcess=Start-Process -FilePath $installer -ArgumentList '/S' -Verb RunAs -WindowStyle Hidden -PassThru -Wait}
 catch{if($_.Exception.NativeErrorCode -eq 1223 -or $_.Exception.InnerException.NativeErrorCode -eq 1223){Result 'permission_declined' 'Windows не разрешила установку. Нажмите «Подключить DETONGER P2» для повторного запуска.' $before;exit 0};throw}
 if($driverProcess.ExitCode -notin @(0,3010)){throw ('Driver installer exit '+$driverProcess.ExitCode)}
 $after=Snapshot
 for($wait=0;$wait -lt 6 -and $after.queues.Count -eq 0;$wait++){Start-Sleep -Seconds 2;$after=Snapshot}
 if($after.queues.Count -gt 0){Result 'ready' 'DETONGER P2 установлен и доступен для печати.' $after $driverProcess.ExitCode}
 elseif($after.drivers.Count -gt 0){Result 'driver_installed' 'Драйвер P2 установлен. Windows ещё не создала очередь принтера: проверьте питание и USB-кабель с передачей данных.' $after $driverProcess.ExitCode}
 else{Result 'error' 'Установщик завершился, но Windows не зарегистрировала драйвер P2. Нужна проверка установки драйвера.' $after $driverProcess.ExitCode}
}catch{Result 'error' 'Не удалось настроить P2 в Windows. Проверьте подключение и повторите установку в настройках принтера.' @{queues=@();connected=$false};exit 0}
