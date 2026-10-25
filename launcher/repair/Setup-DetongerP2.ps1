[CmdletBinding()]
param([string]$Directory,[switch]$Install,[string]$ResultFile,[switch]$LibraryOnly)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$script:P2DriverVersion='3.2.2026.1018'
$script:P2DriverUrl='https://detonger.com/driver/exe/DeTong_P2_Series_Windows_Driver_3.2.2026.1018.exe'
$script:P2DriverHash='0feae9a235b0b4707d6f6854547d69d6f49bf03ec30ec57a74fba7b4873866df'
$script:P2Signer='52DE7654F62FB78407724FB3E1A76FB4DF0F3E58'
$script:P2NamePattern='^(?:DeTong(?:er)?[ _-]*)?P2(?:[ _-]+Label[ _-]+Printer)?$'

function Get-P2Snapshot {
 $queues=@(Get-Printer -ErrorAction Stop|Where-Object {$_.Name -match $script:P2NamePattern})
 $drivers=@(Get-PrinterDriver -ErrorAction Stop|Where-Object {$_.Name -match $script:P2NamePattern})
 $devices=@(Get-CimInstance -ClassName Win32_PnPEntity -ErrorAction Stop|Where-Object {
  $_.Present -ne $false -and ($null -eq $_.ConfigManagerErrorCode -or $_.ConfigManagerErrorCode -eq 0) -and
  ($_.PNPDeviceID -like 'USBPRINT\DeTong_DP27_Label_Pr9275*' -or $_.Name -match $script:P2NamePattern)
 })
 return @{queues=$queues;drivers=$drivers;connected=($devices.Count -gt 0)}
}
function New-P2Result([string]$Status,[string]$Message,$State,[int]$Attempts=0,$Code=$null) {
 [pscustomobject]@{status=$Status;message=$Message;driver_version=$script:P2DriverVersion;attempts=$Attempts;updated_at=[DateTime]::UtcNow.ToString('o');queue_name=[string]($State.queues|Select-Object -First 1 -ExpandProperty Name);connected=[bool]$State.connected;exit_code=$Code}
}
function Write-P2Receipt([string]$SetupDirectory,$Result) {
 $receipt=Join-Path $SetupDirectory 'receipt.json';$temporary=$receipt+'.'+[guid]::NewGuid().ToString('N')+'.tmp'
 try{
  [IO.File]::WriteAllText($temporary,($Result|ConvertTo-Json -Compress -Depth 5),[Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $temporary -Destination $receipt -Force -ErrorAction Stop
 }finally{if(Test-Path -LiteralPath $temporary){Remove-Item -LiteralPath $temporary -Force -ErrorAction SilentlyContinue}}
}
function Get-P2Attempts([string]$SetupDirectory) {
 try{
  $previous=[IO.File]::ReadAllText((Join-Path $SetupDirectory 'receipt.json'),[Text.Encoding]::UTF8)|ConvertFrom-Json
  if($previous.driver_version -eq $script:P2DriverVersion -and [int]$previous.attempts -ge 0){return [int]$previous.attempts}
 }catch{}
 return 0
}
function Enter-P2Lock([string]$SetupDirectory) {
 $lockFile=Join-Path $SetupDirectory 'install.lock'
 if(Test-Path -LiteralPath $lockFile){
  $existing=Get-Item -LiteralPath $lockFile -ErrorAction Stop
  if($existing.LastWriteTimeUtc -lt [DateTime]::UtcNow.AddMinutes(-10)){
   $staleProbe=$null
   try{
    # Node may hold its wx lock with delete sharing. Open without read/write
    # sharing first: a live Node owner must remain busy even after ten minutes.
    # Retain the probe during removal so another writer cannot replace the file.
    $staleProbe=[IO.File]::Open($lockFile,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Delete)
    if([IO.File]::GetLastWriteTimeUtc($lockFile) -ge [DateTime]::UtcNow.AddMinutes(-10)){return $null}
    Remove-Item -LiteralPath $lockFile -Force -ErrorAction Stop
   }catch{return $null}finally{if($staleProbe){$staleProbe.Dispose()}}
  }
 }
 try{
  $stream=[IO.File]::Open($lockFile,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
 }catch [IO.IOException]{if(Test-Path -LiteralPath $lockFile){return $null};throw}
 $token=[guid]::NewGuid().ToString('N');$bytes=[Text.Encoding]::ASCII.GetBytes($token)
 try{$stream.Write($bytes,0,$bytes.Length);$stream.Flush()}catch{$stream.Dispose();throw}
 return [pscustomobject]@{path=$lockFile;stream=$stream;token=$token}
}
function Exit-P2Lock($Lock) {
 if(!$Lock){return}
 $Lock.stream.Dispose()
 # A different owner may have recreated the lock. Never remove its file.
 if([IO.File]::Exists($Lock.path) -and [IO.File]::ReadAllText($Lock.path) -eq $Lock.token){Remove-Item -LiteralPath $Lock.path -Force -ErrorAction Stop}
}
function Test-P2PermissionDeclined($Failure) {
 $exception=$Failure.Exception
 while($null -ne $exception){
  if($exception.NativeErrorCode -eq 1223 -or $exception.HResult -eq -2147023673){return $true}
  $exception=$exception.InnerException
 }
 return $false
}
function Invoke-P2Setup([string]$SetupDirectory,[bool]$DoInstall) {
 $state=@{queues=@();drivers=@();connected=$false};$lock=$null;$attempts=0;$result=$null
 try{
  $state=Get-P2Snapshot
  if(!$DoInstall){
   if($state.queues.Count){return New-P2Result 'ready' ('Очередь Windows «'+$state.queues[0].Name+'» найдена. Физическая печать не проверялась.') $state}
   if($state.drivers.Count){return New-P2Result 'driver_installed' 'Драйвер P2 установлен, но очередь принтера отсутствует. Включите принтер и подключите его USB-кабелем с передачей данных.' $state}
   return New-P2Result 'not_connected' 'Очередь DETONGER P2 и драйвер не найдены. Подключите принтер и нажмите «Подключить термопринтер P2».' $state
  }
  if([string]::IsNullOrWhiteSpace($SetupDirectory)){throw 'Не указан каталог установки принтера.'}
  New-Item -ItemType Directory -Path $SetupDirectory -Force|Out-Null
  $lock=Enter-P2Lock $SetupDirectory
  if(!$lock){return New-P2Result 'busy' 'Настройка DETONGER P2 уже выполняется в другом окне FastGo. Дождитесь её завершения.' $state}
  $attempts=Get-P2Attempts $SetupDirectory
  if($state.queues.Count){$result=New-P2Result 'ready' ('Очередь Windows «'+$state.queues[0].Name+'» найдена. Физическая печать не проверялась.') $state $attempts}
  elseif($state.drivers.Count){$result=New-P2Result 'driver_installed' 'Драйвер P2 уже установлен. Очередь пока отсутствует: проверьте питание и USB-кабель принтера. Повторная установка драйвера не требуется.' $state $attempts}
  else{
   $attempts++
   Write-P2Receipt $SetupDirectory (New-P2Result 'installing' 'Загружаем и проверяем драйвер DETONGER P2. При запросе Windows подтвердите права администратора.' $state $attempts)
   $installer=Join-Path $SetupDirectory ('DeTong_P2_Series_Windows_Driver_'+$script:P2DriverVersion+'.exe')
   $download=$null
   try{
    if(!(Test-Path -LiteralPath $installer) -or (Get-FileHash -LiteralPath $installer -Algorithm SHA256 -ErrorAction Stop).Hash -ne $script:P2DriverHash){
     $download=$installer+'.'+[guid]::NewGuid().ToString('N')+'.download.exe'
     [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
     Invoke-WebRequest -Uri $script:P2DriverUrl -OutFile $download -UseBasicParsing -TimeoutSec 45 -ErrorAction Stop|Out-Null
     if((Get-FileHash -LiteralPath $download -Algorithm SHA256 -ErrorAction Stop).Hash -ne $script:P2DriverHash){throw 'SHA256 загруженного драйвера не совпал с проверенным значением. Установщик не запускался.'}
     Move-Item -LiteralPath $download -Destination $installer -Force -ErrorAction Stop
    }
   }catch{$result=New-P2Result 'download_error' ('Не удалось загрузить проверенный драйвер P2. '+$_.Exception.Message) $state $attempts}
   finally{if($download -and (Test-Path -LiteralPath $download)){Remove-Item -LiteralPath $download -Force -ErrorAction SilentlyContinue}}
   if(!$result){
    $signature=Get-AuthenticodeSignature -LiteralPath $installer -ErrorAction Stop
    if($signature.Status -ne 'Valid' -or $null -eq $signature.SignerCertificate -or $signature.SignerCertificate.Thumbprint -ne $script:P2Signer){throw 'Подпись или издатель драйвера P2 не совпал с проверенным. Установщик не запускался.'}
    try{$process=Start-Process -FilePath $installer -ArgumentList '/S' -Verb RunAs -WindowStyle Hidden -PassThru -Wait -ErrorAction Stop}
    catch{
     if(Test-P2PermissionDeclined $_){$result=New-P2Result 'permission_declined' 'Запрос прав администратора Windows отменён. Драйвер не установлен. Нажмите кнопку настройки ещё раз, чтобы повторить.' $state $attempts}
     else{throw}
    }
    if(!$result){
     if($process.ExitCode -in @(1223,1602)){$result=New-P2Result 'permission_declined' 'Установка драйвера P2 отменена. Повторите настройку, когда будете готовы подтвердить установку.' $state $attempts $process.ExitCode}
     elseif($process.ExitCode -notin @(0,3010)){throw ('Установщик P2 завершился с кодом '+$process.ExitCode+'.')}
     else{
      $state=Get-P2Snapshot
      for($wait=0;$wait -lt 6 -and !$state.queues.Count;$wait++){Start-Sleep -Seconds 2;$state=Get-P2Snapshot}
      if($state.queues.Count){$result=New-P2Result 'ready' ('Очередь Windows «'+$state.queues[0].Name+'» создана. Физическая печать не проверялась.') $state $attempts $process.ExitCode}
      elseif($state.drivers.Count){$result=New-P2Result 'driver_installed' 'Драйвер P2 установлен, но Windows пока не создала очередь. Проверьте питание и USB-кабель с передачей данных; затем повторите проверку.' $state $attempts $process.ExitCode}
      else{$result=New-P2Result 'error' 'Установщик завершился, но драйвер и очередь P2 не появились в Windows. Проверьте подключение принтера и установку драйвера.' $state $attempts $process.ExitCode}
     }
    }
   }
  }
 }catch{$result=New-P2Result 'error' ('Не удалось настроить DETONGER P2. '+$_.Exception.Message) $state $attempts}
 finally{
  if($lock){
   try{if($result){Write-P2Receipt $SetupDirectory $result}}
   catch{$result=New-P2Result 'error' ('Не удалось сохранить результат настройки P2. '+$_.Exception.Message) $state $attempts}
   try{Exit-P2Lock $lock}catch{$result=New-P2Result 'error' ('Не удалось освободить блокировку настройки P2. '+$_.Exception.Message) $state $attempts}
  }
 }
 return $result
}
if($LibraryOnly){return}
$outcome=Invoke-P2Setup -SetupDirectory $Directory -DoInstall ([bool]$Install)
$json=$outcome|ConvertTo-Json -Compress -Depth 5
if($ResultFile){[IO.File]::WriteAllText($ResultFile,$json,[Text.UTF8Encoding]::new($false))}
$json
