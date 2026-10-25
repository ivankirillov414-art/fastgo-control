$ErrorActionPreference='Stop'
# Preload modules before replacing their commands. Windows PowerShell otherwise
# auto-imports Get-FileHash after the first JSON conversion and replaces a mock.
Import-Module Microsoft.PowerShell.Utility -ErrorAction Stop
Import-Module Microsoft.PowerShell.Security -ErrorAction Stop
$setup=Join-Path $PSScriptRoot 'Setup-DetongerP2.ps1'
$tokens=$null;$errors=$null
[Management.Automation.Language.Parser]::ParseFile($setup,[ref]$tokens,[ref]$errors)|Out-Null
if($errors.Count){throw ($errors|Out-String)}
. $setup -LibraryOnly
function Assert-P2($Condition,[string]$Message){if(!$Condition){throw $Message}}
$temporary=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')
$fixtureRoot=Join-Path $temporary ('FastGoP2Fixture-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixtureRoot|Out-Null
function Reset-P2Fixture {
 $global:P2Fixture=@{queues=@('Office A4','POS-80');drivers=@();devices=@();downloads=0;hashes=0;signatures=0;starts=0;sleeps=0;afterQueue=$true;afterDriver=$true;startMode='success';downloadFailure=$false;badHash=$false;signature='Valid';signer='52DE7654F62FB78407724FB3E1A76FB4DF0F3E58';snapshotFailure=$false;order=New-Object 'System.Collections.Generic.List[string]'}
}
function Get-Printer {
 param($ErrorAction)
 if($global:P2Fixture.snapshotFailure){throw 'fixture spooler unavailable'}
 foreach($name in $global:P2Fixture.queues){[pscustomobject]@{Name=$name}}
}
function Get-PrinterDriver {param($ErrorAction) foreach($name in $global:P2Fixture.drivers){[pscustomobject]@{Name=$name}}}
function Get-CimInstance {param($ClassName,$ErrorAction) Assert-P2 ($ClassName -eq 'Win32_PnPEntity') 'Only printer PnP discovery is expected';$global:P2Fixture.devices}
function Invoke-WebRequest {
 param($Uri,$OutFile,[switch]$UseBasicParsing,$TimeoutSec,$ErrorAction)
 $global:P2Fixture.downloads++;$global:P2Fixture.order.Add('download')
 Assert-P2 ($Uri -eq 'https://detonger.com/driver/exe/DeTong_P2_Series_Windows_Driver_3.2.2026.1018.exe') 'Download must use the pinned vendor URL'
 if($global:P2Fixture.downloadFailure){throw 'fixture network unavailable'}
 [IO.File]::WriteAllText($OutFile,'harmless driver fixture - never execute')
}
function Get-FileHash {
 param($LiteralPath,$Algorithm,$ErrorAction)
 $global:P2Fixture.hashes++;$global:P2Fixture.order.Add('hash')
 Assert-P2 ($Algorithm -eq 'SHA256') 'Only the pinned SHA256 is accepted'
 Assert-P2 ([IO.File]::Exists($LiteralPath)) 'Hash must inspect the actual fixture download'
 [pscustomobject]@{Hash=$(if($global:P2Fixture.badHash){'BAD'}else{'0feae9a235b0b4707d6f6854547d69d6f49bf03ec30ec57a74fba7b4873866df'})}
}
function Get-AuthenticodeSignature {
 param($LiteralPath,$ErrorAction)
 $global:P2Fixture.signatures++;$global:P2Fixture.order.Add('signature')
 Assert-P2 ([IO.File]::Exists($LiteralPath)) 'Signature must inspect the fixture installer'
 [pscustomobject]@{Status=$global:P2Fixture.signature;SignerCertificate=[pscustomobject]@{Thumbprint=$global:P2Fixture.signer}}
}
function Start-Process {
 param($FilePath,$ArgumentList,$Verb,$WindowStyle,[switch]$PassThru,[switch]$Wait,$ErrorAction)
 $global:P2Fixture.starts++;$global:P2Fixture.order.Add('start')
 Assert-P2 ($ArgumentList -eq '/S' -and $Verb -eq 'RunAs' -and $WindowStyle -eq 'Hidden' -and $PassThru -and $Wait) 'Installer must be silent, elevated, hidden and awaited'
 Assert-P2 ($global:P2Fixture.hashes -gt 0 -and $global:P2Fixture.signatures -gt 0) 'Hash and signature must be checked before execution'
 if($global:P2Fixture.startMode -eq 'uac'){throw [ComponentModel.Win32Exception]::new(1223)}
 if($global:P2Fixture.startMode -eq 'cancel'){return [pscustomobject]@{ExitCode=1602}}
 if($global:P2Fixture.startMode -eq 'exit_error'){return [pscustomobject]@{ExitCode=1603}}
 if($global:P2Fixture.afterQueue){$global:P2Fixture.queues+=@('DeTong P2')}
 if($global:P2Fixture.afterDriver){$global:P2Fixture.drivers=@('P2 Label Printer')}
 $global:P2Fixture.devices=@([pscustomobject]@{Name='USB label device';PNPDeviceID='USBPRINT\DeTong_DP27_Label_Pr9275\fixture';Present=$true;ConfigManagerErrorCode=0})
 [pscustomobject]@{ExitCode=0}
}
function Start-Sleep {param($Seconds) $global:P2Fixture.sleeps++}
function Run-P2Fixture([string]$Name,[bool]$Install=$true){
 $directory=Join-Path $fixtureRoot $Name;$resultFile=Join-Path $fixtureRoot ($Name+'-result.json')
 $arguments=@{Directory=$directory;ResultFile=$resultFile};if($Install){$arguments.Install=$true}
 $stdout=& $setup @arguments
 Assert-P2 ([IO.File]::Exists($resultFile)) 'Every invocation must write the JSON result file'
 $bytes=[IO.File]::ReadAllBytes($resultFile)
 Assert-P2 (!($bytes.Length -ge 3 -and $bytes[0] -eq 239 -and $bytes[1] -eq 187 -and $bytes[2] -eq 191)) 'Shared result must be UTF8 without a BOM'
 $text=[Text.UTF8Encoding]::new($false,$true).GetString($bytes)
 $result=$text|ConvertFrom-Json
 Assert-P2 ($result.message -match '[\u0400-\u04ff]') 'UTF8 JSON must preserve the Russian UI message'
 Assert-P2 (($stdout|ConvertFrom-Json).status -eq $result.status) 'Stdout and file transports must agree'
 if($Install -and $result.status -ne 'busy' -and [IO.Directory]::Exists($directory)){
  $receipt=[IO.File]::ReadAllText((Join-Path $directory 'receipt.json'),[Text.Encoding]::UTF8)|ConvertFrom-Json
  Assert-P2 ($receipt.status -eq $result.status -and $receipt.driver_version -eq '3.2.2026.1018' -and $receipt.updated_at) 'Shared receipt must match the outcome and driver version'
  Assert-P2 (!(Test-Path -LiteralPath (Join-Path $directory 'install.lock'))) 'The owned install lock must be released'
 }
 return $result
}
try{
 Reset-P2Fixture
 $global:P2Fixture.queues+=@('HP P2','P20','XP2','P2 extra')
 $readonly=Run-P2Fixture 'readonly-empty' $false
 Assert-P2 ($readonly.status -eq 'not_connected' -and !(Test-Path -LiteralPath (Join-Path $fixtureRoot 'readonly-empty'))) 'Read-only inspection must not create the setup directory or match unrelated printer names'
 Assert-P2 ($global:P2Fixture.starts -eq 0 -and $global:P2Fixture.downloads -eq 0) 'Read-only inspection must never install or download'
 $readonlyDir=Join-Path $fixtureRoot 'readonly-existing';New-Item -ItemType Directory -Path $readonlyDir|Out-Null
 $readonlyReceipt=Join-Path $readonlyDir 'receipt.json';[IO.File]::WriteAllText($readonlyReceipt,'fixture unchanged receipt')
 $global:P2Fixture.queues+=@('DETONGER P2 Label Printer')
 $ready=Run-P2Fixture 'readonly-existing' $false
 Assert-P2 ($ready.status -eq 'ready' -and !$ready.connected -and [IO.File]::ReadAllText($readonlyReceipt) -eq 'fixture unchanged receipt') 'An offline exact P2 queue is registered in Windows; read-only receipt must remain untouched'
 Assert-P2 (!(Test-Path -LiteralPath (Join-Path $readonlyDir 'install.lock'))) 'Read-only inspection must not create a lock'

 Reset-P2Fixture;$global:P2Fixture.queues+=@('P2')
 $ready=Run-P2Fixture 'already-ready'
 Assert-P2 ($ready.status -eq 'ready' -and $global:P2Fixture.starts -eq 0 -and $global:P2Fixture.downloads -eq 0) 'An existing exact P2 queue must skip installation'
 Reset-P2Fixture;$global:P2Fixture.drivers=@('P2 Label Printer')
 $driver=Run-P2Fixture 'readonly-driver' $false
 Assert-P2 ($driver.status -eq 'driver_installed') 'Driver-only read-only state must not claim a ready queue'
 $driver=Run-P2Fixture 'existing-driver'
 Assert-P2 ($driver.status -eq 'driver_installed' -and $global:P2Fixture.starts -eq 0 -and $global:P2Fixture.downloads -eq 0) 'An installed driver without a queue must not be reinstalled'

 Reset-P2Fixture
 $busyDir=Join-Path $fixtureRoot 'busy';New-Item -ItemType Directory -Path $busyDir|Out-Null
 $foreignLock=Join-Path $busyDir 'install.lock';[IO.File]::WriteAllText($foreignLock,'foreign-owner')
 $busyReceipt=Join-Path $busyDir 'receipt.json';[IO.File]::WriteAllText($busyReceipt,'foreign-receipt')
 $busy=Run-P2Fixture 'busy'
 Assert-P2 ($busy.status -eq 'busy' -and [IO.File]::ReadAllText($foreignLock) -eq 'foreign-owner' -and [IO.File]::ReadAllText($busyReceipt) -eq 'foreign-receipt' -and $global:P2Fixture.starts -eq 0) 'A fresh foreign lock must be retained without overwriting its receipt'
 # Even an old lock must remain busy while another owner holds the file open.
 [IO.File]::SetLastWriteTimeUtc($foreignLock,[DateTime]::UtcNow.AddMinutes(-11))
 $held=[IO.File]::Open($foreignLock,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))
 try{$busy=Run-P2Fixture 'busy';Assert-P2 ($busy.status -eq 'busy') 'An active old lock must not be removed'}finally{$held.Dispose()}
 Reset-P2Fixture;$global:P2Fixture.drivers=@('P2 Label Printer')
 $stale=Run-P2Fixture 'busy'
 Assert-P2 ($stale.status -eq 'driver_installed' -and !(Test-Path -LiteralPath $foreignLock)) 'An abandoned lock older than ten minutes may be replaced and released'
 $ownershipDir=Join-Path $fixtureRoot 'ownership';New-Item -ItemType Directory -Path $ownershipDir|Out-Null
 $own=Enter-P2Lock $ownershipDir;$own.stream.Dispose();Remove-Item -LiteralPath $own.path
 [IO.File]::WriteAllText($own.path,'new-foreign-owner');Exit-P2Lock $own
 Assert-P2 ([IO.File]::ReadAllText($own.path) -eq 'new-foreign-owner') 'Unlock must never delete another owner replacement lock'

 Reset-P2Fixture
 $success=Run-P2Fixture 'success'
 Assert-P2 ($success.status -eq 'ready' -and $success.connected -and $success.queue_name -eq 'DeTong P2' -and $success.attempts -eq 1 -and $global:P2Fixture.starts -eq 1) ('Verified installation must report the registered exact queue and one attempt: '+($success|ConvertTo-Json -Compress)+' state='+($global:P2Fixture|ConvertTo-Json -Compress))
 Assert-P2 (($global:P2Fixture.order -join ',') -eq 'download,hash,signature,start') 'Download, pinned hash, signature and installer execution must occur in that order'
 Assert-P2 ($global:P2Fixture.queues -contains 'Office A4' -and $global:P2Fixture.queues -contains 'POS-80') 'Other printer profiles must remain unchanged'
 Reset-P2Fixture;$global:P2Fixture.afterQueue=$false
 $driverOnly=Run-P2Fixture 'installed-without-queue'
 Assert-P2 ($driverOnly.status -eq 'driver_installed' -and !$driverOnly.queue_name) 'Successful installer exit without a queue must not claim readiness'
 Reset-P2Fixture;$global:P2Fixture.afterQueue=$false;$global:P2Fixture.afterDriver=$false
 $missing=Run-P2Fixture 'installer-no-driver'
 Assert-P2 ($missing.status -eq 'error') 'Installer success without a driver or queue must be reported as incomplete'

 Reset-P2Fixture;$global:P2Fixture.badHash=$true
 $badHash=Run-P2Fixture 'bad-hash'
 Assert-P2 ($badHash.status -eq 'download_error' -and $badHash.message -like '*SHA256*' -and $global:P2Fixture.signatures -eq 0 -and $global:P2Fixture.starts -eq 0) 'Hash rejection must happen before signature or execution'
 foreach($failure in @('status','signer')){
  Reset-P2Fixture
  if($failure -eq 'status'){$global:P2Fixture.signature='NotSigned'}else{$global:P2Fixture.signer='UNTRUSTED'}
  $badSignature=Run-P2Fixture ('bad-signature-'+$failure)
  Assert-P2 ($badSignature.status -eq 'error' -and $global:P2Fixture.starts -eq 0 -and $global:P2Fixture.signatures -eq 1) 'Invalid signature or signer must prevent installer execution'
 }
 Reset-P2Fixture;$global:P2Fixture.downloadFailure=$true
 $download=Run-P2Fixture 'network-error'
 Assert-P2 ($download.status -eq 'download_error' -and $download.message -like '*fixture network unavailable*' -and $global:P2Fixture.starts -eq 0) 'Network failure must preserve its detailed reason and skip execution'
 foreach($mode in @('uac','cancel')){
  Reset-P2Fixture;$global:P2Fixture.startMode=$mode
  $declined=Run-P2Fixture ('declined-'+$mode)
  Assert-P2 ($declined.status -eq 'permission_declined' -and $global:P2Fixture.starts -eq 1) 'UAC refusal and installer cancellation must be classified explicitly'
 }
 Reset-P2Fixture;$global:P2Fixture.startMode='exit_error'
 $exitFailure=Run-P2Fixture 'installer-error'
 Assert-P2 ($exitFailure.status -eq 'error' -and $exitFailure.message -like '*1603*') 'Installer error code must reach the UI'
 Reset-P2Fixture;$global:P2Fixture.snapshotFailure=$true
 $snapshotError=Run-P2Fixture 'snapshot-error' $false
 Assert-P2 ($snapshotError.status -eq 'error' -and $snapshotError.message -like '*fixture spooler unavailable*' -and !(Test-Path -LiteralPath (Join-Path $fixtureRoot 'snapshot-error'))) 'Read-only Windows discovery errors must remain detailed and must not create setup files'
 Write-Output 'PASS: Windows PowerShell P2 fixtures: read-only/no install, exact queue names, driver-only state, shared fresh/stale/held/owned lock, hash/signature before UAC, success receipt and UTF8 JSON, absent queue/driver, network failure, cancellation and UAC decline, other printer profiles preserved'
}finally{
 if([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($fixtureRoot)) -ne $temporary){throw 'Invalid P2 fixture cleanup target'}
 Remove-Item -LiteralPath $fixtureRoot -Recurse -Force
 Remove-Variable -Name P2Fixture -Scope Global -ErrorAction SilentlyContinue
}
